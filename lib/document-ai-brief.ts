import { randomUUID } from "node:crypto";

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

function entityNumber(document: DocumentAiDocument, entity: DocumentAiEntity | null) {
  if (!entity) {
    return null;
  }

  if (typeof entity.normalizedValue?.integerValue === "number") {
    return entity.normalizedValue.integerValue;
  }

  if (typeof entity.normalizedValue?.floatValue === "number") {
    return entity.normalizedValue.floatValue;
  }

  const text = entityText(document, entity);
  if (!text) {
    return null;
  }

  const parsed = Number.parseFloat(text.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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

function pushEvidenceForEntities(
  evidence: FieldEvidence[],
  fieldPath: string,
  document: DocumentAiDocument,
  entities: DocumentAiEntity[]
) {
  for (const entity of entities) {
    pushEvidence(evidence, fieldPath, document, entity);
  }
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

function allListValues(document: DocumentAiDocument, entities: DocumentAiEntity[]) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const entity of entities) {
    for (const item of splitListValue(entityText(document, entity))) {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      values.push(item);
    }
  }

  return values;
}

function entityTexts(document: DocumentAiDocument, entities: DocumentAiEntity[]) {
  return entities
    .map((entity) => entityText(document, entity))
    .filter((value): value is string => Boolean(value));
}

function combineEntityTexts(document: DocumentAiDocument, entities: DocumentAiEntity[]) {
  const values = entityTexts(document, entities);
  return values.length > 0 ? values.join("\n") : null;
}

function firstEntityText(document: DocumentAiDocument, entities: DocumentAiEntity[]) {
  const entity = pickBestEntity(entities);
  return entity ? entityText(document, entity) : null;
}

function appendNoteBlock(notes: string | null, title: string, value: string | string[] | null) {
  const values = Array.isArray(value)
    ? value.map(normalizeString).filter((entry): entry is string => Boolean(entry))
    : [normalizeString(value)].filter((entry): entry is string => Boolean(entry));

  if (values.length === 0) {
    return notes;
  }

  const block = `${title}: ${values.join("; ")}`;
  if (!notes) {
    return block;
  }

  if (notes.toLowerCase().includes(block.toLowerCase())) {
    return notes;
  }

  return `${notes}\n\n${block}`;
}

function parseDeliverablesFromSummary(input: {
  summary: string | null;
  count: number | null;
  platforms: string[];
}) {
  const deliverableMatches: Array<{
    index: number;
    channel: string;
    noun: string;
    quantity: number;
  }> = [];
  const summary = input.summary ?? "";
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
      description: summary || null
    }));

  if (deliverables.length === 0 && (summary || input.count !== null || input.platforms.length > 0)) {
    const channel = input.platforms[0] ?? null;
    deliverables.push({
      id: randomUUID(),
      title: channel ? `${channel} deliverable` : "Brief deliverable",
      dueDate: null,
      channel,
      quantity: input.count ?? 1,
      status: "pending",
      description: summary || null
    });
  }

  return deliverables;
}

function disclosureObligationsFromEntities(
  document: DocumentAiDocument,
  entities: DocumentAiEntity[]
) {
  return entityTexts(document, entities).map((detail, index) => ({
    id: `document-ai-brief-disclosure-${index}-${randomUUID()}`,
    title: "Disclosure requirement",
    detail,
    source: "Document AI brief extraction"
  }));
}

function setDeliverableDueDate(
  deliverables: ReturnType<typeof createEmptyTerms>["deliverables"],
  dueDate: string | null
) {
  if (!dueDate || deliverables.length === 0) {
    return deliverables;
  }

  return deliverables.map((deliverable) => ({
    ...deliverable,
    dueDate: deliverable.dueDate ?? dueDate
  }));
}

export function hasMeaningfulBriefExtraction(extraction: ExtractionPipelineResult) {
  const briefData = extraction.data.briefData;
  return Boolean(
    briefData &&
      (briefData.campaignOverview ||
        briefData.messagingPoints.length > 0 ||
        briefData.talkingPoints.length > 0 ||
        briefData.creativeConceptOverview ||
        briefData.campaignObjective ||
        briefData.productName ||
        briefData.productDescription ||
        briefData.deliverablesSummary ||
        (briefData.contentPillars?.length ?? 0) > 0 ||
        (briefData.requiredElements?.length ?? 0) > 0 ||
        briefData.brandGuidelines ||
        briefData.approvalRequirements ||
        briefData.revisionRequirements ||
        briefData.targetAudience ||
        briefData.toneAndStyle ||
        briefData.visualDirection ||
        briefData.doNotMention.length > 0 ||
        (briefData.disclosureRequirements?.length ?? 0) > 0 ||
        (briefData.linksAndAssets?.length ?? 0) > 0 ||
        briefData.brandContactName ||
        briefData.brandContactEmail ||
        briefData.agencyContactName ||
        briefData.agencyContactEmail)
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

  const brandNameEntities = collectEntities(entities, "brand_name", "brandName");
  const campaignNameEntities = collectEntities(entities, "campaign_name", "campaignName");
  const campaignAgencyEntities = collectEntities(
    entities,
    "campaign_agency",
    "campaignAgency"
  );
  const productNameEntities = collectEntities(entities, "product_name", "productName");
  const productDescriptionEntities = collectEntities(
    entities,
    "product_description",
    "productDescription"
  );
  const campaignOverviewEntities = collectEntities(
    entities,
    "campaign_overview",
    "campaignOverview"
  );
  const campaignObjectiveEntities = collectEntities(
    entities,
    "campaign_objective",
    "campaignObjective"
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
  const contentPillarEntities = findListEntities(
    entities,
    "content_pillars",
    "content_pillar",
    "contentPillars"
  );
  const requiredElementEntities = findListEntities(
    entities,
    "required_elements",
    "required_element",
    "requiredElements"
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
  const revisionRequirementEntities = collectEntities(
    entities,
    "revision_requirements",
    "revisionRequirements"
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
  const visualDirectionEntities = collectEntities(
    entities,
    "visual_direction",
    "visualDirection"
  );
  const doNotMentionEntities = findListEntities(
    entities,
    "do_not_mention",
    "doNotMention",
    "avoid_list"
  );
  const deliverablesSummaryEntities = collectEntities(
    entities,
    "deliverables_summary",
    "deliverablesSummary"
  );
  const deliverableCountEntity = pickBestEntity(
    collectEntities(entities, "deliverable_count", "deliverableCount")
  );
  const deliverablePlatformEntities = findListEntities(
    entities,
    "deliverable_platforms",
    "deliverable_platform",
    "deliverablePlatforms"
  );
  const postingScheduleEntities = collectEntities(
    entities,
    "posting_schedule",
    "postingSchedule"
  );
  const campaignLiveDateEntities = collectEntities(
    entities,
    "campaign_live_date",
    "campaignLiveDate"
  );
  const draftDueDateEntities = collectEntities(entities, "draft_due_date", "draftDueDate");
  const contentDueDateEntities = collectEntities(
    entities,
    "content_due_date",
    "contentDueDate"
  );
  const usageNoteEntities = collectEntities(entities, "usage_notes", "usageNotes");
  const disclosureRequirementEntities = findListEntities(
    entities,
    "disclosure_requirements",
    "disclosure_requirement",
    "disclosureRequirements"
  );
  const competitorRestrictionEntities = findListEntities(
    entities,
    "competitor_restrictions",
    "competitor_restriction",
    "competitorRestrictions"
  );
  const linksAndAssetEntities = findListEntities(
    entities,
    "links_and_assets",
    "link_or_asset",
    "linksAndAssets"
  );
  const brandContactNameEntities = collectEntities(
    entities,
    "brand_contact_name",
    "brandContactName",
    "primary_contact_name",
    "primaryContactName"
  );
  const brandContactTitleEntities = collectEntities(
    entities,
    "brand_contact_title",
    "brandContactTitle",
    "primary_contact_title",
    "primaryContactTitle"
  );
  const brandContactEmailEntities = collectEntities(
    entities,
    "brand_contact_email",
    "brandContactEmail",
    "primary_contact_email",
    "primaryContactEmail"
  );
  const brandContactPhoneEntities = collectEntities(
    entities,
    "brand_contact_phone",
    "brandContactPhone",
    "primary_contact_phone",
    "primaryContactPhone"
  );
  const agencyContactNameEntities = collectEntities(
    entities,
    "agency_contact_name",
    "agencyContactName"
  );
  const agencyContactTitleEntities = collectEntities(
    entities,
    "agency_contact_title",
    "agencyContactTitle"
  );
  const agencyContactEmailEntities = collectEntities(
    entities,
    "agency_contact_email",
    "agencyContactEmail"
  );
  const agencyContactPhoneEntities = collectEntities(
    entities,
    "agency_contact_phone",
    "agencyContactPhone"
  );
  const promoCodeEntities = collectEntities(entities, "promo_code", "promoCode");
  const paymentNoteEntities = collectEntities(entities, "payment_notes", "paymentNotes");
  const campaignNoteEntities = collectEntities(entities, "campaign_notes", "campaignNotes");

  const brandNameEntity = pickBestEntity(brandNameEntities);
  const campaignNameEntity = pickBestEntity(campaignNameEntities);
  const campaignAgencyEntity = pickBestEntity(campaignAgencyEntities);
  const campaignOverviewEntity = pickBestEntity(campaignOverviewEntities);
  const campaignObjectiveEntity = pickBestEntity(campaignObjectiveEntities);
  const creativeConceptEntity = pickBestEntity(creativeConceptEntities);
  const brandGuidelineEntity = pickBestEntity(brandGuidelineEntities);
  const approvalRequirementEntity = pickBestEntity(approvalRequirementEntities);
  const revisionRequirementEntity = pickBestEntity(revisionRequirementEntities);
  const targetAudienceEntity = pickBestEntity(targetAudienceEntities);
  const toneAndStyleEntity = pickBestEntity(toneAndStyleEntities);
  const visualDirectionEntity = pickBestEntity(visualDirectionEntities);
  const postingScheduleEntity = pickBestEntity(postingScheduleEntities);
  const campaignLiveDateEntity = pickBestEntity(campaignLiveDateEntities);
  const draftDueDateEntity = pickBestEntity(draftDueDateEntities);
  const contentDueDateEntity = pickBestEntity(contentDueDateEntities);
  const usageNoteEntity = pickBestEntity(usageNoteEntities);
  const promoCodeEntity = pickBestEntity(promoCodeEntities);
  const paymentNoteEntity = pickBestEntity(paymentNoteEntities);
  const campaignNoteEntity = pickBestEntity(campaignNoteEntities);
  const brandContactNameEntity = pickBestEntity(brandContactNameEntities);
  const brandContactTitleEntity = pickBestEntity(brandContactTitleEntities);
  const brandContactEmailEntity = pickBestEntity(brandContactEmailEntities);
  const brandContactPhoneEntity = pickBestEntity(brandContactPhoneEntities);
  const agencyContactNameEntity = pickBestEntity(agencyContactNameEntities);
  const agencyContactTitleEntity = pickBestEntity(agencyContactTitleEntities);
  const agencyContactEmailEntity = pickBestEntity(agencyContactEmailEntities);
  const agencyContactPhoneEntity = pickBestEntity(agencyContactPhoneEntities);

  const productName = firstEntityText(input.document, productNameEntities);
  const productDescription = firstEntityText(input.document, productDescriptionEntities);
  const deliverablesSummary = combineEntityTexts(input.document, deliverablesSummaryEntities);
  const deliverablePlatforms = allListValues(input.document, deliverablePlatformEntities);
  const contentDueDate = contentDueDateEntity ? entityText(input.document, contentDueDateEntity) : null;
  const campaignLiveDate = campaignLiveDateEntity ? entityText(input.document, campaignLiveDateEntity) : null;
  const postingSchedule = postingScheduleEntity ? entityText(input.document, postingScheduleEntity) : null;

  terms.brandName = brandNameEntity ? entityText(input.document, brandNameEntity) : terms.brandName;
  terms.campaignName = campaignNameEntity ? entityText(input.document, campaignNameEntity) : terms.campaignName;
  terms.agencyName = campaignAgencyEntity ? entityText(input.document, campaignAgencyEntity) : null;
  terms.deliverables = setDeliverableDueDate(
    parseDeliverablesFromSummary({
      summary: deliverablesSummary,
      count: entityNumber(input.document, deliverableCountEntity),
      platforms: deliverablePlatforms
    }),
    contentDueDate
  );
  terms.usageRights = usageNoteEntity ? entityText(input.document, usageNoteEntity) : null;
  terms.usageChannels = deliverablePlatforms;
  terms.disclosureObligations = disclosureObligationsFromEntities(
    input.document,
    disclosureRequirementEntities
  );
  terms.competitorCategories = allListValues(input.document, competitorRestrictionEntities);
  terms.campaignDateWindow =
    postingSchedule || campaignLiveDate
      ? {
          startDate: campaignLiveDate,
          endDate: null,
          postingWindow: postingSchedule ?? campaignLiveDate
        }
      : null;

  const briefData: BriefData = {
    campaignOverview: campaignOverviewEntity
      ? entityText(input.document, campaignOverviewEntity)
      : null,
    campaignObjective: campaignObjectiveEntity
      ? entityText(input.document, campaignObjectiveEntity)
      : null,
    messagingPoints: allListValues(input.document, messagingPointEntities),
    talkingPoints: allListValues(input.document, talkingPointEntities),
    creativeConceptOverview: creativeConceptEntity
      ? entityText(input.document, creativeConceptEntity)
      : null,
    contentPillars: allListValues(input.document, contentPillarEntities),
    requiredElements: allListValues(input.document, requiredElementEntities),
    brandGuidelines: brandGuidelineEntity ? entityText(input.document, brandGuidelineEntity) : null,
    approvalRequirements: approvalRequirementEntity
      ? entityText(input.document, approvalRequirementEntity)
      : null,
    revisionRequirements: revisionRequirementEntity
      ? entityText(input.document, revisionRequirementEntity)
      : null,
    targetAudience: targetAudienceEntity ? entityText(input.document, targetAudienceEntity) : null,
    toneAndStyle: toneAndStyleEntity ? entityText(input.document, toneAndStyleEntity) : null,
    visualDirection: visualDirectionEntity ? entityText(input.document, visualDirectionEntity) : null,
    doNotMention: allListValues(input.document, doNotMentionEntities),
    productName,
    productDescription,
    deliverablesSummary,
    deliverablePlatforms,
    postingSchedule,
    campaignLiveDate,
    draftDueDate: draftDueDateEntity ? entityText(input.document, draftDueDateEntity) : null,
    contentDueDate,
    usageNotes: usageNoteEntity ? entityText(input.document, usageNoteEntity) : null,
    disclosureRequirements: allListValues(input.document, disclosureRequirementEntities),
    competitorRestrictions: allListValues(input.document, competitorRestrictionEntities),
    linksAndAssets: allListValues(input.document, linksAndAssetEntities),
    promoCode: promoCodeEntity ? entityText(input.document, promoCodeEntity) : null,
    paymentNotes: paymentNoteEntity ? entityText(input.document, paymentNoteEntity) : null,
    campaignNotes: campaignNoteEntity ? entityText(input.document, campaignNoteEntity) : null,
    brandContactName: brandContactNameEntity
      ? entityText(input.document, brandContactNameEntity)
      : null,
    brandContactTitle: brandContactTitleEntity
      ? entityText(input.document, brandContactTitleEntity)
      : null,
    brandContactEmail: brandContactEmailEntity
      ? entityText(input.document, brandContactEmailEntity)
      : null,
    brandContactPhone: brandContactPhoneEntity
      ? entityText(input.document, brandContactPhoneEntity)
      : null,
    agencyContactName: agencyContactNameEntity
      ? entityText(input.document, agencyContactNameEntity)
      : null,
    agencyContactTitle: agencyContactTitleEntity
      ? entityText(input.document, agencyContactTitleEntity)
      : null,
    agencyContactEmail: agencyContactEmailEntity
      ? entityText(input.document, agencyContactEmailEntity)
      : null,
    agencyContactPhone: agencyContactPhoneEntity
      ? entityText(input.document, agencyContactPhoneEntity)
      : null,
    sourceDocumentIds: []
  };

  terms.briefData = briefData;
  terms.notes = appendNoteBlock(terms.notes, "Product", productName);
  terms.notes = appendNoteBlock(terms.notes, "Product description", productDescription);
  terms.notes = appendNoteBlock(terms.notes, "Required elements", briefData.requiredElements ?? []);
  terms.notes = appendNoteBlock(terms.notes, "Visual direction", briefData.visualDirection ?? null);
  terms.notes = appendNoteBlock(terms.notes, "Brief notes", briefData.campaignNotes ?? null);
  terms.notes = appendNoteBlock(terms.notes, "Payment notes", briefData.paymentNotes ?? null);
  terms.notes = appendNoteBlock(terms.notes, "Brand contact", [
    briefData.brandContactName ?? "",
    briefData.brandContactTitle ?? "",
    briefData.brandContactEmail ?? "",
    briefData.brandContactPhone ?? ""
  ]);
  terms.notes = appendNoteBlock(terms.notes, "Agency contact", [
    briefData.agencyContactName ?? "",
    briefData.agencyContactTitle ?? "",
    briefData.agencyContactEmail ?? "",
    briefData.agencyContactPhone ?? ""
  ]);

  pushEvidence(evidence, "brandName", input.document, brandNameEntity);
  pushEvidence(evidence, "campaignName", input.document, campaignNameEntity);
  pushEvidence(evidence, "agencyName", input.document, campaignAgencyEntity);
  pushEvidence(evidence, "briefData.campaignOverview", input.document, campaignOverviewEntity);
  pushEvidence(evidence, "briefData.campaignObjective", input.document, campaignObjectiveEntity);
  for (const entity of messagingPointEntities) {
    pushEvidence(evidence, "briefData.messagingPoints", input.document, entity);
  }
  for (const entity of talkingPointEntities) {
    pushEvidence(evidence, "briefData.talkingPoints", input.document, entity);
  }
  pushEvidenceForEntities(evidence, "briefData.contentPillars", input.document, contentPillarEntities);
  pushEvidenceForEntities(evidence, "briefData.requiredElements", input.document, requiredElementEntities);
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
  pushEvidence(evidence, "briefData.revisionRequirements", input.document, revisionRequirementEntity);
  pushEvidence(evidence, "briefData.targetAudience", input.document, targetAudienceEntity);
  pushEvidence(evidence, "briefData.toneAndStyle", input.document, toneAndStyleEntity);
  pushEvidence(evidence, "briefData.visualDirection", input.document, visualDirectionEntity);
  for (const entity of doNotMentionEntities) {
    pushEvidence(evidence, "briefData.doNotMention", input.document, entity);
  }
  pushEvidenceForEntities(evidence, "briefData.productName", input.document, productNameEntities);
  pushEvidenceForEntities(evidence, "briefData.productDescription", input.document, productDescriptionEntities);
  pushEvidenceForEntities(evidence, "deliverables", input.document, deliverablesSummaryEntities);
  pushEvidence(evidence, "deliverables", input.document, deliverableCountEntity);
  pushEvidenceForEntities(evidence, "usageChannels", input.document, deliverablePlatformEntities);
  pushEvidence(evidence, "campaignDateWindow", input.document, postingScheduleEntity);
  pushEvidence(evidence, "campaignDateWindow", input.document, campaignLiveDateEntity);
  pushEvidence(evidence, "briefData.draftDueDate", input.document, draftDueDateEntity);
  pushEvidence(evidence, "briefData.contentDueDate", input.document, contentDueDateEntity);
  pushEvidence(evidence, "usageRights", input.document, usageNoteEntity);
  pushEvidenceForEntities(evidence, "disclosureObligations", input.document, disclosureRequirementEntities);
  pushEvidenceForEntities(evidence, "competitorCategories", input.document, competitorRestrictionEntities);
  pushEvidenceForEntities(evidence, "briefData.linksAndAssets", input.document, linksAndAssetEntities);
  pushEvidence(evidence, "briefData.promoCode", input.document, promoCodeEntity);
  pushEvidence(evidence, "briefData.paymentNotes", input.document, paymentNoteEntity);
  pushEvidence(evidence, "briefData.campaignNotes", input.document, campaignNoteEntity);
  pushEvidence(evidence, "briefData.brandContactName", input.document, brandContactNameEntity);
  pushEvidence(evidence, "briefData.brandContactTitle", input.document, brandContactTitleEntity);
  pushEvidence(evidence, "briefData.brandContactEmail", input.document, brandContactEmailEntity);
  pushEvidence(evidence, "briefData.brandContactPhone", input.document, brandContactPhoneEntity);
  pushEvidence(evidence, "briefData.agencyContactName", input.document, agencyContactNameEntity);
  pushEvidence(evidence, "briefData.agencyContactTitle", input.document, agencyContactTitleEntity);
  pushEvidence(evidence, "briefData.agencyContactEmail", input.document, agencyContactEmailEntity);
  pushEvidence(evidence, "briefData.agencyContactPhone", input.document, agencyContactPhoneEntity);

  addConflictIfNeeded(conflicts, "brandName", brandNameEntities, input.document, entityText);
  addConflictIfNeeded(conflicts, "campaignName", campaignNameEntities, input.document, entityText);
  addConflictIfNeeded(conflicts, "agencyName", campaignAgencyEntities, input.document, entityText);
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
    processor: response.processorName,
    pageCount: response.pageCount,
    entityCount: response.entityCount
  };
}
