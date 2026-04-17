/**
 * Compatibility barrel — re-exports from modularized fallback analysis modules.
 * All imports of @/lib/analysis/fallback continue to work unchanged.
 */
export {
  classifyDocumentHeuristically,
  extractStructuredTerms,
  inferBriefBrandName,
  inferBriefCampaignName,
  isBriefLikeDocumentKind,
  mergeExtractionResults,
  parseBriefDeliverables,
  shouldUseInferredBriefBrandName,
  splitIntoSections
} from "@/lib/analysis/extract";
export { analyzeCreatorRisks } from "@/lib/analysis/risks";
export {
  buildCreatorSummary,
  buildFallbackBrief,
  extractBriefData,
  fallbackAnalyzeContract,
  fallbackAnalyzeDocument
} from "@/lib/analysis/summary";
