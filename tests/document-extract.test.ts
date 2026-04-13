import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, test, vi } from "vitest";

import { extractDocumentText } from "@/lib/documents/extract";

const analyzeDocumentWithAzureDocumentIntelligenceMock = vi.fn();
const hasAzureDocumentIntelligenceMock = vi.fn();

vi.mock("@/lib/azure-document-intelligence", () => ({
  analyzeDocumentWithAzureDocumentIntelligence: analyzeDocumentWithAzureDocumentIntelligenceMock,
  hasAzureDocumentIntelligence: hasAzureDocumentIntelligenceMock,
}));

afterEach(() => {
  analyzeDocumentWithAzureDocumentIntelligenceMock.mockReset();
  hasAzureDocumentIntelligenceMock.mockReset();
});

describe("extractDocumentText", () => {
  test("uses Azure Document Intelligence for PDFs when configured", async () => {
    hasAzureDocumentIntelligenceMock.mockReturnValue(true);
    analyzeDocumentWithAzureDocumentIntelligenceMock.mockResolvedValue({
      fullText: "Northstar Skin agreement\nPayment terms Net 30\nUsage rights limited.\n".repeat(4),
      pageCount: 3,
      rawResponse: { status: "succeeded" },
      contentFormat: "markdown",
      modelId: "prebuilt-layout",
    });

    const result = await extractDocumentText(
      Buffer.from("fake-pdf"),
      "application/pdf",
      "northstar-skin-spring-glow-campaign-contract.pdf"
    );

    expect(analyzeDocumentWithAzureDocumentIntelligenceMock).toHaveBeenCalledWith({
      bytes: Buffer.from("fake-pdf"),
      mimeType: "application/pdf",
    });
    expect(result._debug?.parser).toBe("azure-document-intelligence:prebuilt-layout");
    expect(result.normalizedText).toContain("Northstar Skin agreement");
  });

  test("uses the direct pdfjs extractor for PDFs", async () => {
    hasAzureDocumentIntelligenceMock.mockReturnValue(false);

    const buffer = await readFile(
      "/Users/thomasroberts/Desktop/projects/hellobrand/public/sample-documents/northstar-skin-spring-glow-campaign-contract.pdf"
    );

    const result = await extractDocumentText(
      buffer,
      "application/pdf",
      "northstar-skin-spring-glow-campaign-contract.pdf"
    );

    expect(result._debug?.parser).toBe("pdfjs-dist");
    expect(result.normalizedText).toContain("Northstar");
    expect(result.normalizedText.length).toBeGreaterThan(120);
  });

  test("extracts plain text without vendor-specific routing", async () => {
    hasAzureDocumentIntelligenceMock.mockReturnValue(false);

    const result = await extractDocumentText(
      Buffer.from("Northstar agreement\nPayment terms Net 30\nUsage rights limited.\n".repeat(4)),
      "text/plain",
      "northstar-agreement.txt"
    );

    expect(result._debug?.parser).toBe("plaintext");
    expect(result.normalizedText).toContain("Payment terms Net 30");
  });
});
