import { PollingQueueClient } from "@vercel/queue";

export const DOCUMENT_PROCESSING_TOPIC = "document-processing";

const DEFAULT_DOCUMENT_PROCESSING_CONSUMER_GROUP = "document-processing-worker";

export type DocumentProcessingBackend = "vercel-queue" | "local";

export type DocumentProcessingMessage = {
  documentId: string;
};

const DOCUMENT_PROCESSING_BACKENDS = new Set<DocumentProcessingBackend>([
  "vercel-queue",
  "local"
]);

let queueClient: PollingQueueClient | null = null;

export function getDocumentProcessingBackend(): DocumentProcessingBackend {
  const configured = process.env.DOCUMENT_PROCESSING_BACKEND;

  if (
    configured &&
    DOCUMENT_PROCESSING_BACKENDS.has(configured as DocumentProcessingBackend)
  ) {
    return configured as DocumentProcessingBackend;
  }

  if (process.env.DOCUMENT_PROCESSING_QUEUE_REGION?.trim()) {
    return "vercel-queue";
  }

  return "local";
}

export function getDocumentProcessingQueueRegion() {
  const region = process.env.DOCUMENT_PROCESSING_QUEUE_REGION?.trim();

  if (!region) {
    throw new Error("Missing DOCUMENT_PROCESSING_QUEUE_REGION.");
  }

  return region;
}

export function getDocumentProcessingConsumerGroup() {
  return (
    process.env.DOCUMENT_PROCESSING_QUEUE_CONSUMER_GROUP?.trim() ||
    DEFAULT_DOCUMENT_PROCESSING_CONSUMER_GROUP
  );
}

export function getDocumentProcessingQueueClient() {
  if (!queueClient) {
    queueClient = new PollingQueueClient({
      region: getDocumentProcessingQueueRegion(),
      // Document jobs are intentionally consumed by a separate worker, so do not
      // pin them to the current Vercel deployment.
      deploymentId: null,
      ...(process.env.VERCEL_QUEUE_API_TOKEN
        ? { token: process.env.VERCEL_QUEUE_API_TOKEN }
        : {})
    });
  }

  return queueClient;
}

export async function sendDocumentProcessingMessage(documentId: string) {
  return getDocumentProcessingQueueClient().send<DocumentProcessingMessage>(
    DOCUMENT_PROCESSING_TOPIC,
    { documentId },
    { idempotencyKey: documentId }
  );
}

export function isPermanentDocumentProcessingError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (!message) {
    return false;
  }

  return (
    message === "Document not found." ||
    message.includes("pipeline: extract_text:") ||
    message.includes("We could not reliably parse this file.") ||
    message.includes("Only PDF, DOCX, and pasted text are supported") ||
    message.includes("invalid top-level pages dictionary") ||
    message.includes("bad XRef entry")
  );
}
