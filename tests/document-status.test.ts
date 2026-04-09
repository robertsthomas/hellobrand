import { describe, expect, test } from "vitest";

import { getDocumentDisplayStatus } from "@/lib/document-status";
import type { DocumentRecord, DocumentReviewItemRecord, JobRecord } from "@/lib/types";

function makeDocument(overrides?: Partial<DocumentRecord>): DocumentRecord {
  return Object.assign(
    {
      id: "doc-1",
      dealId: "deal-1",
      userId: "user-1",
    fileName: "contract.pdf",
    mimeType: "application/pdf",
    storagePath: "/tmp/contract.pdf",
    fileSizeBytes: null,
    checksumSha256: null,
    processingStatus: "pending",
    rawText: null,
    normalizedText: null,
    documentKind: "contract",
    classificationConfidence: null,
    sourceType: "file",
    errorMessage: null,
    processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null,
      createdAt: "2026-04-09T12:00:00.000Z",
      updatedAt: "2026-04-09T12:00:00.000Z"
    },
    overrides,
    {
      fileSizeBytes: overrides?.fileSizeBytes ?? null,
      checksumSha256: overrides?.checksumSha256 ?? null
    }
  );
}

function makeJob(overrides?: Partial<JobRecord>): JobRecord {
  return {
    id: "job-1",
    dealId: "deal-1",
    documentId: "doc-1",
    type: "extract_text",
    status: "processing",
    attemptCount: 1,
    createdAt: "2026-04-09T12:00:00.000Z",
    updatedAt: "2026-04-09T12:00:00.000Z",
    failureReason: null,
    ...overrides
  };
}

function makeReviewItem(overrides?: Partial<DocumentReviewItemRecord>): DocumentReviewItemRecord {
  return {
    id: "review-1",
    documentId: "doc-1",
    runId: "run-1",
    fieldPath: "paymentTerms",
    status: "open",
    reason: "low_confidence",
    title: "Review payment terms",
    detail: "Low confidence",
    confidence: 0.4,
    suggestedValue: "Net 45",
    currentValue: null,
    sectionId: null,
    artifactId: null,
    createdAt: "2026-04-09T12:00:00.000Z",
    updatedAt: "2026-04-09T12:00:00.000Z",
    ...overrides
  };
}

describe("document display status", () => {
  test("shows uploaded for pending documents", () => {
    const status = getDocumentDisplayStatus({
      document: makeDocument()
    });

    expect(status.state).toBe("uploaded");
    expect(status.label).toBe("Uploaded");
  });

  test("shows parsing for early-stage processing jobs", () => {
    const status = getDocumentDisplayStatus({
      document: makeDocument({
        processingStatus: "processing",
        processingRunId: "run-1",
        processingRunStateJson: {
          runId: "run-1",
          completedSteps: [],
          stepCompletedAt: {},
          failedStep: null,
          failedAt: null,
          lastError: null
        }
      }),
      jobs: [makeJob({ type: "section_document" })]
    });

    expect(status.state).toBe("parsing");
  });

  test("shows review needed for ready documents with open review items", () => {
    const status = getDocumentDisplayStatus({
      document: makeDocument({
        processingStatus: "ready"
      }),
      reviewItems: [makeReviewItem()]
    });

    expect(status.state).toBe("review_needed");
    expect(status.reviewCount).toBe(1);
  });
});
