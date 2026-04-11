/**
 * LLM tasks for document extraction, risk analysis, summaries, and clause consolidation.
 * This file owns the document-focused prompts and response normalization for the analysis pipeline.
 */
import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptQuotedText
} from "@/lib/ai/prompting";
import type {
  DealAggregate,
  DocumentKind,
  DocumentSectionInput,
  DocumentSummaryResult,
  ExtractionPipelineResult,
  RiskFlagRecord,
  SummaryType
} from "@/lib/types";
import {
  serializeDealSummarySections,
  stripInlineMarkdown,
  toPlainDealSummary
} from "@/lib/deal-summary";
import {
  analyzeRisksSystemPrompt,
  analyzeRisksUserPrompt,
  clauseConsolidationSystemPrompt,
  clauseConsolidationUserPrompt,
  extractSectionSystemPrompt,
  extractSectionUserPrompt,
  summarySystemPrompt,
  summaryUserPrompt,
  type ClauseConsolidationInput
} from "@/lib/analysis/prompts";
import {
  asNumber,
  asString,
  normalizeEvidence,
  normalizeRiskFlags,
  normalizeTerms
} from "@/lib/analysis/normalizers";

import {
  ClauseConsolidationResult,
  clauseConsolidationResponseSchema,
  extractionResponseSchema,
  getLlmModel,
  requestStructured,
  riskFlagsResponseSchema,
  summaryResponseSchema
} from "./shared";

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
