import { afterEach, describe, expect, test, vi } from "vitest";

const {
  postMock,
  pathMock,
  clientFactoryMock,
  pollUntilDoneMock,
  getLongRunningPollerMock,
  isUnexpectedMock,
} = vi.hoisted(() => {
  const postMock = vi.fn();
  const pathMock = vi.fn(() => ({ post: postMock }));
  const clientFactoryMock = vi.fn(() => ({ path: pathMock }));
  const pollUntilDoneMock = vi.fn();
  const getLongRunningPollerMock = vi.fn(() => ({ pollUntilDone: pollUntilDoneMock }));
  const isUnexpectedMock = vi.fn(() => false);

  return {
    postMock,
    pathMock,
    clientFactoryMock,
    pollUntilDoneMock,
    getLongRunningPollerMock,
    isUnexpectedMock,
  };
});

vi.mock("@azure-rest/ai-document-intelligence", () => ({
  default: clientFactoryMock,
  getLongRunningPoller: getLongRunningPollerMock,
  isUnexpected: isUnexpectedMock,
}));

import {
  analyzeDocumentWithAzureDocumentIntelligence,
  hasAzureDocumentIntelligence,
} from "@/lib/azure-document-intelligence";

afterEach(() => {
  postMock.mockReset();
  pathMock.mockClear();
  clientFactoryMock.mockClear();
  pollUntilDoneMock.mockReset();
  getLongRunningPollerMock.mockClear();
  isUnexpectedMock.mockReset();
  isUnexpectedMock.mockReturnValue(false);
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION;
});

describe("azure document intelligence", () => {
  test("detects configuration from env", () => {
    expect(hasAzureDocumentIntelligence()).toBe(false);

    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT =
      "https://hellobrand.cognitiveservices.azure.com/";
    process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY = "test-key";

    expect(hasAzureDocumentIntelligence()).toBe(true);
  });

  test("analyzes a document and polls for the result", async () => {
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT =
      "https://hellobrand.cognitiveservices.azure.com/";
    process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY = "test-key";

    const initialResponse = { status: "202" };
    postMock.mockResolvedValue(initialResponse);
    pollUntilDoneMock.mockResolvedValue({
      body: {
        analyzeResult: {
          modelId: "prebuilt-layout",
          contentFormat: "markdown",
          content: "# Contract\n\nPayment terms Net 30",
          pages: [{ pageNumber: 1 }, { pageNumber: 2 }],
        },
      },
    });

    const result = await analyzeDocumentWithAzureDocumentIntelligence({
      bytes: Buffer.from("hello"),
      mimeType: "application/pdf",
    });

    expect(clientFactoryMock).toHaveBeenCalledWith(
      "https://hellobrand.cognitiveservices.azure.com",
      { key: "test-key" },
      { apiVersion: "2024-11-30" }
    );
    expect(pathMock).toHaveBeenCalledWith("/documentModels/{modelId}:analyze", "prebuilt-layout");
    expect(postMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/json",
        body: { base64Source: Buffer.from("hello").toString("base64") },
      })
    );
    expect(getLongRunningPollerMock).toHaveBeenCalledWith({ path: pathMock }, initialResponse);
    expect(result.fullText).toContain("Payment terms Net 30");
    expect(result.pageCount).toBe(2);
    expect(result.modelId).toBe("prebuilt-layout");
  });
});
