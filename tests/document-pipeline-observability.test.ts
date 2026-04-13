import { describe, expect, test } from "vitest";

import { summarizeDocumentRunObservability } from "@/lib/document-pipeline-observability";
import { createDocumentProcessingRunState } from "@/lib/document-pipeline-shared";
import type { DealAggregate } from "@/lib/types";

describe("document pipeline observability", () => {
  test("summarizes run-level cost, stages, processors, and review items", () => {
    const runId = "run-obs-1";
    const aggregate = {
      documentRuns: [
        {
          id: runId,
          documentId: "doc-1",
          status: "ready",
          stepStateJson: createDocumentProcessingRunState(runId),
          startedAt: "2026-04-09T12:00:00.000Z",
          completedAt: "2026-04-09T12:00:30.000Z",
          failedAt: null,
          failureMessage: null,
          createdAt: "2026-04-09T12:00:00.000Z",
          updatedAt: "2026-04-09T12:00:30.000Z",
        },
      ],
      documentArtifacts: [
        {
          id: "artifact-1",
          documentId: "doc-1",
          runId,
          step: "extract_text",
          kind: "observability",
          processor: "pdfjs-dist",
          payload: {
            event: "extract_text_metrics",
            estimatedCostUsd: 0,
            pageCount: 5,
          },
          createdAt: "2026-04-09T12:00:02.000Z",
        },
        {
          id: "artifact-2",
          documentId: "doc-1",
          runId,
          step: "extract_fields",
          kind: "observability",
          processor: "fallback-merge",
          payload: {
            event: "extract_fields_metrics",
            estimatedCostUsd: 0,
            pageCount: null,
            usedFallback: true,
          },
          createdAt: "2026-04-09T12:00:10.000Z",
        },
        {
          id: "artifact-3",
          documentId: "doc-1",
          runId,
          step: "extract_fields",
          kind: "normalized_extraction",
          processor: "fallback-merge",
          payload: {
            confidence: 0.88,
          },
          createdAt: "2026-04-09T12:00:11.000Z",
        },
        {
          id: "artifact-4",
          documentId: "doc-1",
          runId,
          step: "extract_text",
          kind: "observability",
          processor: null,
          payload: {
            event: "step_result",
            durationMs: 1200,
            failed: false,
          },
          createdAt: "2026-04-09T12:00:03.000Z",
        },
      ],
      documentReviewItems: [
        {
          id: "review-1",
          documentId: "doc-1",
          runId,
          fieldPath: "paymentTerms",
          status: "open",
          reason: "low_confidence",
          title: "Review low-confidence paymentTerms",
          detail: "Low confidence",
          confidence: 0.4,
          suggestedValue: "Net 30",
          currentValue: null,
          sectionId: null,
          artifactId: null,
          createdAt: "2026-04-09T12:00:12.000Z",
          updatedAt: "2026-04-09T12:00:12.000Z",
        },
        {
          id: "review-2",
          documentId: "doc-1",
          runId,
          fieldPath: "brandName",
          status: "open",
          reason: "conflict",
          title: "Review conflicting brandName",
          detail: "Conflict",
          confidence: 0.6,
          suggestedValue: "Lunchables",
          currentValue: null,
          sectionId: null,
          artifactId: null,
          createdAt: "2026-04-09T12:00:12.000Z",
          updatedAt: "2026-04-09T12:00:12.000Z",
        },
      ],
    } satisfies Pick<DealAggregate, "documentRuns" | "documentArtifacts" | "documentReviewItems">;

    const summary = summarizeDocumentRunObservability({
      aggregate,
      runId,
    });

    expect(summary).not.toBeNull();
    expect(summary?.estimatedCostUsd).toBe(0);
    expect(summary?.pagesProcessed).toBe(5);
    expect(summary?.extractionConfidence).toBe(0.88);
    expect(summary?.openReviewItems).toBe(2);
    expect(summary?.fallbackCount).toBe(1);
    expect(summary?.processorsUsed).toEqual(["pdfjs-dist", "fallback-merge"]);
    expect(summary?.stages.extract_text?.durationMs).toBe(1200);
  });
});
