import { describe, expect, test } from "vitest";

import { buildAppliedTerms, planExtractionMerge } from "@/lib/pending-changes";
import type { DealTermsRecord, ExtractionPipelineResult } from "@/lib/types";

function makeTerms(overrides?: Partial<DealTermsRecord>): DealTermsRecord {
  return {
    id: "terms-1",
    dealId: "deal-1",
    brandName: "Lunchables",
    agencyName: null,
    creatorName: "Thomas Roberts",
    campaignName: "Spring Push",
    paymentAmount: 3000,
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
    briefData: null,
    pendingExtraction: null,
    createdAt: "2026-04-09T12:00:00.000Z",
    updatedAt: "2026-04-09T12:00:00.000Z",
    ...overrides
  };
}

function makeExtraction(
  overrides?: Partial<ExtractionPipelineResult>
): ExtractionPipelineResult {
  return {
    schemaVersion: "v1",
    model: "test",
    confidence: 0.9,
    data: {
      brandName: "Lunchables",
      agencyName: null,
      creatorName: "Thomas Roberts",
      campaignName: "Spring Push",
      paymentAmount: 5000,
      currency: "USD",
      paymentTerms: "Net 45",
      paymentStructure: null,
      netTermsDays: 45,
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
    evidence: [],
    conflicts: [],
    ...overrides
  };
}

describe("pending change merge planning", () => {
  test("auto-applies high-confidence fields and sends low-confidence/conflicting fields to pending review", () => {
    const current = makeTerms({
      manuallyEditedFields: ["brandName"]
    });
    const extraction = makeExtraction({
      data: {
        ...makeExtraction().data,
        brandName: "Lunchables Family",
        paymentAmount: 5000,
        paymentTerms: "Net 45"
      },
      evidence: [
        { fieldPath: "brandName", snippet: "Lunchables Family", sectionKey: null, confidence: 0.96 },
        { fieldPath: "paymentAmount", snippet: "$5,000", sectionKey: null, confidence: 0.52 },
        { fieldPath: "paymentTerms", snippet: "Net 45", sectionKey: null, confidence: 0.92 }
      ],
      conflicts: ["paymentAmount"]
    });

    const plan = planExtractionMerge(current, extraction);

    expect(plan.autoApplied.paymentTerms).toBe("Net 45");
    expect(plan.autoApplied.paymentAmount).toBe(3000);
    expect(plan.autoApplied.brandName).toBe("Lunchables");
    expect(plan.pending.paymentAmount).toBe(5000);
    expect(plan.pending.brandName).toBe("Lunchables Family");
    expect(plan.hasPendingChanges).toBe(true);
  });

  test("manual acceptance protects accepted fields from future overwrite", () => {
    const current = makeTerms({
      pendingExtraction: {
        ...makeTerms(),
        paymentTerms: "Net 45"
      }
    });

    const applied = buildAppliedTerms(
      current,
      current.pendingExtraction!,
      ["paymentTerms"]
    );

    expect(applied.paymentTerms).toBe("Net 45");
    expect(applied.manuallyEditedFields).toContain("paymentTerms");
    expect(applied.pendingExtraction).toBeNull();
  });
});
