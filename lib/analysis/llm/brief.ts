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
        messagingPoints: fallback.messagingPoints,
        talkingPoints: fallback.talkingPoints,
        creativeConceptOverview: fallback.creativeConceptOverview,
        brandGuidelines: fallback.brandGuidelines,
        approvalRequirements: fallback.approvalRequirements,
        targetAudience: fallback.targetAudience,
        toneAndStyle: fallback.toneAndStyle,
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
      messagingPoints: asStringArray(payload.messagingPoints).length > 0
        ? asStringArray(payload.messagingPoints)
        : fallback.messagingPoints,
      talkingPoints: asStringArray(payload.talkingPoints).length > 0
        ? asStringArray(payload.talkingPoints)
        : fallback.talkingPoints,
      creativeConceptOverview: asString(payload.creativeConceptOverview) ?? fallback.creativeConceptOverview,
      brandGuidelines: asString(payload.brandGuidelines) ?? fallback.brandGuidelines,
      approvalRequirements: asString(payload.approvalRequirements) ?? fallback.approvalRequirements,
      targetAudience: asString(payload.targetAudience) ?? fallback.targetAudience,
      toneAndStyle: asString(payload.toneAndStyle) ?? fallback.toneAndStyle,
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
