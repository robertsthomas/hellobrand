/**
 * This file extracts raw and normalized text for a document run.
 * It owns parser execution and the first persistence pass for extracted text artifacts.
 */
import { logDocumentPipeline } from "@/lib/document-pipeline-shared";
import { extractDocumentText, normalizeDocumentText } from "@/lib/documents/extract";
import { getRepository } from "@/lib/repository";
import { readStoredBytes } from "@/lib/storage";
import { saveArtifact, saveObservabilityArtifact } from "@/lib/pipeline/artifacts";
import { assertCurrentRun, executePipelineStep } from "@/lib/pipeline/run-state";

export async function runExtractTextStep(documentId: string, runId: string) {
// fallow-ignore-next-line complexity
  return executePipelineStep({ documentId, runId, step: "extract_text" }, async ({ document }) => {
    logDocumentPipeline("info", "pipeline_start", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      sourceType: document.sourceType,
      mimeType: document.mimeType,
      runId,
    });

    await getRepository().updateDocument(document.id, {
      processingStatus: "processing",
      errorMessage: null,
    });

    const extractionSource =
      document.sourceType === "pasted_text"
        ? {
            rawText: document.rawText ?? "",
            normalizedText: normalizeDocumentText(document.rawText ?? ""),
          }
        : await extractDocumentText(
            await readStoredBytes(document.storagePath),
            document.mimeType,
            document.fileName
          );

    await assertCurrentRun(document.id, runId);

    await getRepository().updateDocument(document.id, {
      processingStatus: "processing",
      rawText: extractionSource.rawText,
      normalizedText: extractionSource.normalizedText,
      errorMessage: null,
    });

    await saveArtifact({
      documentId: document.id,
      runId,
      step: "extract_text",
      kind: "text_extraction",
      processor: extractionSource._debug?.parser ?? null,
      payload: {
        rawText: extractionSource.rawText,
        normalizedText: extractionSource.normalizedText,
        debug: extractionSource._debug ?? null,
      },
    });

    await saveObservabilityArtifact({
      documentId: document.id,
      runId,
      step: "extract_text",
      processor: extractionSource._debug?.parser ?? null,
      payload: {
        event: "extract_text_metrics",
        parser: extractionSource._debug?.parser ?? null,
        durationMs: extractionSource._debug?.durationMs ?? null,
        fileSizeBytes: extractionSource._debug?.fileSizeBytes ?? null,
        extractedChars: extractionSource._debug?.extractedChars ?? null,
        pageCount: extractionSource._debug?.pageCount ?? null,
        estimatedCostUsd: extractionSource._debug?.estimatedCostUsd ?? 0,
      },
    });

    if (extractionSource._vendor) {
      await saveArtifact({
        documentId: document.id,
        runId,
        step: "extract_text",
        kind: "raw_vendor_output",
        processor: extractionSource._vendor.processor,
        payload: extractionSource._vendor.payload,
      });
    }

    return extractionSource;
  });
}
