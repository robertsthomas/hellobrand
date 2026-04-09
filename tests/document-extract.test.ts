import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, test, vi } from "vitest";

import { extractDocumentText } from "@/lib/documents/extract";

const processDocumentWithDocumentAiMock = vi.fn();
const hasDocumentAiProcessorMock = vi.fn();

vi.mock("@/lib/document-ai", () => ({
  hasDocumentAiProcessor: hasDocumentAiProcessorMock,
  processDocumentWithDocumentAi: processDocumentWithDocumentAiMock
}));

afterEach(() => {
  processDocumentWithDocumentAiMock.mockReset();
  hasDocumentAiProcessorMock.mockReset();
  delete process.env.DOCUMENT_PIPELINE_V2_FORCE_LEGACY;
});

describe("extractDocumentText", () => {
  test("uses the direct pdfjs extractor for PDFs", async () => {
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

  test("prefers Document AI when requested and configured", async () => {
    hasDocumentAiProcessorMock.mockImplementation((kind: string) => kind === "layout");
    processDocumentWithDocumentAiMock.mockResolvedValue({
      fullText:
        "Northstar Skin agreement\nPayment terms Net 30\nUsage rights limited paid media for 30 days.\n".repeat(
          4
        )
    });

    const result = await extractDocumentText(
      Buffer.from("fake-pdf"),
      "application/pdf",
      "northstar-skin-spring-glow-campaign-contract.pdf",
      { preferDocumentAi: true }
    );

    expect(processDocumentWithDocumentAiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        processor: "layout",
        mimeType: "application/pdf",
        imagelessMode: true
      })
    );
    expect(result._debug?.parser).toBe("document-ai:layout");
    expect(result.normalizedText).toContain("Northstar Skin agreement");
  });

  test("skips Document AI parsing when rollout is forced to legacy", async () => {
    process.env.DOCUMENT_PIPELINE_V2_FORCE_LEGACY = "1";
    hasDocumentAiProcessorMock.mockImplementation((kind: string) => kind === "layout");

    const buffer = await readFile(
      "/Users/thomasroberts/Desktop/projects/hellobrand/public/sample-documents/northstar-skin-spring-glow-campaign-contract.pdf"
    );

    const result = await extractDocumentText(
      buffer,
      "application/pdf",
      "northstar-skin-spring-glow-campaign-contract.pdf",
      { preferDocumentAi: true }
    );

    expect(processDocumentWithDocumentAiMock).not.toHaveBeenCalled();
    expect(result._debug?.parser).toBe("pdfjs-dist");
  });
});
