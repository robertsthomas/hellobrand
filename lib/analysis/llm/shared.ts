/**
 * Shared LLM routing, schemas, and request execution helpers.
 * This file owns model selection, structured-response schemas, and the cached OpenRouter request wrapper used by the analysis tasks.
 */
import { z } from "zod";

import { aiCachePolicy, hasAiClient } from "@/lib/ai/gateway";
import { runStructuredOpenRouterTask } from "@/lib/ai/structured";

export type LlmTask =
  | "extract_section"
  | "analyze_risks"
  | "generate_summary"
  | "generate_brief"
  | "consolidate_clauses";

export type LlmRoute = {
  primary: string;
  fallbacks: string[];
};

export const extractionResponseSchema = z.object({
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

export const riskFlagsResponseSchema = z.object({
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

export const summaryResponseSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string().trim().min(1),
      paragraphs: z.array(z.string().trim().min(1)).min(1)
    })
  ).default([]),
  body: z.string().default("")
});

export const briefExtractionResponseSchema = z.object({
  campaignOverview: z.string().nullable().optional(),
  messagingPoints: z.array(z.string().trim().min(1)).default([]),
  talkingPoints: z.array(z.string().trim().min(1)).default([]),
  creativeConceptOverview: z.string().nullable().optional(),
  brandGuidelines: z.string().nullable().optional(),
  approvalRequirements: z.string().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  toneAndStyle: z.string().nullable().optional(),
  doNotMention: z.array(z.string().trim().min(1)).default([]),
  brandContactName: z.string().nullable().optional(),
  brandContactTitle: z.string().nullable().optional(),
  brandContactEmail: z.string().nullable().optional(),
  brandContactPhone: z.string().nullable().optional(),
  agencyContactName: z.string().nullable().optional(),
  agencyContactTitle: z.string().nullable().optional(),
  agencyContactEmail: z.string().nullable().optional(),
  agencyContactPhone: z.string().nullable().optional()
});

export const generatedBriefResponseSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      content: z.string().trim().min(1),
      items: z.array(z.string().trim().min(1)).optional()
    })
  ).default([])
});

export const clauseConsolidationResponseSchema = z.object({
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
    process.env.OPENROUTER_MODEL ||
    taskSpecificModel(task) ||
    defaultRoutes[task].primary;
  const primary = requestedPrimary;
  const fallbacks = [
    ...taskSpecificFallbacks(task),
    ...sharedFallbacks,
    ...defaultRoutes[task].fallbacks
  ].filter((model, index, list) => model !== primary && list.indexOf(model) === index);

  return { primary, fallbacks };
}

export async function requestStructured<TSchema extends z.ZodTypeAny>(
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
