import { randomUUID } from "node:crypto";

import type { protos } from "@google-cloud/documentai";

import {
  consolidateClausesWithLlm,
  hasLlmKey
} from "@/lib/analysis/llm";
import { createEmptyTerms } from "@/lib/document-pipeline-shared";
import {
  extractDocumentAiTextAnchor,
  processDocumentWithDocumentAi
} from "@/lib/document-ai";
import type { DealRecord, ExtractionPipelineResult, FieldEvidence } from "@/lib/types";

type DocumentAiDocument = protos.google.cloud.documentai.v1.IDocument;
type DocumentAiEntity = protos.google.cloud.documentai.v1.Document.IEntity;

const CONTRACT_SCHEMA_VERSION = "document-ai-contract-v1";
const CONTRACT_MODEL = "document_ai:contract_custom_extractor";

const CONSOLIDATED_CLAUSE_FIELDS = [
  "usageRights",
  "exclusivity",
  "deliverables",
  "termination",
  "notes"
] as const;

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function entitySnippet(document: DocumentAiDocument, entity: DocumentAiEntity) {
  return normalizeString(
    entity.mentionText ??
      entity.textAnchor?.content ??
      extractDocumentAiTextAnchor(document, entity.textAnchor) ??
      entity.normalizedValue?.text ??
      null
  );
}

function entityText(document: DocumentAiDocument, entity: DocumentAiEntity) {
  return normalizeString(entity.normalizedValue?.text) ?? entitySnippet(document, entity) ?? null;
}

function entityNumber(document: DocumentAiDocument, entity: DocumentAiEntity) {
  if (typeof entity.normalizedValue?.floatValue === "number") {
    return entity.normalizedValue.floatValue;
  }

  if (typeof entity.normalizedValue?.integerValue === "number") {
    return entity.normalizedValue.integerValue;
  }

  const text = entityText(document, entity);
  if (!text) {
    return null;
  }

  const numeric = text.replace(/[^0-9.-]+/g, "");
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function entityBoolean(document: DocumentAiDocument, entity: DocumentAiEntity) {
  const text = entityText(document, entity)?.toLowerCase();
  if (!text) {
    return null;
  }

  if (
    /(true|yes|allowed|permitted|included|checked|selected|\bx\b)/.test(text) &&
    !/(not allowed|not permitted|prohibited|forbidden|unchecked|false|no)/.test(text)
  ) {
    return true;
  }

  if (/(false|no|not allowed|not permitted|prohibited|forbidden|unchecked)/.test(text)) {
    return false;
  }

  return true;
}

function collectEntities(entities: DocumentAiEntity[], ...types: string[]) {
  return entities.filter((entity) => entity.type && types.includes(entity.type));
}

function getConfidence(entity: DocumentAiEntity | null | undefined) {
  return typeof entity?.confidence === "number" ? entity.confidence : null;
}

function pickBestEntity(entities: DocumentAiEntity[]) {
  return [...entities].sort((left, right) => {
    const leftConfidence = getConfidence(left) ?? -1;
    const rightConfidence = getConfidence(right) ?? -1;
    return rightConfidence - leftConfidence;
  })[0] ?? null;
}

function entityPosition(entity: DocumentAiEntity) {
  const segment = entity.textAnchor?.textSegments?.[0];
  const rawStart = segment?.startIndex;
  if (typeof rawStart === "number") {
    return rawStart;
  }

  if (typeof rawStart === "string") {
    const parsed = Number.parseInt(rawStart, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const page = entity.pageAnchor?.pageRefs?.[0]?.page;
  if (typeof page === "number") {
    return page * 1_000_000;
  }

  if (typeof page === "string") {
    const parsed = Number.parseInt(page, 10);
    if (Number.isFinite(parsed)) {
      return parsed * 1_000_000;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

function orderEntitiesByDocumentPosition(entities: DocumentAiEntity[]) {
  return entities
    .map((entity, index) => ({ entity, index }))
    .sort((left, right) => {
      const positionDelta = entityPosition(left.entity) - entityPosition(right.entity);
      return positionDelta === 0 ? left.index - right.index : positionDelta;
    })
    .map(({ entity }) => entity);
}

function collectDistinctEntityTexts(document: DocumentAiDocument, entities: DocumentAiEntity[]) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const entity of orderEntitiesByDocumentPosition(entities)) {
    const text = entityText(document, entity);
    const key = text?.toLowerCase();
    if (!text || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    values.push(text);
  }

  return values;
}

function combineClauseEntities(document: DocumentAiDocument, entities: DocumentAiEntity[]) {
  const values = collectDistinctEntityTexts(document, entities);
  if (values.length <= 1) {
    return values[0] ?? null;
  }

  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function pushEvidence(
  evidence: FieldEvidence[],
  fieldPath: string,
  document: DocumentAiDocument,
  entity: DocumentAiEntity | null
) {
  if (!entity) {
    return;
  }

  const snippet = entitySnippet(document, entity);
  if (!snippet) {
    return;
  }

  evidence.push({
    fieldPath,
    snippet,
    sectionKey: entity.pageAnchor?.pageRefs?.[0]?.page
      ? `page:${entity.pageAnchor.pageRefs[0].page}`
      : null,
    confidence: getConfidence(entity)
  });
}

function pushEvidenceForEntities(
  evidence: FieldEvidence[],
  fieldPath: string,
  document: DocumentAiDocument,
  entities: DocumentAiEntity[]
) {
  for (const entity of orderEntitiesByDocumentPosition(entities)) {
    pushEvidence(evidence, fieldPath, document, entity);
  }
}

function averageConfidence(evidence: FieldEvidence[]) {
  const confidences = evidence
    .map((entry) => entry.confidence)
    .filter((value): value is number => typeof value === "number");

  if (confidences.length === 0) {
    return null;
  }

  return Number(
    (confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(4)
  );
}

function addConflictIfNeeded<T>(
  conflicts: string[],
  fieldPath: string,
  entities: DocumentAiEntity[],
  document: DocumentAiDocument,
  mapper: (document: DocumentAiDocument, entity: DocumentAiEntity) => T | null
) {
  const distinctValues = new Set(
    entities
      .map((entity) => mapper(document, entity))
      .filter((value): value is T => value !== null && value !== undefined)
      .map((value) => JSON.stringify(value))
  );

  if (distinctValues.size > 1 && !conflicts.includes(fieldPath)) {
    conflicts.push(fieldPath);
  }
}

function parseDeliverablesFromSummary(summary: string | null) {
  if (!summary) {
    return [];
  }

  const deliverableMatches: Array<{
    index: number;
    channel: string;
    noun: string;
    quantity: number;
  }> = [];
  const patterns = [
    {
      pattern: /(\d+)\s+instagram\s+(post|story|stories|reel|reels)/gi,
      channel: "Instagram"
    },
    {
      pattern: /(\d+)\s+tiktok\s+(video|videos|post|posts|reel|reels)/gi,
      channel: "TikTok"
    },
    {
      pattern: /(\d+)\s+youtube\s+(integration|video|videos|short|shorts)/gi,
      channel: "YouTube"
    }
  ];

  for (const { pattern, channel } of patterns) {
    for (const match of summary.matchAll(pattern)) {
      const quantity = Number.parseInt(match[1] ?? "1", 10);
      const noun = match[2] ?? "deliverable";
      deliverableMatches.push({
        index: match.index ?? Number.MAX_SAFE_INTEGER,
        channel,
        noun,
        quantity: Number.isFinite(quantity) ? quantity : 1
      });
    }
  }

  const deliverables: ReturnType<typeof createEmptyTerms>["deliverables"] = deliverableMatches
    .sort((left, right) => left.index - right.index)
    .map((match) => ({
      id: randomUUID(),
      title: `${match.channel} ${match.noun}`.replace(/\b\w/g, (value) => value.toUpperCase()),
      dueDate: null,
      channel: match.channel,
      quantity: match.quantity,
      status: "pending",
      description: null
    }));

  if (deliverables.length === 0) {
    deliverables.push({
      id: randomUUID(),
      title: "Contract deliverable",
      dueDate: null,
      channel: null,
      quantity: 1,
      status: "pending",
      description: summary
    });
  }

  return deliverables;
}

export function hasMeaningfulContractExtraction(extraction: ExtractionPipelineResult) {
  return Boolean(
    extraction.data.brandName ||
      extraction.data.campaignName ||
      extraction.data.paymentAmount !== null ||
      extraction.data.paymentTerms ||
      extraction.data.usageRights ||
      extraction.data.deliverables.length > 0
  );
}

function collectEvidenceSnippets(extraction: ExtractionPipelineResult, fieldPath: string) {
  const seen = new Set<string>();
  const snippets: string[] = [];

  for (const entry of extraction.evidence) {
    if (entry.fieldPath !== fieldPath) {
      continue;
    }

    const snippet = normalizeString(entry.snippet);
    const key = snippet?.toLowerCase();
    if (!snippet || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    snippets.push(snippet);
  }

  return snippets;
}

function hasRepeatedClauseEvidence(snippetsByField: Record<string, string[]>) {
  return CONSOLIDATED_CLAUSE_FIELDS.some((field) => snippetsByField[field]?.length > 1);
}

function appendUniqueNote(notes: string | null, nextNote: string | null) {
  const cleanedNext = normalizeString(nextNote);
  if (!cleanedNext) {
    return notes;
  }

  const cleanedExisting = normalizeString(notes);
  if (!cleanedExisting) {
    return cleanedNext;
  }

  if (cleanedExisting.toLowerCase().includes(cleanedNext.toLowerCase())) {
    return cleanedExisting;
  }

  return `${cleanedExisting}\n\n${cleanedNext}`;
}

function updateGenericDeliverableSummary(
  deliverables: ExtractionPipelineResult["data"]["deliverables"],
  summary: string | null
) {
  const cleanedSummary = normalizeString(summary);
  if (!cleanedSummary) {
    return deliverables;
  }

  if (deliverables.length === 0) {
    return [
      {
        id: randomUUID(),
        title: "Contract deliverable",
        dueDate: null,
        channel: null,
        quantity: 1,
        status: "pending" as const,
        description: cleanedSummary
      }
    ];
  }

  if (deliverables.length === 1 && deliverables[0]?.title === "Contract deliverable") {
    return [
      {
        ...deliverables[0],
        description: cleanedSummary
      }
    ];
  }

  return deliverables;
}

export async function consolidateContractClausesWithLlm(
  extraction: ExtractionPipelineResult
): Promise<ExtractionPipelineResult> {
  const snippetsByField = {
    usageRights: collectEvidenceSnippets(extraction, "usageRights"),
    exclusivity: collectEvidenceSnippets(extraction, "exclusivity"),
    deliverables: collectEvidenceSnippets(extraction, "deliverables"),
    termination: collectEvidenceSnippets(extraction, "termination"),
    notes: collectEvidenceSnippets(extraction, "notes")
  };

  if (!hasLlmKey() || !hasRepeatedClauseEvidence(snippetsByField)) {
    return extraction;
  }

  try {
    const consolidated = await consolidateClausesWithLlm({
      ...snippetsByField,
      fallback: {
        usageRights: extraction.data.usageRights,
        exclusivity: extraction.data.exclusivity,
        deliverablesSummary: snippetsByField.deliverables.join("\n") || null,
        termination: extraction.data.termination,
        notes: extraction.data.notes
      }
    });
    const deliverablesSummary = normalizeString(consolidated.deliverablesSummary);
    const notesWithConsolidation = appendUniqueNote(
      appendUniqueNote(extraction.data.notes, consolidated.notes),
      deliverablesSummary ? `Deliverables: ${deliverablesSummary}` : null
    );

    return {
      ...extraction,
      model: `${extraction.model}+llm:${consolidated.model}`,
      data: {
        ...extraction.data,
        usageRights: normalizeString(consolidated.usageRights) ?? extraction.data.usageRights,
        exclusivity: normalizeString(consolidated.exclusivity) ?? extraction.data.exclusivity,
        deliverables: updateGenericDeliverableSummary(
          extraction.data.deliverables,
          deliverablesSummary
        ),
        termination: normalizeString(consolidated.termination) ?? extraction.data.termination,
        notes: notesWithConsolidation
      }
    };
  } catch (error) {
    console.warn("[document-ai-contract] clause_consolidation_failed", {
      at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown clause consolidation error"
    });
    return extraction;
  }
}

export function mapDocumentAiContractToExtraction(input: {
  document: DocumentAiDocument;
  deal: Pick<DealRecord, "brandName" | "campaignName"> | { brandName: string | null; campaignName: string | null };
}) {
  const entities = input.document.entities ?? [];
  const evidence: FieldEvidence[] = [];
  const conflicts: string[] = [];
  const terms = createEmptyTerms(input.deal);

  const brandNameEntities = collectEntities(entities, "brand_name");
  const campaignNameEntities = collectEntities(entities, "campaign_name");
  const paymentAmountEntities = collectEntities(entities, "payment_amount");
  const currencyEntities = collectEntities(entities, "currency", "currency_type");
  const paymentTermsEntities = collectEntities(entities, "payment_terms");
  const paymentStructureEntities = collectEntities(entities, "payment_structure");
  const paymentTriggerEntities = collectEntities(entities, "payment_trigger");
  const netTermsEntities = collectEntities(entities, "net_terms_days");
  const usageRightsEntities = collectEntities(entities, "usage_rights");
  const usageDurationEntities = collectEntities(entities, "usage_duration");
  const usageTerritoryEntities = collectEntities(entities, "usage_territory");
  const paidUsageEntities = collectEntities(entities, "paid_usage_allowed");
  const whitelistingEntities = collectEntities(entities, "whitelisting_allowed");
  const exclusivityEntities = collectEntities(entities, "exclusivity_summary");
  const exclusivityCategoryEntities = collectEntities(entities, "exclusivity_category");
  const exclusivityDurationEntities = collectEntities(entities, "exclusivity_duration");
  const deliverablesSummaryEntities = collectEntities(entities, "deliverables_summary");
  const revisionRoundsEntities = collectEntities(entities, "revision_rounds");
  const terminationEntities = collectEntities(entities, "termination_summary");
  const terminationNoticeEntities = collectEntities(entities, "termination_notice");
  const governingLawEntities = collectEntities(entities, "governing_law");
  const notesEntities = collectEntities(entities, "notes", "note", "additional_notes");

  const brandNameEntity = pickBestEntity(brandNameEntities);
  const campaignNameEntity = pickBestEntity(campaignNameEntities);
  const paymentAmountEntity = pickBestEntity(paymentAmountEntities);
  const currencyEntity = pickBestEntity(currencyEntities);
  const paymentTermsEntity = pickBestEntity(paymentTermsEntities);
  const paymentStructureEntity = pickBestEntity(paymentStructureEntities);
  const paymentTriggerEntity = pickBestEntity(paymentTriggerEntities);
  const netTermsEntity = pickBestEntity(netTermsEntities);
  const usageDurationEntity = pickBestEntity(usageDurationEntities);
  const usageTerritoryEntity = pickBestEntity(usageTerritoryEntities);
  const paidUsageEntity = pickBestEntity(paidUsageEntities);
  const whitelistingEntity = pickBestEntity(whitelistingEntities);
  const exclusivityCategoryEntity = pickBestEntity(exclusivityCategoryEntities);
  const exclusivityDurationEntity = pickBestEntity(exclusivityDurationEntities);
  const revisionRoundsEntity = pickBestEntity(revisionRoundsEntities);
  const terminationNoticeEntity = pickBestEntity(terminationNoticeEntities);
  const governingLawEntity = pickBestEntity(governingLawEntities);

  terms.brandName = brandNameEntity ? entityText(input.document, brandNameEntity) : terms.brandName;
  terms.campaignName = campaignNameEntity
    ? entityText(input.document, campaignNameEntity)
    : terms.campaignName;
  terms.paymentAmount = paymentAmountEntity ? entityNumber(input.document, paymentAmountEntity) : null;
  terms.currency = currencyEntity ? entityText(input.document, currencyEntity) : null;
  terms.paymentTerms = paymentTermsEntity ? entityText(input.document, paymentTermsEntity) : null;
  terms.paymentStructure = paymentStructureEntity
    ? entityText(input.document, paymentStructureEntity)
    : null;
  terms.paymentTrigger = paymentTriggerEntity
    ? entityText(input.document, paymentTriggerEntity)
    : null;
  terms.netTermsDays = netTermsEntity ? entityNumber(input.document, netTermsEntity) : null;
  terms.usageRights = combineClauseEntities(input.document, usageRightsEntities);
  terms.usageDuration = usageDurationEntity
    ? entityText(input.document, usageDurationEntity)
    : null;
  terms.usageTerritory = usageTerritoryEntity
    ? entityText(input.document, usageTerritoryEntity)
    : null;
  terms.usageRightsPaidAllowed = paidUsageEntity
    ? entityBoolean(input.document, paidUsageEntity)
    : null;
  terms.whitelistingAllowed = whitelistingEntity
    ? entityBoolean(input.document, whitelistingEntity)
    : null;
  terms.exclusivity = combineClauseEntities(input.document, exclusivityEntities);
  terms.exclusivityApplies = terms.exclusivity ? true : null;
  terms.exclusivityCategory = exclusivityCategoryEntity
    ? entityText(input.document, exclusivityCategoryEntity)
    : null;
  terms.exclusivityDuration = exclusivityDurationEntity
    ? entityText(input.document, exclusivityDurationEntity)
    : null;
  terms.deliverables = parseDeliverablesFromSummary(
    combineClauseEntities(input.document, deliverablesSummaryEntities)
  );
  terms.revisionRounds = revisionRoundsEntity
    ? entityNumber(input.document, revisionRoundsEntity)
    : null;
  terms.revisions =
    revisionRoundsEntity && terms.revisionRounds !== null
      ? `${terms.revisionRounds} rounds`
      : null;
  terms.termination = combineClauseEntities(input.document, terminationEntities);
  terms.terminationAllowed = terms.termination ? true : null;
  terms.terminationNotice = terminationNoticeEntity
    ? entityText(input.document, terminationNoticeEntity)
    : null;
  terms.governingLaw = governingLawEntity ? entityText(input.document, governingLawEntity) : null;
  terms.notes = combineClauseEntities(input.document, notesEntities);

  pushEvidence(evidence, "brandName", input.document, brandNameEntity);
  pushEvidence(evidence, "campaignName", input.document, campaignNameEntity);
  pushEvidence(evidence, "paymentAmount", input.document, paymentAmountEntity);
  pushEvidence(evidence, "currency", input.document, currencyEntity);
  pushEvidence(evidence, "paymentTerms", input.document, paymentTermsEntity);
  pushEvidence(evidence, "paymentStructure", input.document, paymentStructureEntity);
  pushEvidence(evidence, "paymentTrigger", input.document, paymentTriggerEntity);
  pushEvidence(evidence, "netTermsDays", input.document, netTermsEntity);
  pushEvidenceForEntities(evidence, "usageRights", input.document, usageRightsEntities);
  pushEvidence(evidence, "usageDuration", input.document, usageDurationEntity);
  pushEvidence(evidence, "usageTerritory", input.document, usageTerritoryEntity);
  pushEvidence(evidence, "usageRightsPaidAllowed", input.document, paidUsageEntity);
  pushEvidence(evidence, "whitelistingAllowed", input.document, whitelistingEntity);
  pushEvidenceForEntities(evidence, "exclusivity", input.document, exclusivityEntities);
  pushEvidence(evidence, "exclusivityCategory", input.document, exclusivityCategoryEntity);
  pushEvidence(evidence, "exclusivityDuration", input.document, exclusivityDurationEntity);
  pushEvidenceForEntities(evidence, "deliverables", input.document, deliverablesSummaryEntities);
  pushEvidence(evidence, "revisionRounds", input.document, revisionRoundsEntity);
  pushEvidenceForEntities(evidence, "termination", input.document, terminationEntities);
  pushEvidence(evidence, "terminationNotice", input.document, terminationNoticeEntity);
  pushEvidence(evidence, "governingLaw", input.document, governingLawEntity);
  pushEvidenceForEntities(evidence, "notes", input.document, notesEntities);

  addConflictIfNeeded(conflicts, "brandName", brandNameEntities, input.document, entityText);
  addConflictIfNeeded(conflicts, "campaignName", campaignNameEntities, input.document, entityText);
  addConflictIfNeeded(
    conflicts,
    "paymentAmount",
    paymentAmountEntities,
    input.document,
    entityNumber
  );
  addConflictIfNeeded(conflicts, "currency", currencyEntities, input.document, entityText);
  addConflictIfNeeded(conflicts, "paymentTerms", paymentTermsEntities, input.document, entityText);

  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    model: CONTRACT_MODEL,
    confidence: averageConfidence(evidence),
    data: terms,
    evidence,
    conflicts
  } satisfies ExtractionPipelineResult;
}

export async function extractContractTermsWithDocumentAiDetailed(input: {
  bytes: Buffer;
  mimeType: string;
  deal: Pick<DealRecord, "brandName" | "campaignName"> | { brandName: string | null; campaignName: string | null };
}) {
  const response = await processDocumentWithDocumentAi({
    processor: "contract",
    bytes: input.bytes,
    mimeType: input.mimeType,
    imagelessMode: true,
    fieldMaskPaths: ["text", "entities"]
  });

  const extraction = mapDocumentAiContractToExtraction({
    document: response.document ?? {},
    deal: input.deal
  });

  return {
    extraction: await consolidateContractClausesWithLlm(extraction),
    rawResponse: response.rawResponse,
    processor: response.processor,
    pageCount: response.pageCount,
    entityCount: response.entityCount
  };
}
