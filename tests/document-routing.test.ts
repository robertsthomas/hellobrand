import { afterEach, describe, expect, it, vi } from "vitest";

const hasDocumentAiProcessorMock = vi.fn();

vi.mock("@/lib/document-ai", () => ({
  hasDocumentAiProcessor: hasDocumentAiProcessorMock
}));

afterEach(() => {
  hasDocumentAiProcessorMock.mockReset();
  delete process.env.DOCUMENT_PIPELINE_V2_FORCE_LEGACY;
  delete process.env.DOCUMENT_PIPELINE_V2_ALLOWED_KINDS;
  delete process.env.DOCUMENT_PIPELINE_V2_COHORT_PERCENT;
  delete process.env.DOCUMENT_PIPELINE_V2_ALLOWED_USER_IDS;
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
        id: "doc-1",
        dealId: "deal-1",
        userId: "user-1",
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
      rolloutEnabled: true
    });
  });

  it("routes file-based contracts to the Document AI contract processor when configured", async () => {
    hasDocumentAiProcessorMock.mockImplementation((kind: string) => kind === "contract");
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-2",
        dealId: "deal-2",
        userId: "user-2",
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
      rolloutEnabled: true
    });
  });

  it("routes file-based briefs to the Document AI brief processor when configured", async () => {
    hasDocumentAiProcessorMock.mockImplementation((kind: string) => kind === "brief");
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-3",
        dealId: "deal-3",
        userId: "user-3",
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
      rolloutEnabled: true
    });
  });

  it("marks pasted-text invoices as unsupported for Document AI extraction", async () => {
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-4",
        dealId: "deal-4",
        userId: "user-4",
        documentKind: "invoice",
        classificationConfidence: 0.92,
        fileName: "pasted-invoice.txt",
        normalizedText: "Invoice Number INV-001",
        sourceType: "pasted_text"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "unsupported",
      processor: null
    });
    expect(decision.reasons).toContain("invoice_processor_requires_file");
  });

  it("marks pasted-text contracts as unsupported for Document AI extraction", async () => {
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-5",
        dealId: "deal-5",
        userId: "user-5",
        documentKind: "contract",
        classificationConfidence: 0.92,
        fileName: "pasted-agreement.txt",
        normalizedText: "Creator agreement terms",
        sourceType: "pasted_text"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "unsupported",
      processor: null
    });
    expect(decision.reasons).toContain("contract_processor_requires_file");
  });

  it("marks pasted-text briefs as unsupported for Document AI extraction", async () => {
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-6",
        dealId: "deal-6",
        userId: "user-6",
        documentKind: "campaign_brief",
        classificationConfidence: 0.9,
        fileName: "pasted-brief.txt",
        normalizedText: "Campaign overview",
        sourceType: "pasted_text"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "unsupported",
      processor: null
    });
    expect(decision.reasons).toContain("brief_processor_requires_file");
  });

  it("disables Document AI routing when the rollout is forced to legacy", async () => {
    process.env.DOCUMENT_PIPELINE_V2_FORCE_LEGACY = "1";
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-7",
        dealId: "deal-7",
        userId: "user-7",
        documentKind: "invoice",
        classificationConfidence: 0.95,
        fileName: "invoice.pdf",
        normalizedText: "Invoice Number INV-001",
        sourceType: "file"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "unsupported",
      processor: null,
      rolloutEnabled: false
    });
    expect(decision.reasons).toContain("rollout:force_legacy");
  });

  it("disables Document AI routing when the document kind is not enabled for rollout", async () => {
    process.env.DOCUMENT_PIPELINE_V2_ALLOWED_KINDS = "invoice";
    hasDocumentAiProcessorMock.mockReturnValue(true);
    const { resolveDocumentRoutingDecision } = await import("@/lib/document-routing");

    const decision = resolveDocumentRoutingDecision({
      document: {
        id: "doc-8",
        dealId: "deal-8",
        userId: "user-8",
        documentKind: "contract",
        classificationConfidence: 0.9,
        fileName: "agreement.pdf",
        normalizedText: "Creator agreement",
        sourceType: "file"
      }
    });

    expect(decision).toMatchObject({
      extractionRoute: "unsupported",
      processor: null,
      rolloutEnabled: false
    });
    expect(decision.reasons).toContain("rollout:document_kind_not_enabled");
  });
});
