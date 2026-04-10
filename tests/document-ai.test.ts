import { afterEach, describe, expect, it, vi } from "vitest";

const processDocumentMock = vi.fn();
const documentProcessorServiceClientMock = vi.fn().mockImplementation((options?: unknown) => ({
  options,
  processDocument: processDocumentMock
}));

vi.mock("@google-cloud/documentai", () => ({
  v1: {
    DocumentProcessorServiceClient: documentProcessorServiceClientMock
  }
}));

vi.mock("server-only", () => ({}));

const originalEnv = {
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
  GOOGLE_CLOUD_PROJECT_NUMBER: process.env.GOOGLE_CLOUD_PROJECT_NUMBER,
  GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON,
  DOCUMENT_AI_LOCATION: process.env.DOCUMENT_AI_LOCATION,
  DOCUMENT_AI_CONTRACT_PROCESSOR_ID: process.env.DOCUMENT_AI_CONTRACT_PROCESSOR_ID,
  DOCUMENT_AI_BRIEF_PROCESSOR_ID: process.env.DOCUMENT_AI_BRIEF_PROCESSOR_ID,
  DOCUMENT_AI_INVOICE_PROCESSOR_ID: process.env.DOCUMENT_AI_INVOICE_PROCESSOR_ID,
  DOCUMENT_AI_LAYOUT_PROCESSOR_ID: process.env.DOCUMENT_AI_LAYOUT_PROCESSOR_ID,
  DOCUMENT_AI_OCR_PROCESSOR_ID: process.env.DOCUMENT_AI_OCR_PROCESSOR_ID,
  DOCUMENT_AI_CONTRACT_PROCESSOR_VERSION_ID:
    process.env.DOCUMENT_AI_CONTRACT_PROCESSOR_VERSION_ID,
  DOCUMENT_AI_BRIEF_PROCESSOR_VERSION_ID: process.env.DOCUMENT_AI_BRIEF_PROCESSOR_VERSION_ID,
  DOCUMENT_AI_INVOICE_PROCESSOR_VERSION_ID:
    process.env.DOCUMENT_AI_INVOICE_PROCESSOR_VERSION_ID,
  DOCUMENT_AI_LAYOUT_PROCESSOR_VERSION_ID:
    process.env.DOCUMENT_AI_LAYOUT_PROCESSOR_VERSION_ID,
  DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID: process.env.DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID
};

async function loadDocumentAiModule() {
  vi.resetModules();
  return import("@/lib/document-ai");
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (typeof value === "undefined") {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv();
  processDocumentMock.mockReset();
  documentProcessorServiceClientMock.mockClear();
});

describe("document ai foundation", () => {
  it("builds processor names from env and prefers project number", async () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = "hellobrand-490702";
    process.env.GOOGLE_CLOUD_PROJECT_NUMBER = "966263516070";
    process.env.DOCUMENT_AI_LOCATION = "us";
    process.env.DOCUMENT_AI_CONTRACT_PROCESSOR_ID = "contract-processor";

    const { getDocumentAiProcessorName } = await loadDocumentAiModule();

    expect(getDocumentAiProcessorName("contract")).toBe(
      "projects/966263516070/locations/us/processors/contract-processor"
    );
  });

  it("uses a pinned processor version when configured", async () => {
    process.env.GOOGLE_CLOUD_PROJECT_NUMBER = "966263516070";
    process.env.DOCUMENT_AI_LOCATION = "us";
    process.env.DOCUMENT_AI_CONTRACT_PROCESSOR_ID = "contract-processor";
    process.env.DOCUMENT_AI_CONTRACT_PROCESSOR_VERSION_ID = "contract-version";

    const { getDocumentAiProcessorName } = await loadDocumentAiModule();

    expect(getDocumentAiProcessorName("contract")).toBe(
      "projects/966263516070/locations/us/processors/contract-processor/processorVersions/contract-version"
    );
  });

  it("creates a client with service account json credentials when configured", async () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = "hellobrand-490702";
    process.env.DOCUMENT_AI_LOCATION = "us";
    process.env.DOCUMENT_AI_CONTRACT_PROCESSOR_ID = "contract-processor";
    process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "document-ai@hellobrand-490702.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n",
      project_id: "hellobrand-490702"
    });

    processDocumentMock.mockResolvedValue([
      {
        document: {
          text: "HelloBrand contract",
          pages: [{ pageNumber: 1 }],
          entities: [{ type: "brand_name" }]
        }
      },
      undefined,
      undefined
    ]);

    const { getDocumentAiCredentialSource, processDocumentWithDocumentAi } =
      await loadDocumentAiModule();

    const result = await processDocumentWithDocumentAi({
      processor: "contract",
      bytes: Buffer.from("test-pdf"),
      mimeType: "application/pdf",
      fieldMaskPaths: ["text", "entities"]
    });

    expect(getDocumentAiCredentialSource()).toBe("service_account_json");
    expect(documentProcessorServiceClientMock).toHaveBeenCalledWith({
      apiEndpoint: "us-documentai.googleapis.com",
      projectId: "hellobrand-490702",
      credentials: {
        client_email: "document-ai@hellobrand-490702.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n"
      }
    });
    expect(processDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "projects/hellobrand-490702/locations/us/processors/contract-processor",
        skipHumanReview: true,
        fieldMask: { paths: ["text", "entities"] },
        rawDocument: expect.objectContaining({
          mimeType: "application/pdf",
          content: expect.any(Buffer)
        })
      })
    );
    expect(result.fullText).toBe("HelloBrand contract");
    expect(result.rawResponse).toMatchObject({
      document: {
        text: "HelloBrand contract"
      }
    });
  });

  it("falls back to application default credentials when no service account json is present", async () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = "hellobrand-490702";
    process.env.DOCUMENT_AI_LOCATION = "us";
    process.env.DOCUMENT_AI_OCR_PROCESSOR_ID = "ocr-processor";

    const { getDocumentAiCredentialSource, processDocumentWithDocumentAi } =
      await loadDocumentAiModule();

    processDocumentMock.mockResolvedValue([{ document: { text: "" } }, undefined, undefined]);

    await processDocumentWithDocumentAi({
      processor: "ocr",
      bytes: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(getDocumentAiCredentialSource()).toBe("application_default_credentials");
    expect(documentProcessorServiceClientMock).toHaveBeenCalledWith({
      apiEndpoint: "us-documentai.googleapis.com",
      projectId: "hellobrand-490702"
    });
  });

  it("extracts text from text anchors", async () => {
    const { extractDocumentAiTextAnchor } = await loadDocumentAiModule();

    expect(
      extractDocumentAiTextAnchor(
        {
          text: "Hello Brand Terms"
        },
        {
          textSegments: [{ startIndex: 6, endIndex: 11 }]
        }
      )
    ).toBe("Brand");
  });
});
