import DocumentIntelligence, {
  getLongRunningPoller,
  isUnexpected,
} from "@azure-rest/ai-document-intelligence";

const DEFAULT_API_VERSION = "2024-11-30";
const DEFAULT_MODEL_ID = "prebuilt-layout";
const DEFAULT_LOCALE = "en-US";

type AzureAnalyzeResult = {
  apiVersion?: string;
  modelId?: string;
  contentFormat?: string;
  content?: string;
  pages?: Array<unknown>;
};

function normalizeEnv(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getAzureDocumentIntelligenceEndpoint() {
  return normalizeEnv(process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT);
}

function getAzureDocumentIntelligenceApiKey() {
  return normalizeEnv(process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY);
}

function getAzureDocumentIntelligenceModelId() {
  return normalizeEnv(process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID) ?? DEFAULT_MODEL_ID;
}

function getAzureDocumentIntelligenceApiVersion() {
  return normalizeEnv(process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION) ?? DEFAULT_API_VERSION;
}

export function hasAzureDocumentIntelligence() {
  return Boolean(getAzureDocumentIntelligenceEndpoint() && getAzureDocumentIntelligenceApiKey());
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, "");
}

function shouldRequestMarkdown(modelId: string) {
  return modelId === "prebuilt-layout";
}

// fallow-ignore-next-line complexity
export async function analyzeDocumentWithAzureDocumentIntelligence(input: {
  bytes: Buffer;
  mimeType: string;
}) {
  const endpoint = getAzureDocumentIntelligenceEndpoint();
  const apiKey = getAzureDocumentIntelligenceApiKey();
  const modelId = getAzureDocumentIntelligenceModelId();
  const apiVersion = getAzureDocumentIntelligenceApiVersion();

  if (!endpoint || !apiKey) {
    throw new Error(
      "Azure Document Intelligence is not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_API_KEY."
    );
  }

  const client = DocumentIntelligence(normalizeEndpoint(endpoint), { key: apiKey }, { apiVersion });

  const initialResponse = await client.path("/documentModels/{modelId}:analyze", modelId).post({
    contentType: "application/json",
    body: {
      base64Source: input.bytes.toString("base64"),
    },
    queryParameters: {
      locale: DEFAULT_LOCALE,
      ...(shouldRequestMarkdown(modelId) ? { outputContentFormat: "markdown" as const } : {}),
    },
  });

  if (isUnexpected(initialResponse)) {
    const error = initialResponse.body.error;
    throw new Error(
      error?.code && error?.message
        ? `Azure Document Intelligence error (${error.code}): ${error.message}`
        : (error?.message ?? "Azure Document Intelligence request failed.")
    );
  }

  const poller = getLongRunningPoller(client, initialResponse);
  const result = (await poller.pollUntilDone()) as {
    body?: {
      analyzeResult?: AzureAnalyzeResult;
      error?: {
        code?: string;
        message?: string;
      };
    };
  };

  const analyzeResult = result.body?.analyzeResult;
  const content = analyzeResult?.content?.trim();

  if (!content) {
    const errorMessage =
      result.body?.error?.message ?? "Azure Document Intelligence returned no extracted content.";
    throw new Error(errorMessage);
  }

  return {
    fullText: content,
    pageCount: Array.isArray(analyzeResult?.pages) ? analyzeResult.pages.length : null,
    rawResponse: (result.body ?? {}) as Record<string, unknown>,
    contentFormat: analyzeResult?.contentFormat ?? null,
    modelId: analyzeResult?.modelId ?? modelId,
  };
}
