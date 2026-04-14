import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  classifyDocumentHeuristically,
  fallbackAnalyzeDocument,
  fallbackAnalyzeContract,
  splitIntoSections
} from "@/lib/analysis/fallback";
import { buildConflictResults } from "@/lib/conflict-intelligence";
import { mergeTerms } from "@/lib/deals";
import { generateEmailDraft } from "@/lib/email/generate";
import { sanitizeCampaignName } from "@/lib/party-labels";
import { createSeedStore } from "@/lib/repository/seed";
import { extractDocumentText } from "@/lib/documents/extract";
import type { DealAggregate } from "@/lib/types";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/contracts/sample-influencer-contract.txt"),
  "utf8"
);

describe("contract analysis", () => {
  test("classifies a creator agreement as a contract", () => {
    const result = classifyDocumentHeuristically(fixture, "sample-contract.pdf");
    expect(result.documentKind).toBe("contract");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test("splits document text into semantic sections", () => {
    const sections = splitIntoSections(fixture, "contract");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]?.title).toBeTruthy();
  });

  test("merges tiny adjacent blocks into fewer extraction sections", () => {
    const tinyBlockFixture = `
STRICTLY CONFIDENTIAL

Creator Agreement

General Campaign Information

Creator Name:

Jahnesha Standley

Brand:

Lunchables

Campaign Name:

KHC - Lunchables Core CLP 2026

Fee:

USD $5,000.00
`;

    const sections = splitIntoSections(tinyBlockFixture, "contract");

    expect(sections.length).toBeLessThan(6);
    expect(sections.every((section) => section.content.trim().length >= 20)).toBe(true);
  });

  test("extracts core creator terms from fallback parser", () => {
    const result = fallbackAnalyzeContract(fixture);

    expect(result.terms.paymentAmount).toBe(2000);
    expect(result.terms.paymentTerms).toBe("Net 45");
    expect(result.terms.deliverables.length).toBeGreaterThan(0);
    expect(result.riskFlags.some((flag) => flag.category === "usage_rights")).toBe(
      true
    );
  });

  test("tracks conflicts when sections disagree on scalar terms", () => {
    const conflictingFixture = `
Compensation
Brand shall pay Creator $2,000 on Net 30 terms.

Updated Payment Terms
Brand shall pay Creator $3,000 on Net 45 terms.
`;

    const result = fallbackAnalyzeDocument(conflictingFixture, {
      fileName: "conflicting-contract.txt",
      documentKindHint: "contract"
    });

    expect(result.extraction.conflicts).toContain("paymentAmount");
    expect(result.extraction.conflicts).toContain("paymentTerms");
  });

  test("extracts split payment structure and hyphenated net terms", () => {
    const fixture = `
Creator Agreement

Compensation
Brand shall pay Creator $7,200 USD, payable 50% on signature and 50% net-30 after final live links.
`;

    const result = fallbackAnalyzeDocument(fixture, {
      fileName: "split-payment-contract.txt",
      documentKindHint: "contract"
    });

    expect(result.extraction.data.paymentAmount).toBe(7200);
    expect(result.extraction.data.currency).toBe("USD");
    expect(result.extraction.data.netTermsDays).toBe(30);
    expect(result.extraction.data.paymentTerms).toBe("Net 30");
    expect(result.extraction.data.paymentStructure).toBe(
      "50% on signature, 50% on completion"
    );
    expect(result.extraction.data.paymentTrigger).toBe(
      "On signature and after final live links"
    );
  });

  test("mergeTerms preserves earlier extracted usage and exclusivity fields when a later brief omits them", () => {
    const base = {
      brandName: "NimbusPM",
      agencyName: null,
      creatorName: "Jordan Alvarez",
      campaignName: "HB-SAAS-002",
      paymentAmount: 7200,
      currency: "USD",
      paymentTerms: "50% on signature and 50% net-30 after final live links",
      paymentStructure: "50% on signature, 50% on completion",
      netTermsDays: 30,
      paymentTrigger: "On signature and after final live links",
      deliverables: [],
      usageRights: "Organic usage (Perpetual unless revoked for breach), Paid usage (See deal type), Whitelisting (Only if expressly authorized)",
      usageRightsOrganicAllowed: true,
      usageRightsPaidAllowed: true,
      whitelistingAllowed: true,
      usageDuration: "Perpetual unless revoked for breach",
      usageTerritory: "United States",
      usageChannels: ["Organic reposting", "Paid social", "Whitelisting"],
      exclusivity: "Campaign-specific; category-based only",
      exclusivityApplies: true,
      exclusivityCategory: null,
      exclusivityDuration: null,
      exclusivityRestrictions: "Category-based only",
      brandCategory: "other" as const,
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
      governingLaw: "State of Delaware",
      notes: null,
      manuallyEditedFields: [],
      briefData: null,
      pendingExtraction: null
    };

    const laterBriefPatch = {
      brandName: "NimbusPM",
      campaignName: "Brief Campaign objective",
      paymentAmount: null,
      currency: null,
      paymentTerms: null,
      paymentStructure: null,
      netTermsDays: null,
      paymentTrigger: null,
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
      notes:
        "Target audience: Startup operators, PMs, founders, 25-45. Primary CTA: Book a demo through the custom link."
    };

    const merged = mergeTerms(base, laterBriefPatch);

    expect(merged.usageRights).toBe(base.usageRights);
    expect(merged.usageRightsOrganicAllowed).toBe(true);
    expect(merged.usageRightsPaidAllowed).toBe(true);
    expect(merged.whitelistingAllowed).toBe(true);
    expect(merged.usageDuration).toBe(base.usageDuration);
    expect(merged.usageTerritory).toBe(base.usageTerritory);
    expect(merged.exclusivity).toBe(base.exclusivity);
    expect(merged.exclusivityApplies).toBe(true);
    expect(merged.paymentStructure).toBe(base.paymentStructure);
    expect(merged.paymentTrigger).toBe(base.paymentTrigger);
    expect(merged.notes).toBe(laterBriefPatch.notes);
  });

  test("rejects generic brief section headers as campaign names", () => {
    expect(sanitizeCampaignName("Brief Campaign objective")).toBeNull();
    expect(sanitizeCampaignName("Campaign objective")).toBeNull();
  });

  test("creates a usable negotiation email draft", () => {
    const seed = createSeedStore();
    const aggregate = {
      deal: seed.deals[0],
      latestDocument: seed.documents[0],
      documents: seed.documents,
      terms: seed.dealTerms[0],
      conflictResults: [],
      paymentRecord: null,
      riskFlags: seed.riskFlags,
      emailDrafts: seed.emailDrafts,
      jobs: seed.jobs,
      documentSections: seed.documentSections,
      documentRuns: seed.documentRuns,
      documentArtifacts: seed.documentArtifacts,
      documentFieldEvidence: seed.documentFieldEvidence,
      documentReviewItems: seed.documentReviewItems,
      extractionResults: seed.extractionResults,
      extractionEvidence: seed.extractionEvidence,
      summaries: seed.summaries,
      currentSummary: seed.summaries[0],
      intakeSession: null
    };

    const draft = generateEmailDraft(aggregate, "request-faster-payment");
    expect(draft.subject).toContain("Payment");
    expect(draft.body).toContain("Net 45");
  });

  test("extracts category and disclosure intelligence from fallback parser", () => {
    const fixture = `
Brand partnership for Lunchables creator campaign.
The creator may not work with competing snack or food brands for 30 days.
All sponsored posts must include #ad and follow FTC endorsement guidance.
`;

    const result = fallbackAnalyzeDocument(fixture, {
      fileName: "lunchables-email.txt",
      documentKindHint: "email_thread"
    });

    expect(result.extraction.data.brandCategory).toBe("food_beverage");
    expect(result.extraction.data.restrictedCategories).toContain("Food & beverage");
    expect(result.extraction.data.disclosureObligations.length).toBeGreaterThan(0);
  });

  test("builds cross-deal conflict warnings for overlapping categories", () => {
    const seed = createSeedStore();
    const first: DealAggregate = {
      deal: seed.deals[0],
      latestDocument: seed.documents[0],
      documents: seed.documents,
      terms: seed.dealTerms[0],
      conflictResults: [],
      paymentRecord: null,
      riskFlags: seed.riskFlags,
      emailDrafts: seed.emailDrafts,
      jobs: seed.jobs,
      documentSections: seed.documentSections,
      documentRuns: seed.documentRuns,
      documentArtifacts: seed.documentArtifacts,
      documentFieldEvidence: seed.documentFieldEvidence,
      documentReviewItems: seed.documentReviewItems,
      extractionResults: seed.extractionResults,
      extractionEvidence: seed.extractionEvidence,
      summaries: seed.summaries,
      currentSummary: seed.summaries[0],
      intakeSession: null
    };
    const second: DealAggregate = {
      ...first,
      deal: {
        ...first.deal,
        id: "deal-2",
        brandName: "Lunchables",
        campaignName: "Snack Week",
        confirmedAt: new Date().toISOString()
      },
      terms: {
        ...first.terms!,
        id: "terms-2",
        dealId: "deal-2",
        brandName: "Lunchables",
        campaignName: "Snack Week",
        brandCategory: "food_beverage",
        restrictedCategories: ["Food & beverage"],
        competitorCategories: ["Food & beverage"]
      }
    };

    const conflicts = buildConflictResults(second, [first, second]);
    expect(conflicts.some((entry) => entry.type === "schedule_collision")).toBe(true);
  });

  test("keeps unrelated category deals quiet when evidence is weak", () => {
    const seed = createSeedStore();
    const first: DealAggregate = {
      deal: seed.deals[0],
      latestDocument: seed.documents[0],
      documents: seed.documents,
      terms: seed.dealTerms[0],
      conflictResults: [],
      paymentRecord: null,
      riskFlags: seed.riskFlags,
      emailDrafts: seed.emailDrafts,
      jobs: seed.jobs,
      documentSections: seed.documentSections,
      documentRuns: seed.documentRuns,
      documentArtifacts: seed.documentArtifacts,
      documentFieldEvidence: seed.documentFieldEvidence,
      documentReviewItems: seed.documentReviewItems,
      extractionResults: seed.extractionResults,
      extractionEvidence: seed.extractionEvidence,
      summaries: seed.summaries,
      currentSummary: seed.summaries[0],
      intakeSession: null
    };
    const second: DealAggregate = {
      ...first,
      deal: {
        ...first.deal,
        id: "deal-3",
        brandName: "Netflix",
        campaignName: "Show Launch",
        confirmedAt: new Date().toISOString()
      },
      terms: {
        ...first.terms!,
        id: "terms-3",
        dealId: "deal-3",
        brandName: "Netflix",
        campaignName: "Show Launch",
        brandCategory: "entertainment_media",
        restrictedCategories: [],
        competitorCategories: [],
        campaignDateWindow: {
          startDate: "2026-05-10T00:00:00.000Z",
          endDate: "2026-05-12T00:00:00.000Z",
          postingWindow: "2026-05-10 to 2026-05-12"
        }
      }
    };

    const conflicts = buildConflictResults(second, [first, second]);
    expect(conflicts.some((entry) => entry.type === "category_conflict")).toBe(false);
    expect(conflicts.some((entry) => entry.type === "competitor_restriction")).toBe(false);
  });

  test("surfaces whitelisting and termination risk signals", () => {
    const result = fallbackAnalyzeDocument(
      `
Usage Rights
Brand may whitelist creator content for paid social ads for 90 days.

Termination
Brand may terminate immediately without notice.
`,
      {
        fileName: "rights-contract.txt",
        documentKindHint: "contract"
      }
    );

    expect(result.extraction.data.whitelistingAllowed).toBe(true);
    expect(result.extraction.data.usageRightsPaidAllowed).toBe(true);
    expect(result.riskFlags.some((flag) => flag.category === "usage_rights")).toBe(true);
  });

  test("rejects unreadably short extracted text", async () => {
    await expect(
      extractDocumentText(Buffer.from("too short"), "application/pdf", "tiny.pdf")
    ).rejects.toThrow();
  });
});
