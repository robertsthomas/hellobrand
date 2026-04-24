/**
 * Document upload, direct-upload, and Inngest-enqueued processing for deals.
 * All pipeline processing goes through Inngest — there is no local fallback.
 */
import { randomUUID } from "node:crypto";

import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { getRepository } from "@/lib/repository";
import {
  createDocumentProcessingRunState
} from "@/lib/document-pipeline-shared";
import { failDocumentProcessingRun } from "@/lib/pipeline-steps";
import {
  createSignedUploadTarget,
  storeUploadedBytes,
  supportsDirectStorageUploads
} from "@/lib/storage";
import type {
  DocumentKind,
  DocumentRecord,
  Viewer
} from "@/lib/types";
import {
  inferPastedTextFileName,
  logDocumentPipeline,
  queueAssistantSnapshotRefresh,
} from "./shared";

async function startDocumentProcessingRun(documentId: string) {
  const repository = getRepository();
  const document = await repository.getDocument(documentId);

  if (!document) {
    throw new Error("Document not found.");
  }

  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  if (document.processingRunId) {
    await repository.updateDocumentRun(document.processingRunId, {
      status: "superseded"
    });
  }

  await repository.createDocumentRun({
    id: runId,
    documentId,
    status: "pending",
    stepStateJson: createDocumentProcessingRunState(runId),
    startedAt,
    completedAt: null,
    failedAt: null,
    failureMessage: null
  });

  await repository.updateDocument(documentId, {
    processingStatus: "pending",
    errorMessage: null,
    processingRunId: runId,
    processingRunStateJson: createDocumentProcessingRunState(runId),
    processingStartedAt: startedAt
  });

  return { runId, documentId };
}

export async function enqueueDocumentProcessing(documentId: string) {
  const startedRun = await startDocumentProcessingRun(documentId);
  const eventKey = process.env.INNGEST_EVENT_KEY;

  if (!eventKey) {
    const message = "Inngest document processing is required but INNGEST_EVENT_KEY is not configured.";
    await failDocumentProcessingRun({
      documentId,
      runId: startedRun.runId,
      message
    });
    throw new Error(message);
  }

  try {
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send({
      id: `document-process-requested-${startedRun.runId}`,
      name: "document/process.requested",
      data: { documentId, runId: startedRun.runId }
    });
    logDocumentPipeline("info", "queue_enqueued", {
      documentId,
      runId: startedRun.runId,
      mode: "inngest"
    });
    return { mode: "inngest" as const, runId: startedRun.runId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to enqueue Inngest event.";
    logDocumentPipeline("error", "inngest_enqueue_failed", {
      documentId,
      runId: startedRun.runId,
      error: message
    });
    await failDocumentProcessingRun({
      documentId,
      runId: startedRun.runId,
      message
    });
    throw new Error(message);
  }
}

interface DirectUploadFileRegistration {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
}

interface RegisteredDirectDocumentUpload {
  documentId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
  bucket: string;
  objectPath: string;
  token: string;
}

export async function registerDirectDocumentUploadsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    files?: DirectUploadFileRegistration[];
    pastedText?: string | null;
    documentKindHint?: DocumentKind | null;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const files = (input.files ?? []).filter((file) => file.fileSizeBytes > 0);
  const pastedText = input.pastedText?.trim() ?? null;

  if (files.length === 0 && !pastedText) {
    throw new Error("Please upload at least one file or paste document text.");
  }

  if (files.length > 0 && !supportsDirectStorageUploads()) {
    return {
      mode: "legacy" as const,
      uploads: [] as RegisteredDirectDocumentUpload[],
      documents: [] as DocumentRecord[],
      pastedDocumentIds: [] as string[]
    };
  }

  const createdDocuments: DocumentRecord[] = [];
  const uploads: RegisteredDirectDocumentUpload[] = [];
  const pastedDocumentIds: string[] = [];

  for (const file of files) {
    const target = await createSignedUploadTarget({
      fileName: file.fileName,
      folder: dealId
    });

    const document = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: file.fileName,
      mimeType: file.mimeType || "application/octet-stream",
      storagePath: target.storagePath,
      fileSizeBytes: file.fileSizeBytes,
      checksumSha256: file.checksumSha256,
      processingStatus: "pending",
      rawText: null,
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "file",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(document);
    uploads.push({
      documentId: document.id,
      fileName: file.fileName,
      mimeType: file.mimeType || "application/octet-stream",
      fileSizeBytes: file.fileSizeBytes,
      checksumSha256: file.checksumSha256,
      bucket: target.bucket,
      objectPath: target.objectPath,
      token: target.token
    });
  }

  if (pastedText) {
    const title = inferPastedTextFileName(pastedText);
    const pastedDocument = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: title,
      mimeType: "text/plain",
      storagePath: `pasted:${title}`,
      fileSizeBytes: Buffer.byteLength(pastedText, "utf8"),
      checksumSha256: null,
      processingStatus: "pending",
      rawText: pastedText,
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "pasted_text",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(pastedDocument);
    pastedDocumentIds.push(pastedDocument.id);
  }

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(dealId);
  }

  return {
    mode: "direct" as const,
    uploads,
    documents: createdDocuments,
    pastedDocumentIds
  };
}

export async function completeDirectDocumentUploadsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    succeededDocumentIds: string[];
    failedUploads: Array<{ documentId: string; errorMessage: string }>;
    startProcessing?: boolean;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const createdDocuments = aggregate.documents.filter((document) =>
    document.userId === viewer.id &&
    [...input.succeededDocumentIds, ...input.failedUploads.map((entry) => entry.documentId)].includes(
      document.id
    )
  );

  for (const failure of input.failedUploads) {
    await getRepository().updateDocument(failure.documentId, {
      processingStatus: "failed",
      errorMessage: failure.errorMessage
    });
  }

  if (input.startProcessing !== false) {
    for (const documentId of input.succeededDocumentIds) {
      await enqueueDocumentProcessing(documentId);
    }
  }

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(dealId);
  }

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return {
    documents: createdDocuments,
    succeededCount: input.succeededDocumentIds.length,
    failedCount: input.failedUploads.length
  };
}

export async function uploadDocumentsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    files?: File[];
    pastedText?: string | null;
    documentKindHint?: DocumentKind | null;
    startProcessing?: boolean;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const createdDocuments: DocumentRecord[] = [];
  const files = (input.files ?? []).filter((file) => file.size > 0);

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storeUploadedBytes({
      fileName: file.name,
      bytes,
      contentType: file.type || "application/octet-stream",
      folder: dealId
    });
    const document = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      storagePath,
      fileSizeBytes: file.size,
      checksumSha256: null,
      processingStatus: "pending",
      rawText: null,
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "file",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(document);
  }

  if (input.pastedText?.trim()) {
    const title = inferPastedTextFileName(input.pastedText.trim());
    const pastedDocument = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: title,
      mimeType: "text/plain",
      storagePath: `pasted:${title}`,
      fileSizeBytes: Buffer.byteLength(input.pastedText.trim(), "utf8"),
      checksumSha256: null,
      processingStatus: "pending",
      rawText: input.pastedText.trim(),
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "pasted_text",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(pastedDocument);
  }

  if (createdDocuments.length === 0) {
    throw new Error("Please upload at least one file or paste document text.");
  }

  if (input.startProcessing !== false) {
    for (const document of createdDocuments) {
      await enqueueDocumentProcessing(document.id);
    }
  }

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(dealId);
  }

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return getRepository().getDealAggregate(viewer.id, dealId);
}

export async function reprocessDocumentForViewer(
  viewer: Viewer,
  documentId: string
) {
  const document = await getRepository().getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  const aggregate = await getRepository().getDealAggregate(viewer.id, document.dealId);
  if (!aggregate || !aggregate.deal || aggregate.deal.userId !== viewer.id) {
    throw new Error("Document not found.");
  }

  await enqueueDocumentProcessing(document.id);

  return getRepository().getDealAggregate(viewer.id, document.dealId);
}
