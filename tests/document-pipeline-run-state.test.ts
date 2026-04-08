import { describe, expect, test } from "vitest";

import {
  createDocumentProcessingRunState,
  getDocumentProcessingRunState,
  isDocumentPipelineStepComplete,
  markDocumentPipelineRunFailed,
  markDocumentPipelineStepComplete,
  reconstructExtractionPipelineResult
} from "@/lib/document-pipeline-shared";
import type {
  DocumentRecord,
  DocumentSectionRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord
} from "@/lib/types";

function makeDocument(overrides?: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: "doc-1",
    dealId: "deal-1",
    userId: "user-1",
    fileName: "contract.pdf",
    mimeType: "application/pdf",
    storagePath: "/tmp/contract.pdf",
    processingStatus: "processing",
    rawText: null,
    normalizedText: null,
    documentKind: "contract",
    classificationConfidence: null,
    sourceType: "file",
    errorMessage: null,
    processingRunId: null,
    processingRunStateJson: null,
    processingStartedAt: null,
    createdAt: "2026-04-07T12:00:00.000Z",
    updatedAt: "2026-04-07T12:00:00.000Z",
    ...overrides
  };
}

describe("document pipeline run state", () => {
  test("completed steps only apply to the matching run id", () => {
    const run1 = createDocumentProcessingRunState("run-1");
    const completedRun1 = markDocumentPipelineStepComplete(run1, "extract_text");

    const document = makeDocument({
      processingRunId: "run-1",
      processingRunStateJson: completedRun1
    });

    expect(isDocumentPipelineStepComplete(document, "run-1", "extract_text")).toBe(true);
    expect(isDocumentPipelineStepComplete(document, "run-2", "extract_text")).toBe(false);
  });

  test("documents with a run id but no stored state get a backward-compatible empty state", () => {
    const document = makeDocument({
      processingRunId: "run-1",
      processingRunStateJson: null
    });

    expect(getDocumentProcessingRunState(document)).toEqual({
      runId: "run-1",
      completedSteps: [],
      stepCompletedAt: {},
      failedStep: null,
      failedAt: null,
      lastError: null
    });
  });

  test("failure state is recorded without dropping completed steps", () => {
    const started = createDocumentProcessingRunState("run-1");
    const completed = markDocumentPipelineStepComplete(started, "extract_text");
    const failed = markDocumentPipelineRunFailed(completed, {
      step: "analyze_risks",
      message: "analyze_risks: provider timeout"
    });

    expect(failed.completedSteps).toEqual(["extract_text"]);
    expect(failed.failedStep).toBe("analyze_risks");
    expect(failed.lastError).toContain("provider timeout");
    expect(failed.failedAt).toBeTruthy();
  });

  test("reconstructs persisted extraction evidence back to section keys", () => {
    const result: ExtractionResultRecord = {
      id: "result-1",
      documentId: "doc-1",
      schemaVersion: "v2",
      model: "test-model",
      confidence: 0.9,
      data: {
        brandName: "Northstar",
        agencyName: null,
        creatorName: "Jordan",
        campaignName: "Spring Launch",
        paymentAmount: 2000,
        currency: "USD",
        paymentTerms: "Net 30",
        paymentStructure: null,
        netTermsDays: 30,
        paymentTrigger: null,
        deliverables: [],
        usageRights: null,
        usageRightsOrganicAllowed: null,
        usageRightsPaidAllowed: null,
        whitelistingAllowed: null,
        usageDuration: null,
        usageTerritory: null,
        usageChannels: [],
        exclusivity: null,
        exclusivityApplies: null,
        exclusivityCategory: null,
        exclusivityDuration: null,
        exclusivityRestrictions: null,
        brandCategory: null,
        competitorCategories: [],
        restrictedCategories: [],
        campaignDateWindow: null,
        disclosureObligations: [],
        revisions: null,
        revisionRounds: null,
        termination: null,
        terminationAllowed: null,
        terminationNotice: null,
        terminationConditions: null,
        governingLaw: null,
        notes: null,
        manuallyEditedFields: [],
        briefData: null
      },
      conflicts: [],
      createdAt: "2026-04-07T12:00:00.000Z"
    };

    const evidence: ExtractionEvidenceRecord[] = [
      {
        id: "evidence-1",
        documentId: "doc-1",
        fieldPath: "paymentTerms",
        snippet: "Payment due Net 30.",
        sectionId: "section-1",
        confidence: 0.88,
        createdAt: "2026-04-07T12:00:00.000Z"
      }
    ];

    const sections: DocumentSectionRecord[] = [
      {
        id: "section-1",
        documentId: "doc-1",
        title: "Payment",
        content: "Payment due Net 30.",
        chunkIndex: 4,
        pageRange: null,
        createdAt: "2026-04-07T12:00:00.000Z"
      }
    ];

    const extraction = reconstructExtractionPipelineResult({
      result,
      evidence,
      sections
    });

    expect(extraction.model).toBe("test-model");
    expect(extraction.evidence[0]?.sectionKey).toBe("section:4");
    expect(extraction.data.paymentTerms).toBe("Net 30");
  });
});
