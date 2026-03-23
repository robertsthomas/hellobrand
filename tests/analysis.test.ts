import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  classifyDocumentHeuristically,
  fallbackAnalyzeDocument,
  fallbackAnalyzeContract,
  splitIntoSections
} from "@/lib/analysis/fallback";
import { buildConflictResults } from "@/lib/conflict-intelligence";
import { generateEmailDraft } from "@/lib/email/generate";
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
