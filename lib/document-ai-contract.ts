import { randomUUID } from "node:crypto";

import type { protos } from "@google-cloud/documentai";

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

  const deliverables: ReturnType<typeof createEmptyTerms>["deliverables"] = [];
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
      deliverables.push({
        id: randomUUID(),
        title: `${channel} ${noun}`.replace(/\b\w/g, (value) => value.toUpperCase()),
        dueDate: null,
        channel,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        status: "pending",
        description: null
      });
    }
  }

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

  const brandNameEntity = pickBestEntity(brandNameEntities);
  const campaignNameEntity = pickBestEntity(campaignNameEntities);
  const paymentAmountEntity = pickBestEntity(paymentAmountEntities);
  const currencyEntity = pickBestEntity(currencyEntities);
  const paymentTermsEntity = pickBestEntity(paymentTermsEntities);
  const paymentStructureEntity = pickBestEntity(paymentStructureEntities);
  const paymentTriggerEntity = pickBestEntity(paymentTriggerEntities);
  const netTermsEntity = pickBestEntity(netTermsEntities);
  const usageRightsEntity = pickBestEntity(usageRightsEntities);
  const usageDurationEntity = pickBestEntity(usageDurationEntities);
  const usageTerritoryEntity = pickBestEntity(usageTerritoryEntities);
  const paidUsageEntity = pickBestEntity(paidUsageEntities);
  const whitelistingEntity = pickBestEntity(whitelistingEntities);
  const exclusivityEntity = pickBestEntity(exclusivityEntities);
  const exclusivityCategoryEntity = pickBestEntity(exclusivityCategoryEntities);
  const exclusivityDurationEntity = pickBestEntity(exclusivityDurationEntities);
  const deliverablesSummaryEntity = pickBestEntity(deliverablesSummaryEntities);
  const revisionRoundsEntity = pickBestEntity(revisionRoundsEntities);
  const terminationEntity = pickBestEntity(terminationEntities);
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
  terms.usageRights = usageRightsEntity ? entityText(input.document, usageRightsEntity) : null;
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
  terms.exclusivity = exclusivityEntity ? entityText(input.document, exclusivityEntity) : null;
  terms.exclusivityApplies = terms.exclusivity ? true : null;
  terms.exclusivityCategory = exclusivityCategoryEntity
    ? entityText(input.document, exclusivityCategoryEntity)
    : null;
  terms.exclusivityDuration = exclusivityDurationEntity
    ? entityText(input.document, exclusivityDurationEntity)
    : null;
  terms.deliverables = parseDeliverablesFromSummary(
    deliverablesSummaryEntity ? entityText(input.document, deliverablesSummaryEntity) : null
  );
  terms.revisionRounds = revisionRoundsEntity
    ? entityNumber(input.document, revisionRoundsEntity)
    : null;
  terms.revisions =
    revisionRoundsEntity && terms.revisionRounds !== null
      ? `${terms.revisionRounds} rounds`
      : null;
  terms.termination = terminationEntity ? entityText(input.document, terminationEntity) : null;
  terms.terminationAllowed = terms.termination ? true : null;
  terms.terminationNotice = terminationNoticeEntity
    ? entityText(input.document, terminationNoticeEntity)
    : null;
  terms.governingLaw = governingLawEntity ? entityText(input.document, governingLawEntity) : null;

  pushEvidence(evidence, "brandName", input.document, brandNameEntity);
  pushEvidence(evidence, "campaignName", input.document, campaignNameEntity);
  pushEvidence(evidence, "paymentAmount", input.document, paymentAmountEntity);
  pushEvidence(evidence, "currency", input.document, currencyEntity);
  pushEvidence(evidence, "paymentTerms", input.document, paymentTermsEntity);
  pushEvidence(evidence, "paymentStructure", input.document, paymentStructureEntity);
  pushEvidence(evidence, "paymentTrigger", input.document, paymentTriggerEntity);
  pushEvidence(evidence, "netTermsDays", input.document, netTermsEntity);
  pushEvidence(evidence, "usageRights", input.document, usageRightsEntity);
  pushEvidence(evidence, "usageDuration", input.document, usageDurationEntity);
  pushEvidence(evidence, "usageTerritory", input.document, usageTerritoryEntity);
  pushEvidence(evidence, "usageRightsPaidAllowed", input.document, paidUsageEntity);
  pushEvidence(evidence, "whitelistingAllowed", input.document, whitelistingEntity);
  pushEvidence(evidence, "exclusivity", input.document, exclusivityEntity);
  pushEvidence(evidence, "exclusivityCategory", input.document, exclusivityCategoryEntity);
  pushEvidence(evidence, "exclusivityDuration", input.document, exclusivityDurationEntity);
  pushEvidence(evidence, "deliverables", input.document, deliverablesSummaryEntity);
  pushEvidence(evidence, "revisionRounds", input.document, revisionRoundsEntity);
  pushEvidence(evidence, "termination", input.document, terminationEntity);
  pushEvidence(evidence, "terminationNotice", input.document, terminationNoticeEntity);
  pushEvidence(evidence, "governingLaw", input.document, governingLawEntity);

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
  addConflictIfNeeded(conflicts, "usageRights", usageRightsEntities, input.document, entityText);
  addConflictIfNeeded(conflicts, "exclusivity", exclusivityEntities, input.document, entityText);

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

  return {
    extraction: mapDocumentAiContractToExtraction({
      document: response.document ?? {},
      deal: input.deal
    }),
    rawResponse: response.rawResponse,
    processor: response.processor,
    pageCount: response.pageCount,
    entityCount: response.entityCount
  };
}
