/**
 * This file handles LLM-based document and brief analysis.
 * It builds prompts, chooses models, and normalizes structured LLM responses for the rest of the pipeline.
 */
import { z } from "zod";

import { aiCachePolicy, hasAiClient } from "@/lib/ai/gateway";
import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptQuotedText
} from "@/lib/ai/prompting";
import { runStructuredOpenRouterTask } from "@/lib/ai/structured";
import type {
  BriefData,
  DealAggregate,
  DocumentKind,
  DocumentSectionInput,
  DocumentSummaryResult,
  ExtractionPipelineResult,
  GeneratedBrief,
  RiskFlagRecord,
  SummaryType
} from "@/lib/types";
import {
  serializeDealSummarySections,
  stripInlineMarkdown,
  toPlainDealSummary
} from "@/lib/deal-summary";
import {
  extractSectionSystemPrompt,
  extractSectionUserPrompt,
  analyzeRisksSystemPrompt,
  analyzeRisksUserPrompt,
  summarySystemPrompt,
  summaryUserPrompt,
  briefExtractionSystemPrompt,
  briefGenerationSystemPrompt,
  clauseConsolidationSystemPrompt,
  clauseConsolidationUserPrompt,
  type ClauseConsolidationInput
} from "@/lib/analysis/prompts";
import {
  asString,
  asNumber,
  asStringArray,
  normalizeTerms,
  normalizeEvidence,
  normalizeRiskFlags,
  normalizeBriefSections,
  buildBriefContext
} from "@/lib/analysis/normalizers";

export type { ClauseConsolidationInput };

type LlmTask =
  | "extract_section"
  | "analyze_risks"
  | "generate_summary"
  | "generate_brief"
  | "consolidate_clauses";
type LlmRoute = {
  primary: string;
  fallbacks: string[];
};

const extractionResponseSchema = z.object({
  data: z.record(z.unknown()).default({}),
  evidence: z.array(
    z.object({
      fieldPath: z.string().trim().min(1),
      snippet: z.string().trim().min(1),
      confidence: z.number().nullable().optional()
    })
  ).default([]),
  confidence: z.number().nullable().optional()
});

const riskFlagsResponseSchema = z.object({
  riskFlags: z.array(
    z.object({
      category: z.enum([
        "usage_rights",
        "exclusivity",
        "payment_terms",
        "deliverables",
        "termination",
        "other"
      ]),
      title: z.string().trim().min(1),
      detail: z.string().trim().min(1),
      severity: z.enum(["low", "medium", "high"]),
      suggestedAction: z.string().trim().nullable().optional(),
      evidence: z.array(z.string().trim().min(1)).default([])
    })
  ).default([])
});

const summaryResponseSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string().trim().min(1),
      paragraphs: z.array(z.string().trim().min(1)).min(1)
    })
  ).default([]),
  body: z.string().default("")
});

const briefExtractionResponseSchema = z.object({
  campaignOverview: z.string().nullable().optional(),
  messagingPoints: z.array(z.string().trim().min(1)).default([]),
  talkingPoints: z.array(z.string().trim().min(1)).default([]),
  creativeConceptOverview: z.string().nullable().optional(),
  brandGuidelines: z.string().nullable().optional(),
  approvalRequirements: z.string().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  toneAndStyle: z.string().nullable().optional(),
  doNotMention: z.array(z.string().trim().min(1)).default([])
});

const generatedBriefResponseSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      content: z.string().trim().min(1),
      items: z.array(z.string().trim().min(1)).optional()
    })
  ).default([])
});

const clauseConsolidationResponseSchema = z.object({
  usageRights: z.string().trim().nullable().optional(),
  exclusivity: z.string().trim().nullable().optional(),
  deliverablesSummary: z.string().trim().nullable().optional(),
  termination: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional()
});

export interface ClauseConsolidationResult {
  usageRights: string | null;
  exclusivity: string | null;
  deliverablesSummary: string | null;
  termination: string | null;
  notes: string | null;
  model: string;
}

function shouldLogLlmDebug() {
  return process.env.DEBUG_DOCUMENT_PIPELINE === "1" || process.env.NODE_ENV !== "production";
}

function logLlmDebug(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (!shouldLogLlmDebug()) {
    return;
  }

  const logger = level === "error" ? console.error : console.info;
  logger(`[document-llm] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
}

export function hasLlmKey() {
  return hasAiClient();
}

function parseModelList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => Boolean(entry));
}

function taskSpecificModel(task: LlmTask) {
  switch (task) {
    case "extract_section":
      return process.env.OPENROUTER_MODEL_EXTRACT || null;
    case "analyze_risks":
      return process.env.OPENROUTER_MODEL_RISKS || null;
    case "generate_summary":
    case "generate_brief":
    case "consolidate_clauses":
      return process.env.OPENROUTER_MODEL_CONTENT || null;
    default:
      return null;
  }
}

function taskSpecificFallbacks(task: LlmTask) {
  switch (task) {
    case "extract_section":
      return parseModelList(process.env.OPENROUTER_MODEL_EXTRACT_FALLBACKS);
    case "analyze_risks":
      return parseModelList(process.env.OPENROUTER_MODEL_RISKS_FALLBACKS);
    case "generate_summary":
    case "generate_brief":
    case "consolidate_clauses":
      return parseModelList(process.env.OPENROUTER_MODEL_CONTENT_FALLBACKS);
    default:
      return [];
  }
}

export function getLlmModel(task: LlmTask = "extract_section") {
  return getLlmRoute(task).primary;
}

export function getLlmRoute(task: LlmTask = "extract_section"): LlmRoute {
  const defaultRoutes: Record<LlmTask, LlmRoute> = {
    extract_section: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    },
    analyze_risks: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    },
    generate_summary: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    },
    generate_brief: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    },
    consolidate_clauses: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    }
  };

  const sharedFallbacks = parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS);
  const requestedPrimary =
    taskSpecificModel(task) ||
    process.env.OPENROUTER_MODEL ||
    defaultRoutes[task].primary;
  const primary = requestedPrimary;
  const fallbacks = [
    ...taskSpecificFallbacks(task),
    ...sharedFallbacks,
    ...defaultRoutes[task].fallbacks
  ].filter((model, index, list) => model !== primary && list.indexOf(model) === index);

  return { primary, fallbacks };
}

async function requestStructured<TSchema extends z.ZodTypeAny>(
  task: LlmTask,
  systemPrompt: string,
  userPrompt: string,
  schema: TSchema,
  fallback: z.infer<TSchema>,
  debugMeta?: Record<string, unknown>
) {
  const route = getLlmRoute(task);
  const model = route.primary;
  const startedAt = Date.now();
  const scopeParts = [
    task,
    typeof debugMeta?.documentId === "string" ? debugMeta.documentId : null,
    typeof debugMeta?.dealId === "string" ? debugMeta.dealId : null,
    typeof debugMeta?.sectionIndex === "number" ? String(debugMeta.sectionIndex) : null,
    typeof debugMeta?.purpose === "string" ? debugMeta.purpose : null
  ].filter(Boolean);
  const cache = aiCachePolicy({
    taskKey: task,
    scopeKey: scopeParts.join(":") || task,
    input: {
      task,
      systemPrompt,
      userPrompt,
      debugMeta
    }
  });

  logLlmDebug("info", "request_start", {
    model,
    fallbacks: route.fallbacks,
    task,
    ...debugMeta
  });

  try {
    const response = await runStructuredOpenRouterTask({
      context: {
        featureKey: task === "generate_brief" ? "brief_generation" : "document_analysis",
        taskKey: task,
        metadata: debugMeta
      },
      systemPrompt:
        systemPrompt +
        "\n\nIMPORTANT: Never use em dashes (—) or en dashes (–) in any output. Use commas, periods, or semicolons instead.",
      userPrompt,
      temperature: 0.1,
      schema,
      fallback,
      cache,
    });

    if (!response) {
      throw new Error("LLM budget limit reached.");
    }

    logLlmDebug("info", "request_complete", {
      model,
      resolvedModel: response.resolvedModel,
      fallbacks: route.fallbacks,
      task,
      durationMs: Date.now() - startedAt,
      responseChars: JSON.stringify(response.data).length,
      cacheHit: response.cacheHit,
      budgetDecision: response.budgetDecision,
      ...debugMeta
    });

    return response.data;
  } catch (error) {
    logLlmDebug("error", "request_failed", {
      model,
      fallbacks: route.fallbacks,
      task,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown LLM error",
      ...debugMeta
    });
    throw error;
  }
}

export async function extractSectionWithLlm(
  section: DocumentSectionInput,
  documentKind: DocumentKind,
  fallback: ExtractionPipelineResult
): Promise<ExtractionPipelineResult> {
  const payload = await requestStructured(
    "extract_section",
    extractSectionSystemPrompt(),
    extractSectionUserPrompt(section, documentKind, fallback),
    extractionResponseSchema,
    {
      data: fallback.data as Record<string, unknown>,
      evidence: fallback.evidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        confidence: entry.confidence ?? null
      })),
      confidence: fallback.confidence
    },
    {
      requestType: "extract_section",
      documentKind,
      sectionIndex: section.chunkIndex,
      sectionTitle: section.title,
      sectionChars: section.content.length
    }
  );

  return {
    schemaVersion: "v2-section",
    model: `llm:${getLlmModel("extract_section")}`,
    confidence: asNumber(payload.confidence) ?? fallback.confidence,
    data: normalizeTerms(payload.data, fallback.data),
    evidence: normalizeEvidence(
      payload.evidence,
      `section:${section.chunkIndex}`,
      fallback.evidence
    ),
    conflicts: []
  };
}

export async function analyzeRisksWithLlm(
  text: string,
  documentKind: DocumentKind,
  extraction: ExtractionPipelineResult,
  fallback: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  documentId: string
) {
  const payload = await requestStructured(
    "analyze_risks",
    analyzeRisksSystemPrompt(),
    analyzeRisksUserPrompt(text, documentKind, extraction, fallback),
    riskFlagsResponseSchema,
    { riskFlags: fallback },
    {
      requestType: "analyze_risks",
      documentKind,
      documentId,
      textChars: text.length,
      fallbackRiskCount: fallback.length
    }
  );

  return normalizeRiskFlags(payload.riskFlags, fallback, documentId);
}

export async function generateSummaryWithLlm(
  extraction: ExtractionPipelineResult,
  risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  fallback: DocumentSummaryResult
) {
  const evidenceCount = Array.isArray(extraction.evidence) ? extraction.evidence.length : 0;
  const payload = await requestStructured(
    "generate_summary",
    summarySystemPrompt("default"),
    summaryUserPrompt({
      extraction,
      risks,
      fallbackBody: fallback.body
    }),
    summaryResponseSchema,
    { sections: [], body: fallback.body },
    {
      requestType: "generate_summary",
      riskCount: risks.length,
      evidenceCount,
      fallbackSummaryChars: fallback.body.length
    }
  );

  const sections = Array.isArray(payload.sections)
    ? payload.sections
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const record = entry as { title?: unknown; paragraphs?: unknown };
          const title = stripInlineMarkdown(asString(record.title) ?? "");
          const paragraphs = Array.isArray(record.paragraphs)
            ? record.paragraphs
                .map((paragraph) => toPlainDealSummary(asString(paragraph) ?? ""))
                .filter((paragraph): paragraph is string => Boolean(paragraph))
            : [];

          if (!title || paragraphs.length === 0) {
            return null;
          }

          return {
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            title,
            paragraphs
          };
        })
        .filter(
          (
            entry
          ): entry is { id: string; title: string; paragraphs: string[] } =>
            Boolean(entry)
        )
    : [];

  return {
    body:
      (sections.length > 0
        ? serializeDealSummarySections(sections)
        : toPlainDealSummary(asString(payload.body) ?? fallback.body)) ?? fallback.body,
    version: `llm:${getLlmModel("generate_summary")}`
  };
}

export async function generateSimplifiedSummaryWithLlm(input: {
  targetType: SummaryType;
  baseSummary: string;
  grounding: Record<string, unknown>;
  fallback: DocumentSummaryResult;
}) {
  const styleInstruction =
    input.targetType === "plain_language"
      ? "Rewrite the legal summary in simple, conversational creator language. Keep it short: 1-2 sentences per section. State facts directly without filler. The creator should understand the entire deal in under 20 seconds of reading."
      : "Compress the summary into the shortest possible quick-reference version. One sentence per section maximum. State only the most critical fact per section: the amount, the deadline, the restriction, the risk. Skip anything generic or obvious.";

  const payload = await requestStructured(
    "generate_summary",
    summarySystemPrompt("rewrite"),
    summaryUserPrompt({
      extraction: null,
      risks: null,
      fallbackBody: input.fallback.body,
      targetType: input.targetType,
      styleInstruction,
      baseSummary: input.baseSummary,
      grounding: input.grounding
    }),
    summaryResponseSchema,
    { sections: [], body: input.fallback.body },
    {
      requestType: "generate_summary",
      purpose: `summary_variant:${input.targetType}`,
      targetType: input.targetType,
      fallbackSummaryChars: input.fallback.body.length
    }
  );

  const sections = Array.isArray(payload.sections)
    ? payload.sections
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const record = entry as { title?: unknown; paragraphs?: unknown };
          const title = stripInlineMarkdown(asString(record.title) ?? "");
          const paragraphs = Array.isArray(record.paragraphs)
            ? record.paragraphs
                .map((paragraph) => toPlainDealSummary(asString(paragraph) ?? ""))
                .filter((paragraph): paragraph is string => Boolean(paragraph))
            : [];

          if (!title || paragraphs.length === 0) {
            return null;
          }

          return {
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            title,
            paragraphs
          };
        })
        .filter(
          (
            entry
          ): entry is { id: string; title: string; paragraphs: string[] } =>
            Boolean(entry)
        )
    : [];

  return {
    body:
      (sections.length > 0
        ? serializeDealSummarySections(sections)
        : toPlainDealSummary(asString(payload.body) ?? input.fallback.body)) ??
      input.fallback.body,
    version: `llm:${input.targetType}:${getLlmModel("generate_summary")}`
  };
}

export async function consolidateClausesWithLlm(
  input: ClauseConsolidationInput
): Promise<ClauseConsolidationResult> {
  const payload = await requestStructured(
    "consolidate_clauses",
    clauseConsolidationSystemPrompt(),
    clauseConsolidationUserPrompt(input),
    clauseConsolidationResponseSchema,
    input.fallback,
    {
      requestType: "consolidate_clauses",
      usageRightsCount: input.usageRights.length,
      exclusivityCount: input.exclusivity.length,
      deliverablesCount: input.deliverables.length,
      terminationCount: input.termination.length,
      notesCount: input.notes.length
    }
  );

  return {
    usageRights:
      toPlainDealSummary(asString(payload.usageRights) ?? "") ??
      input.fallback.usageRights,
    exclusivity:
      toPlainDealSummary(asString(payload.exclusivity) ?? "") ??
      input.fallback.exclusivity,
    deliverablesSummary:
      toPlainDealSummary(asString(payload.deliverablesSummary) ?? "") ??
      input.fallback.deliverablesSummary,
    termination:
      toPlainDealSummary(asString(payload.termination) ?? "") ??
      input.fallback.termination,
    notes:
      toPlainDealSummary(asString(payload.notes) ?? "") ?? input.fallback.notes,
    model: getLlmModel("consolidate_clauses")
  };
}

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
        doNotMention: fallback.doNotMention
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
