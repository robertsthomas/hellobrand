import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDocumentProcessingRunState } from "@/lib/document-pipeline-shared";

const originalVercel = process.env.VERCEL;
const originalTmpDir = process.env.TMPDIR;

let runtimeTmpDir: string;

beforeEach(async () => {
  runtimeTmpDir = await mkdtemp(path.join(os.tmpdir(), "hb-doc-v2-"));
  process.env.VERCEL = "1";
  process.env.TMPDIR = runtimeTmpDir;
  vi.resetModules();
});

afterEach(async () => {
  if (originalVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = originalVercel;
  }

  if (originalTmpDir === undefined) {
    delete process.env.TMPDIR;
  } else {
    process.env.TMPDIR = originalTmpDir;
  }

  await rm(runtimeTmpDir, { recursive: true, force: true });
});

describe("document v2 persistence", () => {
  test("stores runs, artifacts, field evidence, and review items in the repository", async () => {
    const { FileRepository } = await import("@/lib/repository/file-repository");

    const repository = new FileRepository();
    const document = await repository.getDocument("demo-document");
    expect(document).not.toBeNull();

    const runId = "run-test-1";
    const stepStateJson = createDocumentProcessingRunState(runId);

    await repository.createDocumentRun({
      id: runId,
      documentId: document!.id,
      status: "pending",
      stepStateJson,
      startedAt: "2026-04-09T12:00:00.000Z",
      completedAt: null,
      failedAt: null,
      failureMessage: null
    });

    await repository.updateDocumentRun(runId, {
      status: "processing"
    });

    const artifact = await repository.createDocumentArtifact({
      documentId: document!.id,
      runId,
      step: "extract_fields",
      kind: "normalized_extraction",
      processor: "test-model",
      payload: {
        paymentTerms: "Net 45",
        paymentAmount: 2000
      }
    });

    await repository.replaceDocumentFieldEvidence(document!.id, runId, [
      {
        fieldPath: "paymentTerms",
        snippet: "Brand shall pay Creator $2,000 net 45 after invoice.",
        sourceType: "section",
        sectionId: "section-1",
        artifactId: artifact.id,
        confidence: 0.42
      }
    ]);

    await repository.replaceDocumentReviewItems(document!.id, runId, [
      {
        fieldPath: "paymentTerms",
        status: "open",
        reason: "low_confidence",
        title: "Review low-confidence paymentTerms",
        detail: "Extraction confidence was below threshold.",
        confidence: 0.42,
        suggestedValue: "Net 45",
        currentValue: null,
        sectionId: "section-1",
        artifactId: artifact.id
      }
    ]);

    const aggregate = await repository.getDealAggregate("demo-user", "demo-deal");
    expect(aggregate).not.toBeNull();
    expect(aggregate!.documentRuns[0]?.id).toBe(runId);
    expect(aggregate!.documentArtifacts[0]?.id).toBe(artifact.id);
    expect(aggregate!.documentFieldEvidence[0]?.artifactId).toBe(artifact.id);
    expect(aggregate!.documentReviewItems[0]?.reason).toBe("low_confidence");
  });
});
