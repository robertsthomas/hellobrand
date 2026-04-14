import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const repositoryMock = {
  getDocument: vi.fn(),
  updateDocumentRun: vi.fn(),
  createDocumentRun: vi.fn(),
  updateDocument: vi.fn(),
};

const failDocumentProcessingRunMock = vi.fn();
const inngestSendMock = vi.fn();
const logDocumentPipelineMock = vi.fn();

vi.mock("@/lib/repository", () => ({
  getRepository: () => repositoryMock,
}));

vi.mock("@/lib/document-pipeline-shared", () => ({
  createDocumentProcessingRunState: vi.fn((runId: string) => ({
    runId,
    steps: {},
  })),
}));

vi.mock("@/lib/pipeline-steps", () => ({
  DocumentRunSupersededError: class extends Error {},
  failDocumentProcessingRun: failDocumentProcessingRunMock,
  getDocumentPipelineFailedStep: vi.fn(() => null),
  runDocumentPipelineSteps: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  createSignedUploadTarget: vi.fn(),
  storeUploadedBytes: vi.fn(),
  supportsDirectStorageUploads: vi.fn(() => false),
}));

vi.mock("@/lib/intake-state", () => ({
  syncIntakeSessionForDealId: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
  },
}));

vi.mock("@/lib/deals/shared", () => ({
  getViewerById: vi.fn(),
  inferPastedTextFileName: vi.fn(),
  logDocumentPipeline: logDocumentPipelineMock,
  queueAssistantSnapshotRefresh: vi.fn(),
}));

describe("enqueueDocumentProcessing", () => {
  const originalEventKey = process.env.INNGEST_EVENT_KEY;

  beforeEach(() => {
    repositoryMock.getDocument.mockResolvedValue({
      id: "doc-1",
      dealId: "deal-1",
      userId: "user-1",
      fileName: "contract.pdf",
      processingRunId: null,
    });
    repositoryMock.updateDocumentRun.mockResolvedValue(null);
    repositoryMock.createDocumentRun.mockResolvedValue(null);
    repositoryMock.updateDocument.mockResolvedValue(null);
    failDocumentProcessingRunMock.mockReset();
    inngestSendMock.mockReset();
    logDocumentPipelineMock.mockReset();
  });

  afterEach(() => {
    process.env.INNGEST_EVENT_KEY = originalEventKey;
  });

  test("requires Inngest config and fails the run instead of falling back locally", async () => {
    delete process.env.INNGEST_EVENT_KEY;

    const { enqueueDocumentProcessing } = await import("@/lib/deals/documents");

    await expect(enqueueDocumentProcessing("doc-1")).rejects.toThrow(
      "Inngest document processing is required but INNGEST_EVENT_KEY is not configured."
    );

    expect(failDocumentProcessingRunMock).toHaveBeenCalledWith({
      documentId: "doc-1",
      runId: expect.any(String),
      message:
        "Inngest document processing is required but INNGEST_EVENT_KEY is not configured.",
    });
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  test("fails the run when Inngest enqueue errors", async () => {
    process.env.INNGEST_EVENT_KEY = "test-key";
    inngestSendMock.mockRejectedValue(new Error("queue offline"));

    const { enqueueDocumentProcessing } = await import("@/lib/deals/documents");

    await expect(enqueueDocumentProcessing("doc-1")).rejects.toThrow("queue offline");

    expect(failDocumentProcessingRunMock).toHaveBeenCalledWith({
      documentId: "doc-1",
      runId: expect.any(String),
      message: "queue offline",
    });
    expect(logDocumentPipelineMock).toHaveBeenCalledWith(
      "error",
      "inngest_enqueue_failed",
      expect.objectContaining({
        documentId: "doc-1",
        error: "queue offline",
      })
    );
  });

  test("enqueues on Inngest without any local fallback path", async () => {
    process.env.INNGEST_EVENT_KEY = "test-key";
    inngestSendMock.mockResolvedValue(undefined);

    const { enqueueDocumentProcessing } = await import("@/lib/deals/documents");

    await expect(enqueueDocumentProcessing("doc-1")).resolves.toEqual({
      mode: "inngest",
      runId: expect.any(String),
    });

    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "document/process.requested",
      data: {
        documentId: "doc-1",
        runId: expect.any(String),
      },
    });
    expect(failDocumentProcessingRunMock).not.toHaveBeenCalled();
  });
});
