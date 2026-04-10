/**
 * This file runs the document pipeline one step at a time.
 * It connects analysis helpers with run-state persistence so each processing stage can be tracked and resumed safely.
 */
import {
  analyzeCreatorRisks,
  buildCreatorSummary,
  splitIntoSections
} from "@/lib/analysis/fallback";
import {
  analyzeRisksWithLlm,
  generateSummaryWithLlm,
  getLlmRoute,
  hasLlmKey
} from "@/lib/analysis/llm";
import { getViewerById } from "@/lib/auth";
import {
  createDocumentProcessingRunState,
  createEmptyTerms,
  DOCUMENT_PIPELINE_STEPS,
  earliestDeliverableDate,
  finalizeDocumentExtraction,
  getDocumentProcessingRunState,
  getPreferredCreatorNameForViewer,
  isDocumentPipelineStepComplete,
  logDocumentPipeline,
  markDocumentPipelineRunFailed,
  markDocumentPipelineStepComplete,
  mergeTerms,
  reconstructExtractionPipelineResult,
  withPreferredCreatorName,
  writeGenerationSnapshot
} from "@/lib/document-pipeline-shared";
import {
  extractBriefTermsWithDocumentAiDetailed,
  hasMeaningfulBriefExtraction
} from "@/lib/document-ai-brief";
import {
  extractContractTermsWithDocumentAiDetailed,
  hasMeaningfulContractExtraction
} from "@/lib/document-ai-contract";
import {
  extractInvoiceTermsWithDocumentAiDetailed,
  hasMeaningfulInvoiceExtraction
} from "@/lib/document-ai-invoice";
import {
  classifyDocumentForRouting,
  resolveDocumentRoutingDecision
} from "@/lib/document-routing";
import { estimateDocumentAiCostUsd } from "@/lib/document-pipeline-rollout";
import { extractDocumentText, normalizeDocumentText } from "@/lib/documents/extract";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { syncPaymentRecordForDeal } from "@/lib/payments";
import {
  coalesceExtractions,
  hasMeaningfulChanges,
  planExtractionMerge
} from "@/lib/pending-changes";
import { getRepository } from "@/lib/repository";
import { readStoredBytes } from "@/lib/storage";
import type {
  DealAggregate,
  DocumentArtifactKind,
  DocumentEvidenceSourceType,
  DocumentReviewItemReason,
  DocumentReviewItemRecord,
  DocumentRecord,
  DocumentSectionRecord,
  ExtractionPipelineResult,
  FieldEvidence,
  JobType,
  PendingExtractionData,
  Viewer
} from "@/lib/types";

export class DocumentRunSupersededError extends Error {
  constructor(documentId: string, runId: string) {
    super(`Document processing run superseded for document ${documentId} (${runId}).`);
    this.name = "DocumentRunSupersededError";
  }
}

function isSupersededError(error: unknown): error is DocumentRunSupersededError {
  return error instanceof DocumentRunSupersededError;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Document processing failed.";
}

function asArtifactPayload(value: unknown): Record<string, unknown> | null {
  if (value == null) {
    return null;
  }

  const normalized = JSON.parse(JSON.stringify(value)) as unknown;
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    return normalized as Record<string, unknown>;
  }

  return { value: normalized };
}

function getEvidenceSourceType(entry: FieldEvidence): DocumentEvidenceSourceType {
  if (!entry.sectionKey) {
    return "document";
  }

  return entry.sectionKey.startsWith("section:") ? "section" : "vendor_entity";
}

function resolveSectionId(
  sections: DocumentSectionRecord[],
  sectionKey: string | null | undefined
) {
  if (!sectionKey?.startsWith("section:")) {
    return null;
  }

  return (
    sections.find((section) => `section:${section.chunkIndex}` === sectionKey)?.id ?? null
  );
}

function buildReviewItems(input: {
  extraction: ExtractionPipelineResult;
  sections: DocumentSectionRecord[];
  artifactId: string | null;
}) {
  const items: Omit<
    DocumentReviewItemRecord,
    "id" | "documentId" | "runId" | "createdAt" | "updatedAt"
  >[] = [];
  const seen = new Set<string>();

  function addReviewItem(
    fieldPath: string,
    reason: DocumentReviewItemReason,
    detail: string,
    confidence: number | null,
    sectionId: string | null
  ) {
    const key = `${fieldPath}:${reason}:${sectionId ?? "none"}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      fieldPath,
      status: "open",
      reason,
      title:
        reason === "conflict"
          ? `Review conflicting ${fieldPath}`
          : `Review low-confidence ${fieldPath}`,
      detail,
      confidence,
      suggestedValue:
        fieldPath in input.extraction.data
          ? (input.extraction.data as Record<string, unknown>)[fieldPath]
          : null,
      currentValue: null,
      sectionId,
      artifactId: input.artifactId
    });
  }

  for (const evidence of input.extraction.evidence ?? []) {
    const confidence = evidence.confidence;
    if (typeof confidence === "number" && confidence >= 0.65) {
      continue;
    }

    addReviewItem(
      evidence.fieldPath,
      "low_confidence",
      evidence.snippet
        ? `Extraction evidence for ${evidence.fieldPath} had low confidence: ${evidence.snippet}`
        : `Extraction evidence for ${evidence.fieldPath} had low confidence.`,
      confidence ?? null,
      resolveSectionId(input.sections, evidence.sectionKey)
    );
  }

  for (const fieldPath of input.extraction.conflicts ?? []) {
    addReviewItem(
      fieldPath,
      "conflict",
      `Multiple competing values were detected for ${fieldPath}.`,
      input.extraction.confidence,
      null
    );
  }

  return items;
}

async function saveArtifact(input: {
  documentId: string;
  runId: string;
  step: JobType;
  kind: DocumentArtifactKind;
  processor?: string | null;
  payload: unknown;
}) {
  return getRepository().createDocumentArtifact({
    documentId: input.documentId,
    runId: input.runId,
    step: input.step,
    kind: input.kind,
    processor: input.processor ?? null,
    payload: asArtifactPayload(input.payload)
  });
}

async function saveObservabilityArtifact(input: {
  documentId: string;
  runId: string;
  step: JobType;
  processor?: string | null;
  payload: Record<string, unknown>;
}) {
  try {
    await saveArtifact({
      documentId: input.documentId,
      runId: input.runId,
      step: input.step,
      kind: "observability",
      processor: input.processor ?? null,
      payload: input.payload
    });
  } catch {
    // Observability writes should not fail the pipeline.
  }
}

async function queueAssistantSnapshotRefresh(viewer: Viewer, dealId?: string | null) {
  const { refreshAssistantSnapshotsForViewer } = await import("@/lib/assistant/snapshots");
  await refreshAssistantSnapshotsForViewer(viewer, { dealId });
}

async function loadDocumentForRun(documentId: string, runId: string) {
  const document = await getRepository().getDocument(documentId);

  if (!document) {
    throw new Error("Document not found.");
  }

  if (document.processingRunId !== runId) {
    throw new DocumentRunSupersededError(documentId, runId);
  }

  return document;
}

async function assertCurrentRun(documentId: string, runId: string) {
  return loadDocumentForRun(documentId, runId);
}

async function updateCurrentRunState(
  documentId: string,
  runId: string,
  updater: (state: NonNullable<ReturnType<typeof getDocumentProcessingRunState>>) => NonNullable<ReturnType<typeof getDocumentProcessingRunState>>
) {
  const document = await loadDocumentForRun(documentId, runId);
  const state = getDocumentProcessingRunState(document) ?? createDocumentProcessingRunState(runId);
  const nextState = updater(state);
  const updated = await getRepository().updateDocument(documentId, {
    processingRunStateJson: nextState
  });
  await getRepository().updateDocumentRun(runId, {
    stepStateJson: nextState
  });
  return updated;
}

async function markStepComplete(documentId: string, runId: string, step: JobType) {
  await updateCurrentRunState(documentId, runId, (state) =>
    markDocumentPipelineStepComplete(state, step)
  );
}

export async function failDocumentProcessingRun(input: {
  documentId: string;
  runId: string;
  message: string;
  failedStep?: JobType | null;
}) {
  const document = await getRepository().getDocument(input.documentId);

  if (!document || document.processingRunId !== input.runId) {
    return null;
  }

  const state =
    getDocumentProcessingRunState(document) ?? createDocumentProcessingRunState(input.runId);

  const updated = await getRepository().updateDocument(input.documentId, {
    processingStatus: "failed",
    errorMessage: input.message,
    processingRunStateJson: markDocumentPipelineRunFailed(state, {
      step: input.failedStep ?? null,
      message: input.message
    })
  });

  await getRepository().updateDocumentRun(input.runId, {
    status: "failed",
    stepStateJson: markDocumentPipelineRunFailed(state, {
      step: input.failedStep ?? null,
      message: input.message
    }),
    failedAt: new Date().toISOString(),
    failureMessage: input.message
  });

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(document.dealId);
  }

  logDocumentPipeline("error", "pipeline_failed", {
    dealId: document.dealId,
    documentId: document.id,
    fileName: document.fileName,
    runId: input.runId,
    error: input.message
  });

  return updated;
}

function parseFailedStep(error: unknown): JobType | null {
  const message = getErrorMessage(error);

  for (const step of DOCUMENT_PIPELINE_STEPS) {
    if (message.startsWith(`${step}:`)) {
      return step;
    }
  }

  return null;
}

async function executePipelineStep<T>(
  input: {
    documentId: string;
    runId: string;
    step: JobType;
  },
  work: (context: { document: DocumentRecord; viewer: Viewer }) => Promise<T>
) {
  const repository = getRepository();
  const document = await loadDocumentForRun(input.documentId, input.runId);

  if (isDocumentPipelineStepComplete(document, input.runId, input.step)) {
    return {
      skipped: true as const,
      document,
      viewer: await getViewerById(document.userId),
      result: null as T | null
    };
  }

  const viewer = await getViewerById(document.userId);
  const job = await repository.createJob({
    dealId: document.dealId,
    documentId: document.id,
    type: input.step,
    status: "processing",
    attemptCount: 1,
    failureReason: null
  });
  const startedAt = Date.now();

  await repository.updateDocumentRun(input.runId, {
    status: "processing",
    startedAt: document.processingStartedAt ?? new Date().toISOString(),
    failedAt: null,
    failureMessage: null
  });

  logDocumentPipeline("info", "stage_start", {
    dealId: document.dealId,
    documentId: document.id,
    stage: input.step,
    jobId: job.id,
    runId: input.runId
  });

  try {
    const result = await work({ document, viewer });
    await markStepComplete(document.id, input.runId, input.step);
    await repository.updateJob(job.id, {
      status: "ready",
      failureReason: null
    });
    logDocumentPipeline("info", "stage_complete", {
      dealId: document.dealId,
      documentId: document.id,
      stage: input.step,
      jobId: job.id,
      runId: input.runId,
      durationMs: Date.now() - startedAt
    });
    await saveObservabilityArtifact({
      documentId: document.id,
      runId: input.runId,
      step: input.step,
      payload: {
        event: "step_result",
        failed: false,
        skipped: false,
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        attemptCount: 1
      }
    });

    return {
      skipped: false as const,
      document: await loadDocumentForRun(document.id, input.runId),
      viewer,
      result
    };
  } catch (error) {
    const message = getErrorMessage(error);
    await repository.updateJob(job.id, {
      status: "failed",
      failureReason: message
    });
    logDocumentPipeline("error", "stage_failed", {
      dealId: document.dealId,
      documentId: document.id,
      stage: input.step,
      jobId: job.id,
      runId: input.runId,
      durationMs: Date.now() - startedAt,
      error: message
    });
    await saveObservabilityArtifact({
      documentId: document.id,
      runId: input.runId,
      step: input.step,
      payload: {
        event: "step_result",
        failed: true,
        skipped: false,
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        attemptCount: 1,
        error: message
      }
    });

    if (isSupersededError(error)) {
      throw error;
    }

    throw new Error(`${input.step}: ${message}`);
  }
}

async function loadExtractionFromRecords(document: DocumentRecord) {
  const repository = getRepository();
  const [result, evidence, sections] = await Promise.all([
    repository.getExtractionResult(document.id),
    repository.listExtractionEvidence(document.id),
    repository.listDocumentSections(document.id)
  ]);

  if (!result) {
    throw new Error("Extraction result not found for document.");
  }

  return reconstructExtractionPipelineResult({
    result,
    evidence,
    sections
  });
}

export async function runExtractTextStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "extract_text" }, async ({ document }) => {
    logDocumentPipeline("info", "pipeline_start", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      sourceType: document.sourceType,
      mimeType: document.mimeType,
      runId
    });

    await getRepository().updateDocument(document.id, {
      processingStatus: "processing",
      errorMessage: null
    });

    const extractionSource =
      document.sourceType === "pasted_text"
        ? {
            rawText: document.rawText ?? "",
            normalizedText: normalizeDocumentText(document.rawText ?? "")
          }
        : await extractDocumentText(
            await readStoredBytes(document.storagePath),
            document.mimeType,
            document.fileName,
            {
              preferDocumentAi: true,
              requireDocumentAi: true,
              rollout: {
                dealId: document.dealId,
                documentId: document.id,
                userId: document.userId
              }
            }
          );

    await assertCurrentRun(document.id, runId);

    await getRepository().updateDocument(document.id, {
      processingStatus: "processing",
      rawText: extractionSource.rawText,
      normalizedText: extractionSource.normalizedText,
      errorMessage: null
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
        debug: extractionSource._debug ?? null
      }
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
        estimatedCostUsd: extractionSource._debug?.estimatedCostUsd ?? 0
      }
    });

    if (extractionSource._vendor) {
      await saveArtifact({
        documentId: document.id,
        runId,
        step: "extract_text",
        kind: "raw_vendor_output",
        processor: extractionSource._vendor.processor,
        payload: extractionSource._vendor.payload
      });
    }

    return extractionSource;
  });
}

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

export async function runSectionDocumentStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "section_document" }, async ({ document }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const sections = splitIntoSections(document.normalizedText, document.documentKind);

    logDocumentPipeline("info", "sections_created", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      documentKind: document.documentKind,
      sectionCount: sections.length,
      normalizedChars: document.normalizedText.length,
      runId
    });

    await assertCurrentRun(document.id, runId);
    await getRepository().replaceDocumentSections(document.id, sections);

    await saveArtifact({
      documentId: document.id,
      runId,
      step: "section_document",
      kind: "sections",
      processor: "fallback_sectioner",
      payload: {
        sectionCount: sections.length,
        sections
      }
    });

    return sections;
  });
}

export async function runExtractFieldsStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "extract_fields" }, async ({ document, viewer }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const repository = getRepository();
    const sections = await repository.listDocumentSections(document.id);
    const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
    const routing = resolveDocumentRoutingDecision({ document });
    let sanitizedExtraction: ExtractionPipelineResult;
    let rawVendorArtifactId: string | null = null;
    let routeProcessor: string | null = null;
    let pageCount: number | null = null;
    let entityCount: number | null = null;

    logDocumentPipeline("info", "document_routed", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      documentKind: document.documentKind,
      confidence: document.classificationConfidence,
      extractionRoute: routing.extractionRoute,
      processor: routing.processor,
      reasons: routing.reasons,
      runId
    });

    if (routing.extractionRoute === "document_ai_brief") {
      let briefExtraction: ExtractionPipelineResult | null = null;

      try {
        const detailedBriefExtraction = await extractBriefTermsWithDocumentAiDetailed({
          bytes: await readStoredBytes(document.storagePath),
          mimeType: document.mimeType,
          deal: {
            brandName: null,
            campaignName: null
          }
        });
        briefExtraction = detailedBriefExtraction.extraction;
        const rawVendorArtifact = await saveArtifact({
          documentId: document.id,
          runId,
          step: "extract_fields",
          kind: "raw_vendor_output",
          processor: detailedBriefExtraction.processor,
          payload: detailedBriefExtraction.rawResponse
        });
        rawVendorArtifactId = rawVendorArtifact.id;
        routeProcessor = detailedBriefExtraction.processor;
        pageCount = detailedBriefExtraction.pageCount;
        entityCount = detailedBriefExtraction.entityCount;
      } catch (error) {
        logDocumentPipeline("error", "document_ai_brief_failed", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          error: getErrorMessage(error),
          runId
        });
        throw error;
      }

      if (briefExtraction && hasMeaningfulBriefExtraction(briefExtraction)) {
        briefExtraction.data.briefData = briefExtraction.data.briefData
          ? {
              ...briefExtraction.data.briefData,
              sourceDocumentIds: [document.id]
            }
          : null;

        sanitizedExtraction = finalizeDocumentExtraction(
          document.normalizedText,
          briefExtraction,
          preferredCreatorName
        );

        logDocumentPipeline("info", "field_extraction_complete", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          sectionCount: sections.length,
          extractionCount: 1,
          usedLlm: false,
          extractionRoute: routing.extractionRoute,
          processor: routing.processor,
          runId
        });
      } else {
        const reason = briefExtraction ? "empty_brief_extraction" : "brief_processor_failed";
        logDocumentPipeline("error", "document_ai_brief_rejected", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          extractionRoute: routing.extractionRoute,
          reason,
          runId
        });
        throw new Error(`Document AI brief extraction failed: ${reason}.`);
      }
    } else if (routing.extractionRoute === "document_ai_contract") {
      let contractExtraction: ExtractionPipelineResult | null = null;

      try {
        const detailedContractExtraction = await extractContractTermsWithDocumentAiDetailed({
          bytes: await readStoredBytes(document.storagePath),
          mimeType: document.mimeType,
          deal: {
            brandName: null,
            campaignName: null
          }
        });
        contractExtraction = detailedContractExtraction.extraction;
        const rawVendorArtifact = await saveArtifact({
          documentId: document.id,
          runId,
          step: "extract_fields",
          kind: "raw_vendor_output",
          processor: detailedContractExtraction.processor,
          payload: detailedContractExtraction.rawResponse
        });
        rawVendorArtifactId = rawVendorArtifact.id;
        routeProcessor = detailedContractExtraction.processor;
        pageCount = detailedContractExtraction.pageCount;
        entityCount = detailedContractExtraction.entityCount;
      } catch (error) {
        logDocumentPipeline("error", "document_ai_contract_failed", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          error: getErrorMessage(error),
          runId
        });
        throw error;
      }

      if (contractExtraction && hasMeaningfulContractExtraction(contractExtraction)) {
        sanitizedExtraction = finalizeDocumentExtraction(
          document.normalizedText,
          contractExtraction,
          preferredCreatorName
        );

        logDocumentPipeline("info", "field_extraction_complete", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          sectionCount: sections.length,
          extractionCount: 1,
          usedLlm: false,
          extractionRoute: routing.extractionRoute,
          processor: routing.processor,
          runId
        });
      } else {
        const reason = contractExtraction
          ? "empty_contract_extraction"
          : "contract_processor_failed";
        logDocumentPipeline("error", "document_ai_contract_rejected", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          extractionRoute: routing.extractionRoute,
          reason,
          runId
        });
        throw new Error(`Document AI contract extraction failed: ${reason}.`);
      }
    } else if (routing.extractionRoute === "document_ai_invoice") {
      let invoiceExtraction: ExtractionPipelineResult | null = null;

      try {
        const detailedInvoiceExtraction = await extractInvoiceTermsWithDocumentAiDetailed({
          bytes: await readStoredBytes(document.storagePath),
          mimeType: document.mimeType,
          deal: {
            brandName: null,
            campaignName: null
          }
        });
        invoiceExtraction = detailedInvoiceExtraction.extraction;
        const rawVendorArtifact = await saveArtifact({
          documentId: document.id,
          runId,
          step: "extract_fields",
          kind: "raw_vendor_output",
          processor: detailedInvoiceExtraction.processor,
          payload: detailedInvoiceExtraction.rawResponse
        });
        rawVendorArtifactId = rawVendorArtifact.id;
        routeProcessor = detailedInvoiceExtraction.processor;
        pageCount = detailedInvoiceExtraction.pageCount;
        entityCount = detailedInvoiceExtraction.entityCount;
      } catch (error) {
        logDocumentPipeline("error", "document_ai_invoice_failed", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          error: getErrorMessage(error),
          runId
        });
        throw error;
      }

      if (invoiceExtraction && hasMeaningfulInvoiceExtraction(invoiceExtraction)) {
        sanitizedExtraction = finalizeDocumentExtraction(
          document.normalizedText,
          invoiceExtraction,
          preferredCreatorName
        );

        logDocumentPipeline("info", "field_extraction_complete", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          sectionCount: sections.length,
          extractionCount: 1,
          usedLlm: false,
          extractionRoute: routing.extractionRoute,
          processor: routing.processor,
          runId
        });
      } else {
        const reason = invoiceExtraction ? "empty_invoice_extraction" : "invoice_processor_failed";
        logDocumentPipeline("error", "document_ai_invoice_rejected", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          extractionRoute: routing.extractionRoute,
          reason,
          runId
        });
        throw new Error(`Document AI invoice extraction failed: ${reason}.`);
      }
    } else {
      logDocumentPipeline("error", "document_ai_route_unsupported", {
        dealId: document.dealId,
        documentId: document.id,
        fileName: document.fileName,
        extractionRoute: routing.extractionRoute,
        reasons: routing.reasons,
        runId
      });
      throw new Error(
        `Document AI extraction is not available for ${document.documentKind}: ${routing.reasons.join(", ")}.`
      );
    }
    const extractionEvidence = Array.isArray(sanitizedExtraction.evidence)
      ? sanitizedExtraction.evidence
      : [];
    const extractionDeliverables = Array.isArray(sanitizedExtraction.data.deliverables)
      ? sanitizedExtraction.data.deliverables
      : [];

    logDocumentPipeline("info", "merge_complete", {
      dealId: document.dealId,
      documentId: document.id,
      evidenceCount: extractionEvidence.length,
      deliverablesCount: extractionDeliverables.length,
      hasPaymentAmount: sanitizedExtraction.data.paymentAmount !== null,
      hasBrandName: Boolean(sanitizedExtraction.data.brandName),
      hasCampaignName: Boolean(sanitizedExtraction.data.campaignName),
      runId
    });

    await assertCurrentRun(document.id, runId);
    await repository.upsertExtractionResult(document.id, sanitizedExtraction);
    await repository.replaceExtractionEvidence(
      document.id,
      extractionEvidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        sectionId:
          sections.find((section) => `section:${section.chunkIndex}` === entry.sectionKey)?.id ??
          null,
        confidence: entry.confidence
      }))
    );

    const normalizedArtifact = await saveArtifact({
      documentId: document.id,
      runId,
      step: "extract_fields",
      kind: "normalized_extraction",
      processor: sanitizedExtraction.model,
      payload: sanitizedExtraction
    });

    await repository.replaceDocumentFieldEvidence(
      document.id,
      runId,
      extractionEvidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        sourceType: getEvidenceSourceType(entry),
        sectionId: resolveSectionId(sections, entry.sectionKey),
        artifactId: rawVendorArtifactId ?? normalizedArtifact.id,
        confidence: entry.confidence
      }))
    );

    const reviewItems = buildReviewItems({
      extraction: sanitizedExtraction,
      sections,
      artifactId: normalizedArtifact.id
    });

    await repository.replaceDocumentReviewItems(
      document.id,
      runId,
      reviewItems
    );

    await saveObservabilityArtifact({
      documentId: document.id,
      runId,
      step: "extract_fields",
      processor: routeProcessor ?? sanitizedExtraction.model,
      payload: {
        event: "extract_fields_metrics",
        extractionRoute: routing.extractionRoute,
        processor: routeProcessor ?? routing.processor,
        usedFallback: false,
        pageCount,
        entityCount,
        evidenceCount: extractionEvidence.length,
        conflictCount: sanitizedExtraction.conflicts.length,
        reviewItemCount: reviewItems.length,
        confidence: sanitizedExtraction.confidence,
        estimatedCostUsd: estimateDocumentAiCostUsd(routing.processor, pageCount)
      }
    });

    return sanitizedExtraction;
  });
}

export async function runMergeResultsStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "merge_results" }, async ({ document, viewer }) => {
    const repository = getRepository();
    const extraction = await loadExtractionFromRecords(document);
    const latestAggregate = await repository.getDealAggregate(viewer.id, document.dealId);

    if (!latestAggregate) {
      throw new Error("Deal not found.");
    }

    const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
    const isFirstDocument = latestAggregate.terms === null;
    const existingTerms = latestAggregate.terms ?? createEmptyTerms(latestAggregate.deal);
    const isIntakeDocument =
      latestAggregate.deal.confirmedAt &&
      document.createdAt <= latestAggregate.deal.confirmedAt;
    const currentTerms = withPreferredCreatorName(existingTerms, preferredCreatorName) as DealAggregate["terms"] extends infer T
      ? NonNullable<T>
      : never;
    const mergePlan = planExtractionMerge(currentTerms, extraction);
    const nextTerms = mergeTerms(currentTerms, mergePlan.autoApplied, {
      manuallyEditedFields: latestAggregate.terms?.manuallyEditedFields ?? []
    });

    const shouldPersistTerms =
      isFirstDocument ||
      isIntakeDocument ||
      hasMeaningfulChanges(currentTerms, mergePlan.autoApplied);

    if (shouldPersistTerms) {
      await repository.upsertTerms(document.dealId, nextTerms);
      if (process.env.DATABASE_URL) {
        await syncPaymentRecordForDeal(document.dealId, nextTerms);
      }
    }

    if (mergePlan.hasPendingChanges) {
      const existingPending = latestAggregate.terms?.pendingExtraction as PendingExtractionData | null;
      const pendingData = existingPending
        ? coalesceExtractions(existingPending, mergePlan.pending, (base, patch) => {
            const full = { ...base, pendingExtraction: null };
            const merged = mergeTerms(full, patch);
            const { pendingExtraction: _pending, ...rest } = merged;
            return rest as PendingExtractionData;
          })
        : mergePlan.pending;

      await repository.savePendingExtraction(document.dealId, pendingData);
    }

    await repository.updateDeal(viewer.id, document.dealId, {
      analyzedAt: new Date().toISOString(),
      nextDeliverableDate: earliestDeliverableDate(nextTerms),
      brandName: nextTerms.brandName ?? latestAggregate.deal.brandName,
      campaignName: nextTerms.campaignName ?? latestAggregate.deal.campaignName
    });

    await assertCurrentRun(document.id, runId);
    return extraction;
  });
}

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

export function getDocumentPipelineFailedStep(error: unknown) {
  return parseFailedStep(error);
}
