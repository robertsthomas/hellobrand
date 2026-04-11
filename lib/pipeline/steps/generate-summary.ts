/**
 * This file runs the summary step and closes out a document run.
 * It owns summary generation, final run completion state, and run-level observability reporting.
 */
import { buildCreatorSummary } from "@/lib/analysis/fallback";
import { generateSummaryWithLlm, getLlmRoute, hasLlmKey } from "@/lib/analysis/llm";
import { logDocumentPipeline, writeGenerationSnapshot } from "@/lib/document-pipeline-shared";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { getRepository } from "@/lib/repository";
import { queueAssistantSnapshotRefresh, saveArtifact, saveObservabilityArtifact } from "@/lib/pipeline/artifacts";
import { assertCurrentRun, executePipelineStep, loadExtractionFromRecords } from "@/lib/pipeline/run-state";

export async function runGenerateSummaryStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "generate_summary" }, async ({ document, viewer }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const repository = getRepository();
    const extraction = await loadExtractionFromRecords(document);
    const risks = await repository.listRiskFlagsForDocument(document.dealId, document.id);
    const fallbackSummary = buildCreatorSummary(
      extraction as Parameters<typeof buildCreatorSummary>[0],
      risks
    );
    const summary = !hasLlmKey()
      ? fallbackSummary
      : await generateSummaryWithLlm(extraction, risks, fallbackSummary).catch(
          () => fallbackSummary
        );

    await assertCurrentRun(document.id, runId);
    await repository.saveSummary(document.dealId, document.id, summary);
    await repository.updateDeal(viewer.id, document.dealId, {
      summary: summary.body,
      analyzedAt: new Date().toISOString()
    });
    await repository.updateDocument(document.id, {
      processingStatus: "ready",
      errorMessage: null
    });
    await repository.updateDocumentRun(runId, {
      status: "ready",
      completedAt: new Date().toISOString(),
      failedAt: null,
      failureMessage: null
    });

    await saveArtifact({
      documentId: document.id,
      runId,
      step: "generate_summary",
      kind: "summary",
      processor: hasLlmKey() ? getLlmRoute("generate_summary").primary : "fallback_summary",
      payload: {
        summary,
        riskCount: risks.length
      }
    });

    const runArtifacts = await repository.listDocumentArtifacts(document.id, { runId });
    const estimatedCostUsd = Number(
      runArtifacts
        .filter((artifact) => artifact.kind === "observability")
        .reduce((sum, artifact) => {
          const value = artifact.payload?.estimatedCostUsd;
          return sum + (typeof value === "number" ? value : 0);
        }, 0)
        .toFixed(4)
    );
    const pagesProcessed = runArtifacts
      .filter((artifact) => artifact.kind === "observability")
      .reduce((sum, artifact) => {
        const value = artifact.payload?.pageCount;
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    const totalDurationMs = document.processingStartedAt
      ? Date.now() - new Date(document.processingStartedAt).getTime()
      : 0;

    await saveObservabilityArtifact({
      documentId: document.id,
      runId,
      step: "generate_summary",
      payload: {
        event: "run_summary",
        documentStatus: "ready",
        totalDurationMs,
        estimatedCostUsd,
        pagesProcessed,
        riskCount: risks.length,
        summaryLength: summary.body.length,
        extractionConfidence: extraction.confidence ?? null,
        deliverablesCount: extraction.data.deliverables?.length ?? 0
      }
    });

    if (process.env.DATABASE_URL) {
      await syncIntakeSessionForDealId(document.dealId);
    }

    logDocumentPipeline("info", "pipeline_complete", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      durationMs: totalDurationMs,
      riskCount: risks.length,
      summaryLength: summary.body.length,
      deliverablesCount: extraction.data.deliverables?.length ?? 0,
      runId
    });

    try {
      writeGenerationSnapshot({
        dealId: document.dealId,
        documentId: document.id,
        fileName: document.fileName,
        documentKind: document.documentKind,
        model: extraction.model,
        durationMs: totalDurationMs,
        extraction,
        risks,
        summary
      });
    } catch {
      // Snapshot write failure should not affect pipeline completion.
    }

    void queueAssistantSnapshotRefresh(viewer, document.dealId).catch(() => undefined);

    return repository.getDealAggregate(viewer.id, document.dealId);
  });
}
