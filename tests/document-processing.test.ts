import { afterEach, describe, expect, test, vi } from "vitest";

import {
  getDocumentProcessingBackend,
  getDocumentProcessingConsumerGroup,
  isPermanentDocumentProcessingError
} from "@/lib/document-processing";

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.DOCUMENT_PROCESSING_BACKEND;
  delete process.env.DOCUMENT_PROCESSING_QUEUE_REGION;
  delete process.env.DOCUMENT_PROCESSING_QUEUE_CONSUMER_GROUP;
  delete process.env.INNGEST_EVENT_KEY;
});

describe("document processing backend", () => {
  test("uses the explicit queue backend when configured", () => {
    vi.stubEnv("DOCUMENT_PROCESSING_BACKEND", "vercel-queue");
    vi.stubEnv("INNGEST_EVENT_KEY", "event-key");

    expect(getDocumentProcessingBackend()).toBe("vercel-queue");
  });

  test("falls back to inngest when no explicit backend is set", () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "event-key");

    expect(getDocumentProcessingBackend()).toBe("inngest");
  });

  test("prefers the queue backend when a queue region is configured", () => {
    vi.stubEnv("DOCUMENT_PROCESSING_QUEUE_REGION", "iad1");
    vi.stubEnv("INNGEST_EVENT_KEY", "event-key");

    expect(getDocumentProcessingBackend()).toBe("vercel-queue");
  });

  test("falls back to local without queue or inngest config", () => {
    expect(getDocumentProcessingBackend()).toBe("local");
  });

  test("uses the configured consumer group when present", () => {
    vi.stubEnv(
      "DOCUMENT_PROCESSING_QUEUE_CONSUMER_GROUP",
      "custom-document-worker"
    );

    expect(getDocumentProcessingConsumerGroup()).toBe("custom-document-worker");
  });
});

describe("document processing error classification", () => {
  test("treats malformed PDF parse failures as permanent", () => {
    expect(
      isPermanentDocumentProcessingError(
        new Error("pipeline: extract_text: bad XRef entry")
      )
    ).toBe(true);
    expect(
      isPermanentDocumentProcessingError(
        new Error("pipeline: extract_text: invalid top-level pages dictionary")
      )
    ).toBe(true);
  });

  test("leaves transient errors retriable", () => {
    expect(
      isPermanentDocumentProcessingError(new Error("database connection reset"))
    ).toBe(false);
  });
});
