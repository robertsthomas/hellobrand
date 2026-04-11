/**
 * Compatibility barrel for LLM-backed analysis helpers.
 * The routing and task implementations are split into smaller files, but callers can keep importing from this path.
 */
export type { ClauseConsolidationInput } from "@/lib/analysis/prompts";

export {
  hasLlmKey,
  getLlmModel,
  getLlmRoute,
  type ClauseConsolidationResult
} from "./llm/shared";

export {
  extractSectionWithLlm,
  analyzeRisksWithLlm,
  generateSummaryWithLlm,
  generateSimplifiedSummaryWithLlm,
  consolidateClausesWithLlm
} from "./llm/document";

export {
  extractBriefWithLlm,
  generateBriefWithLlm
} from "./llm/brief";
