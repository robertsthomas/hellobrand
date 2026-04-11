/**
 * Compatibility barrel for the modularized document pipeline steps.
 * Each pipeline step now lives in its own file, but callers can keep importing from this path.
 */
export { failDocumentProcessingRun, DocumentRunSupersededError } from "@/lib/pipeline/run-state";
export { parseFailedStep as getDocumentPipelineFailedStep } from "@/lib/pipeline/run-state";

export { runExtractTextStep } from "./extract-text";
export { runClassifyDocumentStep } from "./classify-document";
export { runSectionDocumentStep } from "./section-document";
export { runExtractFieldsStep } from "./extract-fields";
export { runMergeResultsStep } from "./merge-results";
export { runAnalyzeRisksStep } from "./analyze-risks";
export { runGenerateSummaryStep } from "./generate-summary";
export { runDocumentPipelineSteps } from "./run-all";
