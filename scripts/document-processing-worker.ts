import type { MessageMetadata } from "@vercel/queue";

import {
  DOCUMENT_PROCESSING_TOPIC,
  getDocumentProcessingBackend,
  getDocumentProcessingConsumerGroup,
  getDocumentProcessingQueueClient,
  getDocumentProcessingQueueRegion,
  isPermanentDocumentProcessingError,
  type DocumentProcessingMessage
} from "../lib/document-processing";
import { processDocumentById } from "../lib/deals";

function parseInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const idleMs = Math.max(
  parseInteger(process.env.DOCUMENT_PROCESSING_QUEUE_POLL_INTERVAL_MS, 2000),
  250
);
const batchSize = clamp(
  parseInteger(process.env.DOCUMENT_PROCESSING_QUEUE_BATCH_SIZE, 1),
  1,
  10
);
const visibilityTimeoutSeconds = clamp(
  parseInteger(process.env.DOCUMENT_PROCESSING_QUEUE_VISIBILITY_TIMEOUT_SECONDS, 900),
  30,
  3600
);
const runOnce = process.argv.includes("--once");

let stopping = false;

async function handleMessage(
  message: DocumentProcessingMessage,
  metadata: MessageMetadata
) {
  if (!message?.documentId) {
    console.error("[document-worker] acknowledging malformed message", {
      messageId: metadata.messageId
    });
    return;
  }

  try {
    await processDocumentById(message.documentId);
    console.info("[document-worker] processed", {
      messageId: metadata.messageId,
      documentId: message.documentId,
      deliveryCount: metadata.deliveryCount
    });
  } catch (error) {
    if (isPermanentDocumentProcessingError(error)) {
      console.error("[document-worker] permanent failure acknowledged", {
        messageId: metadata.messageId,
        documentId: message.documentId,
        deliveryCount: metadata.deliveryCount,
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    throw error;
  }
}

async function pollOnce() {
  return getDocumentProcessingQueueClient().receive<DocumentProcessingMessage>(
    DOCUMENT_PROCESSING_TOPIC,
    getDocumentProcessingConsumerGroup(),
    handleMessage,
    {
      limit: batchSize,
      visibilityTimeoutSeconds
    }
  );
}

async function main() {
  if (getDocumentProcessingBackend() !== "vercel-queue") {
    throw new Error(
      "Set DOCUMENT_PROCESSING_BACKEND=vercel-queue before starting the document worker."
    );
  }

  console.info("[document-worker] starting", {
    topic: DOCUMENT_PROCESSING_TOPIC,
    consumerGroup: getDocumentProcessingConsumerGroup(),
    region: getDocumentProcessingQueueRegion(),
    batchSize,
    visibilityTimeoutSeconds,
    runOnce
  });

  while (!stopping) {
    try {
      const result = await pollOnce();

      if (!result.ok) {
        if (result.reason !== "empty") {
          console.warn("[document-worker] no message processed", result);
        }

        if (runOnce) {
          return;
        }

        await sleep(idleMs);
      } else if (runOnce) {
        return;
      }
    } catch (error) {
      console.error("[document-worker] poll failed", {
        error: error instanceof Error ? error.message : String(error)
      });

      if (runOnce) {
        throw error;
      }

      await sleep(idleMs);
    }
  }

  console.info("[document-worker] stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

void main().catch((error) => {
  console.error("[document-worker] fatal", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
