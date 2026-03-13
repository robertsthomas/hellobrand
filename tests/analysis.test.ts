import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  classifyDocumentHeuristically,
  fallbackAnalyzeDocument,
  fallbackAnalyzeContract,
  splitIntoSections
} from "@/lib/analysis/fallback";
import { generateEmailDraft } from "@/lib/email/generate";
import { createSeedStore } from "@/lib/repository/seed";
import { extractDocumentText } from "@/lib/documents/extract";

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
      paymentRecord: null,
      riskFlags: seed.riskFlags,
      emailDrafts: seed.emailDrafts,
      jobs: seed.jobs,
      documentSections: seed.documentSections,
      extractionResults: seed.extractionResults,
      extractionEvidence: seed.extractionEvidence,
      summaries: seed.summaries,
      currentSummary: seed.summaries[0]
    };

    const draft = generateEmailDraft(aggregate, "request-faster-payment");
    expect(draft.subject).toContain("Payment");
    expect(draft.body).toContain("Net 45");
  });

  test("rejects unreadably short extracted text", async () => {
    await expect(
      extractDocumentText(Buffer.from("too short"), "application/pdf", "tiny.pdf")
    ).rejects.toThrow();
  });
});
