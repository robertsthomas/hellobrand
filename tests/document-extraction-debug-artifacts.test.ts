import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { writeExtractionDebugSnapshot } from "@/lib/document-pipeline-shared";
import type { DocumentRecord, ExtractionPipelineResult } from "@/lib/types";

const originalDebugDir = process.env.HELLOBRAND_EXTRACTION_DEBUG_DIR;
const originalDebugFlag = process.env.HELLOBRAND_EXTRACTION_DEBUG_ARTIFACTS;

let debugDir: string;

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    dealId: "deal-1",
    userId: "user-1",
    fileName: "Brand Brief.pdf",
    mimeType: "application/pdf",
    storagePath: "/tmp/brand-brief.pdf",
    fileSizeBytes: 1024,
    checksumSha256: null,
    processingStatus: "processing",
    rawText: "Raw campaign brief",
    normalizedText: "Campaign Brief\nVelvet Kitchen",
    documentKind: "campaign_brief",
    classificationConfidence: 0.91,
    sourceType: "file",
    errorMessage: null,
    processingRunId: "run-1",
    processingRunStateJson: null,
    processingStartedAt: "2026-04-25T12:00:00.000Z",
    createdAt: "2026-04-25T12:00:00.000Z",
    updatedAt: "2026-04-25T12:00:00.000Z",
    ...overrides,
  };
}

function makeExtraction(): ExtractionPipelineResult {
  return {
    schemaVersion: "v1",
    model: "fallback:v1",
    confidence: 0.78,
    data: {
      brandName: "Velvet Kitchen",
      agencyName: null,
      creatorName: null,
      campaignName: "Spring Recipe Sprint",
      paymentAmount: null,
      currency: "USD",
      paymentTerms: null,
      paymentStructure: null,
      netTermsDays: null,
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
      briefData: {
        campaignOverview: "Recipe sprint brief",
        messagingPoints: [],
        talkingPoints: [],
        creativeConceptOverview: null,
        brandGuidelines: null,
        approvalRequirements: null,
        targetAudience: null,
        toneAndStyle: null,
        doNotMention: [],
        sourceDocumentIds: ["doc-1"],
      },
    },
    conflicts: [],
    evidence: [
      {
        fieldPath: "brandName",
        snippet: "Velvet Kitchen",
        sectionKey: "section:0",
        confidence: 0.91,
      },
    ],
  };
}

beforeEach(async () => {
  debugDir = await mkdtemp(path.join(os.tmpdir(), "hb-extraction-debug-"));
  process.env.HELLOBRAND_EXTRACTION_DEBUG_DIR = debugDir;
  delete process.env.HELLOBRAND_EXTRACTION_DEBUG_ARTIFACTS;
});

afterEach(async () => {
  if (originalDebugDir === undefined) {
    delete process.env.HELLOBRAND_EXTRACTION_DEBUG_DIR;
  } else {
    process.env.HELLOBRAND_EXTRACTION_DEBUG_DIR = originalDebugDir;
  }

  if (originalDebugFlag === undefined) {
    delete process.env.HELLOBRAND_EXTRACTION_DEBUG_ARTIFACTS;
  } else {
    process.env.HELLOBRAND_EXTRACTION_DEBUG_ARTIFACTS = originalDebugFlag;
  }

  await rm(debugDir, { recursive: true, force: true });
});

describe("document extraction debug artifacts", () => {
  test("writes the full extraction snapshot to the configured tmp directory", async () => {
    const filePath = writeExtractionDebugSnapshot({
      runId: "run-1",
      document: makeDocument(),
      routing: {
        extractionRoute: "brief_v2",
        processor: "fallback",
        reasons: ["campaign brief"],
      },
      sections: [
        {
          id: "section-1",
          documentId: "doc-1",
          title: "Campaign Brief",
          content: "Velvet Kitchen",
          chunkIndex: 0,
          pageRange: null,
          createdAt: "2026-04-25T12:00:00.000Z",
        },
      ],
      sectionInputs: [
        {
          title: "Campaign Brief",
          content: "Velvet Kitchen",
          chunkIndex: 0,
          pageRange: null,
        },
      ],
      extraction: makeExtraction(),
      extractionEvidence: makeExtraction().evidence,
      reviewItems: [],
      normalizedArtifactId: "artifact-1",
    });

    expect(filePath).toContain(debugDir);
    const files = await readdir(debugDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("Brand_Brief.pdf");

    const payload = JSON.parse(await readFile(filePath!, "utf8")) as {
      event: string;
      document: DocumentRecord;
      extraction: ExtractionPipelineResult;
      routing: { extractionRoute: string };
      sections: unknown[];
      sectionInputs: unknown[];
    };

    expect(payload.event).toBe("extract_fields_debug_snapshot");
    expect(payload.document.normalizedText).toContain("Campaign Brief");
    expect(payload.extraction.data.briefData?.campaignOverview).toBe("Recipe sprint brief");
    expect(payload.routing.extractionRoute).toBe("brief_v2");
    expect(payload.sections).toHaveLength(1);
    expect(payload.sectionInputs).toHaveLength(1);
  });

  test("skips debug writes when disabled by env", async () => {
    process.env.HELLOBRAND_EXTRACTION_DEBUG_ARTIFACTS = "0";

    const filePath = writeExtractionDebugSnapshot({
      runId: "run-disabled",
      document: makeDocument(),
      routing: {},
      sections: [],
      sectionInputs: [],
      extraction: makeExtraction(),
      extractionEvidence: [],
      reviewItems: [],
      normalizedArtifactId: null,
    });

    expect(filePath).toBeNull();
    await expect(readdir(debugDir)).resolves.toEqual([]);
  });
});
