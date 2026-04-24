import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import { extractDocumentText } from "@/lib/documents/extract";

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

  test("extracts plain text without vendor-specific routing", async () => {
    const result = await extractDocumentText(
      Buffer.from("Northstar agreement\nPayment terms Net 30\nUsage rights limited.\n".repeat(4)),
      "text/plain",
      "northstar-agreement.txt"
    );

    expect(result._debug?.parser).toBe("plaintext");
    expect(result.normalizedText).toContain("Payment terms Net 30");
  });
});
