/**
 * LLM tasks for brief extraction and brief generation.
 * This file keeps the brief-specific prompts and normalization separate from the document extraction and summary tasks.
 */
import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptQuotedText
} from "@/lib/ai/prompting";
import type {
  BriefData,
  DealAggregate,
  DocumentKind,
  GeneratedBrief
} from "@/lib/types";
import {
  briefExtractionSystemPrompt,
  briefGenerationSystemPrompt
} from "@/lib/analysis/prompts";
import {
  asString,
  asStringArray,
  buildBriefContext,
  normalizeBriefSections
} from "@/lib/analysis/normalizers";

import {
  briefExtractionResponseSchema,
  generatedBriefResponseSchema,
  getLlmModel,
  requestStructured
} from "./shared";

// fallow-ignore-next-line complexity
export async function extractBriefWithLlm(
  text: string,
  kind: DocumentKind,
  fallback: BriefData
): Promise<BriefData> {
  try {
    const payload = await requestStructured(
      "extract_section",
      briefExtractionSystemPrompt(),
      joinPromptSections([
        {
          tag: "document_metadata",
          content: promptBullets([
            `Today: ${isoDateContext()}`,
            `Document kind: ${kind}`
          ])
        },
        {
          tag: "document_text",
          content: promptQuotedText(text.slice(0, 6000))
        },
        {
          tag: "task",
          content: "Extract the campaign-brief fields from the document above."
        }
      ]),
      briefExtractionResponseSchema,
      {
        campaignOverview: fallback.campaignOverview,
        campaignCode: fallback.campaignCode,
        jobNumber: fallback.jobNumber,
        referenceId: fallback.referenceId,
        messagingPoints: fallback.messagingPoints,
        talkingPoints: fallback.talkingPoints,
        creativeConceptOverview: fallback.creativeConceptOverview,
        requiredClaims: fallback.requiredClaims ?? [],
        brandGuidelines: fallback.brandGuidelines,
        approvalRequirements: fallback.approvalRequirements,
        revisionRequirements: fallback.revisionRequirements,
        targetAudience: fallback.targetAudience,
        toneAndStyle: fallback.toneAndStyle,
        deliverablesSummary: fallback.deliverablesSummary,
        deliverablePlatforms: fallback.deliverablePlatforms ?? [],
        creatorHandle: fallback.creatorHandle,
        postingSchedule: fallback.postingSchedule,
        agreementStartDate: fallback.agreementStartDate,
        agreementEndDate: fallback.agreementEndDate,
        executionTargetDate: fallback.executionTargetDate,
        conceptDueDate: fallback.conceptDueDate,
        campaignLiveDate: fallback.campaignLiveDate,
        campaignFlight: fallback.campaignFlight,
        draftDueDate: fallback.draftDueDate,
        contentDueDate: fallback.contentDueDate,
        postDuration: fallback.postDuration,
        amplificationPeriod: fallback.amplificationPeriod,
        usageNotes: fallback.usageNotes,
        disclosureRequirements: fallback.disclosureRequirements ?? [],
        competitorRestrictions: fallback.competitorRestrictions ?? [],
        linksAndAssets: fallback.linksAndAssets ?? [],
        promoCode: fallback.promoCode,
        paymentNotes: fallback.paymentNotes,
        paymentSchedule: fallback.paymentSchedule,
        paymentRequirements: fallback.paymentRequirements,
        reportingRequirements: fallback.reportingRequirements,
        campaignNotes: fallback.campaignNotes,
        doNotMention: fallback.doNotMention,
        brandContactName: fallback.brandContactName,
        brandContactTitle: fallback.brandContactTitle,
        brandContactEmail: fallback.brandContactEmail,
        brandContactPhone: fallback.brandContactPhone,
        agencyContactName: fallback.agencyContactName,
        agencyContactTitle: fallback.agencyContactTitle,
        agencyContactEmail: fallback.agencyContactEmail,
        agencyContactPhone: fallback.agencyContactPhone
      },
      {
        documentKind: kind,
        purpose: "brief_extraction"
      }
    );

    return {
      campaignOverview: asString(payload.campaignOverview) ?? fallback.campaignOverview,
      campaignCode: asString(payload.campaignCode) ?? fallback.campaignCode,
      jobNumber: asString(payload.jobNumber) ?? fallback.jobNumber,
      referenceId: asString(payload.referenceId) ?? fallback.referenceId,
      messagingPoints: asStringArray(payload.messagingPoints).length > 0
        ? asStringArray(payload.messagingPoints)
        : fallback.messagingPoints,
      talkingPoints: asStringArray(payload.talkingPoints).length > 0
        ? asStringArray(payload.talkingPoints)
        : fallback.talkingPoints,
      creativeConceptOverview: asString(payload.creativeConceptOverview) ?? fallback.creativeConceptOverview,
      requiredClaims: asStringArray(payload.requiredClaims).length > 0
        ? asStringArray(payload.requiredClaims)
        : (fallback.requiredClaims ?? []),
      brandGuidelines: asString(payload.brandGuidelines) ?? fallback.brandGuidelines,
      approvalRequirements: asString(payload.approvalRequirements) ?? fallback.approvalRequirements,
      revisionRequirements: asString(payload.revisionRequirements) ?? fallback.revisionRequirements,
      targetAudience: asString(payload.targetAudience) ?? fallback.targetAudience,
      toneAndStyle: asString(payload.toneAndStyle) ?? fallback.toneAndStyle,
      deliverablesSummary: asString(payload.deliverablesSummary) ?? fallback.deliverablesSummary,
      deliverablePlatforms: asStringArray(payload.deliverablePlatforms).length > 0
        ? asStringArray(payload.deliverablePlatforms)
        : (fallback.deliverablePlatforms ?? []),
      creatorHandle: asString(payload.creatorHandle) ?? fallback.creatorHandle,
      postingSchedule: asString(payload.postingSchedule) ?? fallback.postingSchedule,
      agreementStartDate: asString(payload.agreementStartDate) ?? fallback.agreementStartDate,
      agreementEndDate: asString(payload.agreementEndDate) ?? fallback.agreementEndDate,
      executionTargetDate: asString(payload.executionTargetDate) ?? fallback.executionTargetDate,
      conceptDueDate: asString(payload.conceptDueDate) ?? fallback.conceptDueDate,
      campaignLiveDate: asString(payload.campaignLiveDate) ?? fallback.campaignLiveDate,
      campaignFlight: asString(payload.campaignFlight) ?? fallback.campaignFlight,
      draftDueDate: asString(payload.draftDueDate) ?? fallback.draftDueDate,
      contentDueDate: asString(payload.contentDueDate) ?? fallback.contentDueDate,
      postDuration: asString(payload.postDuration) ?? fallback.postDuration,
      amplificationPeriod: asString(payload.amplificationPeriod) ?? fallback.amplificationPeriod,
      usageNotes: asString(payload.usageNotes) ?? fallback.usageNotes,
      disclosureRequirements: asStringArray(payload.disclosureRequirements).length > 0
        ? asStringArray(payload.disclosureRequirements)
        : (fallback.disclosureRequirements ?? []),
      competitorRestrictions: asStringArray(payload.competitorRestrictions).length > 0
        ? asStringArray(payload.competitorRestrictions)
        : (fallback.competitorRestrictions ?? []),
      linksAndAssets: asStringArray(payload.linksAndAssets).length > 0
        ? asStringArray(payload.linksAndAssets)
        : (fallback.linksAndAssets ?? []),
      promoCode: asString(payload.promoCode) ?? fallback.promoCode,
      paymentNotes: asString(payload.paymentNotes) ?? fallback.paymentNotes,
      paymentSchedule: asString(payload.paymentSchedule) ?? fallback.paymentSchedule,
      paymentRequirements: asString(payload.paymentRequirements) ?? fallback.paymentRequirements,
      reportingRequirements: asString(payload.reportingRequirements) ?? fallback.reportingRequirements,
      campaignNotes: asString(payload.campaignNotes) ?? fallback.campaignNotes,
      doNotMention: asStringArray(payload.doNotMention).length > 0
        ? asStringArray(payload.doNotMention)
        : fallback.doNotMention,
      brandContactName: asString(payload.brandContactName) ?? fallback.brandContactName,
      brandContactTitle: asString(payload.brandContactTitle) ?? fallback.brandContactTitle,
      brandContactEmail: asString(payload.brandContactEmail) ?? fallback.brandContactEmail,
      brandContactPhone: asString(payload.brandContactPhone) ?? fallback.brandContactPhone,
      agencyContactName: asString(payload.agencyContactName) ?? fallback.agencyContactName,
      agencyContactTitle: asString(payload.agencyContactTitle) ?? fallback.agencyContactTitle,
      agencyContactEmail: asString(payload.agencyContactEmail) ?? fallback.agencyContactEmail,
      agencyContactPhone: asString(payload.agencyContactPhone) ?? fallback.agencyContactPhone,
      sourceDocumentIds: fallback.sourceDocumentIds
    };
  } catch {
    return fallback;
  }
}

export async function generateBriefWithLlm(
  aggregate: DealAggregate,
  options: { mode?: "brief" | "summary" } = {}
): Promise<GeneratedBrief> {
  const mode = options.mode ?? "brief";
  const payload = await requestStructured(
    "generate_brief",
    briefGenerationSystemPrompt(),
    joinPromptSections([
      {
        tag: "partnership_context",
        content: promptQuotedText(buildBriefContext(aggregate))
      },
      {
        tag: "task",
        content:
          mode === "summary"
            ? "Generate a concise creator-facing summary of the uploaded campaign brief data from the partnership context above. Prioritize key brief terms: objective, deliverables, dates, messaging, creative requirements, approvals, usage notes, disclosures, and avoid-list items. Do not invent missing details."
            : "Generate the creator-facing campaign brief from the partnership context above."
      }
    ]),
    generatedBriefResponseSchema,
    { sections: [] },
    {
      requestType: "generate_brief",
      dealId: aggregate.deal.id
    }
  );

  const sections = normalizeBriefSections(payload.sections);

  return {
    sections: sections.length > 0 ? sections : [],
    generatedAt: new Date().toISOString(),
    modelVersion: `llm:${mode}:${getLlmModel("generate_brief")}`
  };
}
