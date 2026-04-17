/**
 * Pipeline run lifecycle: loading documents, tracking state, executing steps, and handling failures.
 */
import { getViewerById } from "@/lib/auth";
import {
  createDocumentProcessingRunState,
  DOCUMENT_PIPELINE_STEPS,
  getDocumentProcessingRunState,
  isDocumentPipelineStepComplete,
  logDocumentPipeline,
  markDocumentPipelineRunFailed,
  markDocumentPipelineStepComplete,
  reconstructExtractionPipelineResult
} from "@/lib/document-pipeline-shared";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { getRepository } from "@/lib/repository";
import { saveObservabilityArtifact } from "@/lib/pipeline/artifacts";
import type { DocumentRecord, JobType, Viewer } from "@/lib/types";

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

export async function assertCurrentRun(documentId: string, runId: string) {
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

export function parseFailedStep(error: unknown): JobType | null {
  const message = getErrorMessage(error);

  for (const step of DOCUMENT_PIPELINE_STEPS) {
    if (message.startsWith(`${step}:`)) {
      return step;
    }
  }

  return null;
}

export async function executePipelineStep<T>(
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

export async function loadExtractionFromRecords(document: DocumentRecord) {
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
