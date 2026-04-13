import { describe, expect, it } from "vitest";

describe("document routing", () => {
  it("classifies strong invoice text as an invoice before contract heuristics", async () => {
    const { classifyDocumentForRouting } = await import("@/lib/document-routing");

    expect(
      classifyDocumentForRouting({
        fileName: "agreement.pdf",
        text: `
          Invoice Number: INV-001
          Bill To: Lunchables
          Amount Due: $5,000
          This agreement references standard payment terms.
        `,
      })
    ).toEqual({
      documentKind: "invoice",
      confidence: 0.96,
    });
  });

  it("uses the fallback extractor route for classified documents", async () => {
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-1",
        dealId: "deal-1",
        userId: "user-1",
        documentKind: "contract",
        classificationConfidence: 0.91,
        fileName: "agreement.pdf",
        mimeType: "application/pdf",
        normalizedText: "Creator agreement",
        sourceType: "file",
      },
    });

    expect(decision).toMatchObject({
      extractionRoute: "fallback",
      processor: null,
      rolloutEnabled: true,
      cohortBucket: 0,
    });
    expect(decision.reasons).toEqual(["classified:contract", "extractor:fallback"]);
  });
});
