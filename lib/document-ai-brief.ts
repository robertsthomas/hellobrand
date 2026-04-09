import type { protos } from "@google-cloud/documentai";

import { createEmptyTerms } from "@/lib/document-pipeline-shared";
import {
  extractDocumentAiTextAnchor,
  processDocumentWithDocumentAi
} from "@/lib/document-ai";
import type { BriefData, DealRecord, ExtractionPipelineResult, FieldEvidence } from "@/lib/types";

type DocumentAiDocument = protos.google.cloud.documentai.v1.IDocument;
type DocumentAiEntity = protos.google.cloud.documentai.v1.Document.IEntity;

const BRIEF_SCHEMA_VERSION = "document-ai-brief-v1";
const BRIEF_MODEL = "document_ai:brief_custom_extractor";

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

function getConfidence(entity: DocumentAiEntity | null | undefined) {
  return typeof entity?.confidence === "number" ? entity.confidence : null;
}

function collectEntities(entities: DocumentAiEntity[], ...types: string[]) {
  return entities.filter((entity) => entity.type && types.includes(entity.type));
}

function pickBestEntity(entities: DocumentAiEntity[]) {
  return [...entities].sort((left, right) => {
    const leftConfidence = getConfidence(left) ?? -1;
    const rightConfidence = getConfidence(right) ?? -1;
    return rightConfidence - leftConfidence;
  })[0] ?? null;
}

function splitListValue(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/\n|;|•|●|–|—|(?:^|\s)-\s|,(?=\s*[A-Z0-9])/)
    .map((item) => item.replace(/^\d+\.\s*/, "").trim())
    .filter((item, index, array) => item.length > 2 && array.indexOf(item) === index);
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

function addConflictIfNeeded(
  conflicts: string[],
  fieldPath: string,
  entities: DocumentAiEntity[],
  document: DocumentAiDocument,
  mapper: (document: DocumentAiDocument, entity: DocumentAiEntity) => string | null
) {
  const distinctValues = new Set(
    entities
      .map((entity) => mapper(document, entity))
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())
  );

  if (distinctValues.size > 1 && !conflicts.includes(fieldPath)) {
    conflicts.push(fieldPath);
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

function findListEntities(entities: DocumentAiEntity[], ...types: string[]) {
  const matches = collectEntities(entities, ...types);
  if (matches.length > 0) {
    return matches;
  }

  return [];
}

function firstNonEmptyList(document: DocumentAiDocument, entities: DocumentAiEntity[]) {
  for (const entity of entities) {
    const items = splitListValue(entityText(document, entity));
    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

export function hasMeaningfulBriefExtraction(extraction: ExtractionPipelineResult) {
  const briefData = extraction.data.briefData;
  return Boolean(
    briefData &&
      (briefData.campaignOverview ||
        briefData.messagingPoints.length > 0 ||
        briefData.talkingPoints.length > 0 ||
        briefData.creativeConceptOverview ||
        briefData.brandGuidelines ||
        briefData.approvalRequirements ||
        briefData.targetAudience ||
        briefData.toneAndStyle ||
        briefData.doNotMention.length > 0)
  );
}

export function mapDocumentAiBriefToExtraction(input: {
  document: DocumentAiDocument;
  deal:
    | Pick<DealRecord, "brandName" | "campaignName">
    | { brandName: string | null; campaignName: string | null };
}) {
  const entities = input.document.entities ?? [];
  const evidence: FieldEvidence[] = [];
  const conflicts: string[] = [];
  const terms = createEmptyTerms(input.deal);

  const campaignOverviewEntities = collectEntities(
    entities,
    "campaign_overview",
    "campaignOverview"
  );
  const messagingPointEntities = findListEntities(
    entities,
    "messaging_points",
    "messaging_point",
    "messagingPoints"
  );
  const talkingPointEntities = findListEntities(
    entities,
    "talking_points",
    "talking_point",
    "talkingPoints"
  );
  const creativeConceptEntities = collectEntities(
    entities,
    "creative_concept_overview",
    "creativeConceptOverview"
  );
  const brandGuidelineEntities = collectEntities(
    entities,
    "brand_guidelines",
    "brandGuidelines"
  );
  const approvalRequirementEntities = collectEntities(
    entities,
    "approval_requirements",
    "approvalRequirements"
  );
  const targetAudienceEntities = collectEntities(
    entities,
    "target_audience",
    "targetAudience"
  );
  const toneAndStyleEntities = collectEntities(
    entities,
    "tone_and_style",
    "toneAndStyle"
  );
  const doNotMentionEntities = findListEntities(
    entities,
    "do_not_mention",
    "doNotMention",
    "avoid_list"
  );

  const campaignOverviewEntity = pickBestEntity(campaignOverviewEntities);
  const creativeConceptEntity = pickBestEntity(creativeConceptEntities);
  const brandGuidelineEntity = pickBestEntity(brandGuidelineEntities);
  const approvalRequirementEntity = pickBestEntity(approvalRequirementEntities);
  const targetAudienceEntity = pickBestEntity(targetAudienceEntities);
  const toneAndStyleEntity = pickBestEntity(toneAndStyleEntities);

  const briefData: BriefData = {
    campaignOverview: campaignOverviewEntity
      ? entityText(input.document, campaignOverviewEntity)
      : null,
    messagingPoints: firstNonEmptyList(input.document, messagingPointEntities),
    talkingPoints: firstNonEmptyList(input.document, talkingPointEntities),
    creativeConceptOverview: creativeConceptEntity
      ? entityText(input.document, creativeConceptEntity)
      : null,
    brandGuidelines: brandGuidelineEntity ? entityText(input.document, brandGuidelineEntity) : null,
    approvalRequirements: approvalRequirementEntity
      ? entityText(input.document, approvalRequirementEntity)
      : null,
    targetAudience: targetAudienceEntity ? entityText(input.document, targetAudienceEntity) : null,
    toneAndStyle: toneAndStyleEntity ? entityText(input.document, toneAndStyleEntity) : null,
    doNotMention: firstNonEmptyList(input.document, doNotMentionEntities),
    sourceDocumentIds: []
  };

  terms.briefData = briefData;

  pushEvidence(evidence, "briefData.campaignOverview", input.document, campaignOverviewEntity);
  for (const entity of messagingPointEntities) {
    pushEvidence(evidence, "briefData.messagingPoints", input.document, entity);
  }
  for (const entity of talkingPointEntities) {
    pushEvidence(evidence, "briefData.talkingPoints", input.document, entity);
  }
  pushEvidence(
    evidence,
    "briefData.creativeConceptOverview",
    input.document,
    creativeConceptEntity
  );
  pushEvidence(evidence, "briefData.brandGuidelines", input.document, brandGuidelineEntity);
  pushEvidence(
    evidence,
    "briefData.approvalRequirements",
    input.document,
    approvalRequirementEntity
  );
  pushEvidence(evidence, "briefData.targetAudience", input.document, targetAudienceEntity);
  pushEvidence(evidence, "briefData.toneAndStyle", input.document, toneAndStyleEntity);
  for (const entity of doNotMentionEntities) {
    pushEvidence(evidence, "briefData.doNotMention", input.document, entity);
  }

  addConflictIfNeeded(
    conflicts,
    "briefData.campaignOverview",
    campaignOverviewEntities,
    input.document,
    entityText
  );
  addConflictIfNeeded(
    conflicts,
    "briefData.creativeConceptOverview",
    creativeConceptEntities,
    input.document,
    entityText
  );
  addConflictIfNeeded(
    conflicts,
    "briefData.brandGuidelines",
    brandGuidelineEntities,
    input.document,
    entityText
  );
  addConflictIfNeeded(
    conflicts,
    "briefData.approvalRequirements",
    approvalRequirementEntities,
    input.document,
    entityText
  );
  addConflictIfNeeded(
    conflicts,
    "briefData.targetAudience",
    targetAudienceEntities,
    input.document,
    entityText
  );
  addConflictIfNeeded(
    conflicts,
    "briefData.toneAndStyle",
    toneAndStyleEntities,
    input.document,
    entityText
  );

  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    model: BRIEF_MODEL,
    confidence: averageConfidence(evidence),
    data: terms,
    evidence,
    conflicts
  } satisfies ExtractionPipelineResult;
}

export async function extractBriefTermsWithDocumentAiDetailed(input: {
  bytes: Buffer | Uint8Array;
  mimeType: string;
  deal:
    | Pick<DealRecord, "brandName" | "campaignName">
    | { brandName: string | null; campaignName: string | null };
}) {
  const response = await processDocumentWithDocumentAi({
    processor: "brief",
    bytes: input.bytes,
    mimeType: input.mimeType,
    skipHumanReview: true
  });

  if (!response.document) {
    throw new Error("Document AI brief processor returned no document payload.");
  }

  const extraction = mapDocumentAiBriefToExtraction({
    document: response.document,
    deal: input.deal
  });

  return {
    extraction,
    rawResponse: response.rawResponse,
    processor: response.processorName
  };
}
