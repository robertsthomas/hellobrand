import { afterEach, describe, expect, it, vi } from "vitest";

const hasDocumentAiProcessorMock = vi.fn();

vi.mock("@/lib/document-ai", () => ({
  hasDocumentAiProcessor: hasDocumentAiProcessorMock
}));

afterEach(() => {
  hasDocumentAiProcessorMock.mockReset();
});

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
        `
      })
    ).toEqual({
      documentKind: "invoice",
      confidence: 0.96
    });
  });

  it("routes file-based invoices to the Document AI invoice processor when configured", async () => {
    hasDocumentAiProcessorMock.mockImplementation((kind: string) => kind === "invoice");
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        documentKind: "invoice",
        classificationConfidence: 0.92,
        fileName: "invoice.pdf",
        normalizedText: "Invoice Number INV-001",
        sourceType: "file"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "document_ai_invoice",
      processor: "invoice",
      fallbackRoute: "legacy"
    });
  });

  it("routes file-based contracts to the Document AI contract processor when configured", async () => {
    hasDocumentAiProcessorMock.mockImplementation((kind: string) => kind === "contract");
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        documentKind: "contract",
        classificationConfidence: 0.91,
        fileName: "agreement.pdf",
        normalizedText: "Creator agreement",
        sourceType: "file"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "document_ai_contract",
      processor: "contract",
      fallbackRoute: "legacy"
    });
  });

  it("routes file-based briefs to the Document AI brief processor when configured", async () => {
    hasDocumentAiProcessorMock.mockImplementation((kind: string) => kind === "brief");
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        documentKind: "campaign_brief",
        classificationConfidence: 0.89,
        fileName: "brief.pdf",
        normalizedText: "Campaign overview and messaging points",
        sourceType: "file"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "document_ai_brief",
      processor: "brief",
      fallbackRoute: "legacy"
    });
  });

  it("keeps pasted-text invoices on the legacy path", async () => {
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        documentKind: "invoice",
        classificationConfidence: 0.92,
        fileName: "pasted-invoice.txt",
        normalizedText: "Invoice Number INV-001",
        sourceType: "pasted_text"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "legacy",
      processor: null,
      fallbackRoute: null
    });
    expect(decision.reasons).toContain("invoice_processor_requires_file");
  });

  it("keeps pasted-text contracts on the legacy path", async () => {
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        documentKind: "contract",
        classificationConfidence: 0.92,
        fileName: "pasted-agreement.txt",
        normalizedText: "Creator agreement terms",
        sourceType: "pasted_text"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "legacy",
      processor: null,
      fallbackRoute: null
    });
    expect(decision.reasons).toContain("contract_processor_requires_file");
  });

  it("keeps pasted-text briefs on the legacy path", async () => {
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        documentKind: "campaign_brief",
        classificationConfidence: 0.9,
        fileName: "pasted-brief.txt",
        normalizedText: "Campaign overview",
        sourceType: "pasted_text"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "legacy",
      processor: null,
      fallbackRoute: null
    });
    expect(decision.reasons).toContain("brief_processor_requires_file");
  });
});
