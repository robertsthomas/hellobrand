/**
 * This file runs the full document pipeline in step order.
 * It is the orchestration entry point used by Inngest and other callers that want the full end-to-end pipeline.
 */
import type { DealAggregate } from "@/lib/types";

import { runAnalyzeRisksStep } from "./analyze-risks";
import { runClassifyDocumentStep } from "./classify-document";
import { runExtractFieldsStep } from "./extract-fields";
import { runExtractTextStep } from "./extract-text";
import { runGenerateSummaryStep } from "./generate-summary";
import { runMergeResultsStep } from "./merge-results";
import { runSectionDocumentStep } from "./section-document";

export async function runDocumentPipelineSteps(documentId: string, runId: string) {
  await runExtractTextStep(documentId, runId);
  await runClassifyDocumentStep(documentId, runId);
  await runSectionDocumentStep(documentId, runId);
  await runExtractFieldsStep(documentId, runId);
  await runMergeResultsStep(documentId, runId);
  await runAnalyzeRisksStep(documentId, runId);
  const finalStep = await runGenerateSummaryStep(documentId, runId);

  if (!finalStep.result) {
    throw new Error("generate_summary: Expected final aggregate.");
  }

  return finalStep.result as DealAggregate;
}
