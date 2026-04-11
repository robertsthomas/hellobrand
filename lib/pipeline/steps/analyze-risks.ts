/**
 * This file runs the risk analysis step.
 * It owns fallback and LLM risk scoring, then persists the risk flags for the current document.
 */
import { analyzeCreatorRisks } from "@/lib/analysis/fallback";
import { analyzeRisksWithLlm, getLlmRoute, hasLlmKey } from "@/lib/analysis/llm";
import { getRepository } from "@/lib/repository";
import { saveArtifact } from "@/lib/pipeline/artifacts";
import { assertCurrentRun, executePipelineStep, loadExtractionFromRecords } from "@/lib/pipeline/run-state";

export async function runAnalyzeRisksStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "analyze_risks" }, async ({ document }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const extraction = await loadExtractionFromRecords(document);
    const fallbackRisks = analyzeCreatorRisks(
      document.normalizedText,
      document.id,
      extraction as Parameters<typeof analyzeCreatorRisks>[2]
    );
    const risks = !hasLlmKey()
      ? fallbackRisks
      : await analyzeRisksWithLlm(
          document.normalizedText,
          document.documentKind,
          extraction,
          fallbackRisks,
          document.id
        ).catch(() => fallbackRisks);

    await assertCurrentRun(document.id, runId);
    await getRepository().replaceRiskFlagsForDocument(document.dealId, document.id, risks);

    await saveArtifact({
      documentId: document.id,
      runId,
      step: "analyze_risks",
      kind: "risk_analysis",
      processor: hasLlmKey() ? getLlmRoute("analyze_risks").primary : "fallback_risk_analysis",
      payload: {
        risks
      }
    });

    return risks;
  });
}
