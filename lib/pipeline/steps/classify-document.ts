/**
 * This file classifies a document and records the routing decision for the current run.
 * It owns the handoff from normalized text into the extraction route selection.
 */
import { classifyDocumentForRouting, resolveDocumentRoutingDecision } from "@/lib/document-routing";
import { logDocumentPipeline } from "@/lib/document-pipeline-shared";
import { getRepository } from "@/lib/repository";
import { saveArtifact, saveObservabilityArtifact } from "@/lib/pipeline/artifacts";
import { assertCurrentRun, executePipelineStep } from "@/lib/pipeline/run-state";

export async function runClassifyDocumentStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "classify_document" }, async ({ document }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const classification = classifyDocumentForRouting({
      text: document.normalizedText,
      fileName: document.fileName
    });

    const routing = resolveDocumentRoutingDecision({
      document: {
        ...document,
        documentKind: classification.documentKind,
        classificationConfidence: classification.confidence
      }
    });

    logDocumentPipeline("info", "document_routed", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      documentKind: classification.documentKind,
      confidence: classification.confidence,
      extractionRoute: routing.extractionRoute,
      processor: routing.processor,
      reasons: routing.reasons,
      runId
    });

    await assertCurrentRun(document.id, runId);
    await getRepository().updateDocument(document.id, {
      documentKind: classification.documentKind,
      classificationConfidence: classification.confidence
    });

    await saveArtifact({
      documentId: document.id,
      runId,
      step: "classify_document",
      kind: "classification",
      processor: "heuristic_router",
      payload: {
        classification,
        routing
      }
    });

    await saveObservabilityArtifact({
      documentId: document.id,
      runId,
      step: "classify_document",
      processor: routing.processor,
      payload: {
        event: "routing_decision",
        documentKind: classification.documentKind,
        confidence: classification.confidence,
        extractionRoute: routing.extractionRoute,
        rolloutEnabled: routing.rolloutEnabled,
        cohortBucket: routing.cohortBucket,
        reasons: routing.reasons
      }
    });

    return classification;
  });
}
