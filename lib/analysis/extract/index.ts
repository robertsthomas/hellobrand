/**
 * Compatibility barrel for heuristic extraction helpers.
 * The implementation is split by concern so callers can keep importing from this path without carrying one giant module.
 */
export { createEmptyTerms, mergeExtractionResults } from "./shared";
export { inferBriefBrandName, isBriefLikeDocumentKind, isGenericCampaignName, parseBriefDeliverables, shouldUseInferredBriefBrandName, inferBriefCampaignName } from "./brief";
export { classifyDocumentHeuristically, splitIntoSections } from "./classification";
export { extractStructuredTerms } from "./terms";
