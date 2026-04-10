import "server-only";

import { v1 as documentAiV1 } from "@google-cloud/documentai";
import type { protos } from "@google-cloud/documentai";

import { startServerDebug } from "@/lib/server-debug";

export type DocumentAiProcessorKind = "brief" | "contract" | "invoice" | "layout" | "ocr";

type DocumentAiClient = InstanceType<typeof documentAiV1.DocumentProcessorServiceClient>;
type DocumentAiClientOptions = ConstructorParameters<
  typeof documentAiV1.DocumentProcessorServiceClient
>[0];
type DocumentAiDocument = protos.google.cloud.documentai.v1.IDocument;
type DocumentAiProcessResponse = protos.google.cloud.documentai.v1.IProcessResponse;
type DocumentAiProcessOptions = protos.google.cloud.documentai.v1.IProcessOptions;
type DocumentAiTextAnchor = protos.google.cloud.documentai.v1.Document.ITextAnchor;

type DocumentAiServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

const DOCUMENT_AI_PROCESSOR_ENV_KEYS: Record<DocumentAiProcessorKind, string> = {
  brief: "DOCUMENT_AI_BRIEF_PROCESSOR_ID",
  contract: "DOCUMENT_AI_CONTRACT_PROCESSOR_ID",
  invoice: "DOCUMENT_AI_INVOICE_PROCESSOR_ID",
  layout: "DOCUMENT_AI_LAYOUT_PROCESSOR_ID",
  ocr: "DOCUMENT_AI_OCR_PROCESSOR_ID"
};

const DOCUMENT_AI_PROCESSOR_VERSION_ENV_KEYS: Record<DocumentAiProcessorKind, string> = {
  brief: "DOCUMENT_AI_BRIEF_PROCESSOR_VERSION_ID",
  contract: "DOCUMENT_AI_CONTRACT_PROCESSOR_VERSION_ID",
  invoice: "DOCUMENT_AI_INVOICE_PROCESSOR_VERSION_ID",
  layout: "DOCUMENT_AI_LAYOUT_PROCESSOR_VERSION_ID",
  ocr: "DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID"
};

let documentAiClientCache:
  | {
      cacheKey: string;
      client: DocumentAiClient;
    }
  | null = null;

function normalizeEnv(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getDocumentAiProjectId() {
  return normalizeEnv(process.env.GOOGLE_CLOUD_PROJECT_ID);
}

function getDocumentAiProjectNumber() {
  return normalizeEnv(process.env.GOOGLE_CLOUD_PROJECT_NUMBER);
}

export function getDocumentAiLocation() {
  return normalizeEnv(process.env.DOCUMENT_AI_LOCATION) ?? "us";
}

function getDocumentAiProjectToken() {
  return getDocumentAiProjectNumber() ?? getDocumentAiProjectId();
}

function getDocumentAiServiceAccountJson() {
  return normalizeEnv(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON);
}

function getDocumentAiServiceAccount(): DocumentAiServiceAccount | null {
  const value = getDocumentAiServiceAccountJson();
  if (!value) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(
      `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON must be valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON must decode to an object.");
  }

  const credentials = parsed as Partial<DocumentAiServiceAccount>;
  const clientEmail = normalizeEnv(credentials.client_email ?? null);
  const privateKey = normalizeEnv(credentials.private_key ?? null)?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON must include client_email and private_key."
    );
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: normalizeEnv(credentials.project_id ?? null) ?? undefined
  };
}

export function getDocumentAiCredentialSource() {
  return getDocumentAiServiceAccountJson()
    ? "service_account_json"
    : "application_default_credentials";
}

export function getDocumentAiProcessorId(kind: DocumentAiProcessorKind) {
  return normalizeEnv(process.env[DOCUMENT_AI_PROCESSOR_ENV_KEYS[kind]]);
}

export function getDocumentAiProcessorVersionId(kind: DocumentAiProcessorKind) {
  return normalizeEnv(process.env[DOCUMENT_AI_PROCESSOR_VERSION_ENV_KEYS[kind]]);
}

export function hasDocumentAiProcessor(kind: DocumentAiProcessorKind) {
  return Boolean(getDocumentAiProjectToken() && getDocumentAiProcessorId(kind));
}

export function hasDocumentAi() {
  return Boolean(getDocumentAiProjectToken());
}

export function getDocumentAiProcessorName(kind: DocumentAiProcessorKind) {
  const projectToken = getDocumentAiProjectToken();
  if (!projectToken) {
    throw new Error(
      "Document AI is not configured. Set GOOGLE_CLOUD_PROJECT_ID or GOOGLE_CLOUD_PROJECT_NUMBER."
    );
  }

  const processorId = getDocumentAiProcessorId(kind);
  if (!processorId) {
    throw new Error(
      `Document AI processor is not configured for ${kind}. Set ${DOCUMENT_AI_PROCESSOR_ENV_KEYS[kind]}.`
    );
  }

  const processorName = `projects/${projectToken}/locations/${getDocumentAiLocation()}/processors/${processorId}`;
  const processorVersionId = getDocumentAiProcessorVersionId(kind);

  return processorVersionId
    ? `${processorName}/processorVersions/${processorVersionId}`
    : processorName;
}

export function getDocumentAiConfigSummary() {
  return {
    projectId: getDocumentAiProjectId(),
    projectNumber: getDocumentAiProjectNumber(),
    location: getDocumentAiLocation(),
    credentialSource: getDocumentAiCredentialSource(),
    processors: {
      brief: getDocumentAiProcessorId("brief"),
      contract: getDocumentAiProcessorId("contract"),
      invoice: getDocumentAiProcessorId("invoice"),
      layout: getDocumentAiProcessorId("layout"),
      ocr: getDocumentAiProcessorId("ocr")
    },
    processorVersions: {
      brief: getDocumentAiProcessorVersionId("brief"),
      contract: getDocumentAiProcessorVersionId("contract"),
      invoice: getDocumentAiProcessorVersionId("invoice"),
      layout: getDocumentAiProcessorVersionId("layout"),
      ocr: getDocumentAiProcessorVersionId("ocr")
    }
  };
}

function getDocumentAiClientOptions(): DocumentAiClientOptions {
  const credentials = getDocumentAiServiceAccount();
  const options: DocumentAiClientOptions = {
    apiEndpoint: `${getDocumentAiLocation()}-documentai.googleapis.com`
  };

  const projectId = getDocumentAiProjectId() ?? credentials?.project_id ?? undefined;
  if (projectId) {
    options.projectId = projectId;
  }

  if (credentials) {
    options.credentials = {
      client_email: credentials.client_email,
      private_key: credentials.private_key
    };
  }

  return options;
}

function getDocumentAiClient() {
  const cacheKey = JSON.stringify({
    location: getDocumentAiLocation(),
    projectId: getDocumentAiProjectId(),
    projectNumber: getDocumentAiProjectNumber(),
    credentialSource: getDocumentAiCredentialSource(),
    serviceAccountLength: getDocumentAiServiceAccountJson()?.length ?? 0
  });

  if (documentAiClientCache?.cacheKey === cacheKey) {
    return documentAiClientCache.client;
  }

  const client = new documentAiV1.DocumentProcessorServiceClient(getDocumentAiClientOptions());
  documentAiClientCache = {
    cacheKey,
    client
  };
  return client;
}

function toInteger(
  value:
    | number
    | string
    | {
        toString(): string;
      }
    | null
    | undefined
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (value && typeof value === "object" && typeof value.toString === "function") {
    const parsed = Number.parseInt(value.toString(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function extractDocumentAiTextAnchor(
  document: DocumentAiDocument | null | undefined,
  textAnchor: DocumentAiTextAnchor | null | undefined
) {
  const fullText = document?.text ?? "";
  const segments = textAnchor?.textSegments ?? [];

  if (!fullText || segments.length === 0) {
    return "";
  }

  return segments
    .map((segment) => {
      const startIndex = toInteger(segment.startIndex);
      const endIndex = toInteger(segment.endIndex);
      return fullText.slice(startIndex, endIndex || undefined);
    })
    .join("");
}

export function getDocumentAiFullText(document: DocumentAiDocument | null | undefined) {
  return document?.text ?? "";
}

export function toSerializableDocumentAiResponse(response: DocumentAiProcessResponse) {
  return JSON.parse(JSON.stringify(response)) as Record<string, unknown>;
}

function shouldLogDocumentAiResponse() {
  return (
    process.env.DEBUG_DOCUMENT_AI_RESPONSE === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

function shouldLogRawDocumentAiResponse() {
  return (
    process.env.DEBUG_DOCUMENT_AI_RAW_RESPONSE === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

function summarizeDocumentAiEntity(
  document: DocumentAiDocument,
  entity: protos.google.cloud.documentai.v1.Document.IEntity
) {
  return {
    type: entity.type ?? null,
    mentionText: entityTextPreview(documentAiEntityText(document, entity), 500),
    normalizedText: entityTextPreview(entity.normalizedValue?.text ?? null, 500),
    confidence: typeof entity.confidence === "number" ? entity.confidence : null,
    pageRefs:
      entity.pageAnchor?.pageRefs?.map((pageRef) => ({
        page: pageRef.page ?? null
      })) ?? []
  };
}

function documentAiEntityText(
  document: DocumentAiDocument,
  entity: protos.google.cloud.documentai.v1.Document.IEntity
) {
  return (
    entity.mentionText ??
    entity.textAnchor?.content ??
    extractDocumentAiTextAnchor(document, entity.textAnchor) ??
    entity.normalizedValue?.text ??
    null
  );
}

function entityTextPreview(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function logDocumentAiResponse(input: {
  processor: DocumentAiProcessorKind;
  processorName: string;
  mimeType: string;
  document: DocumentAiDocument | null;
  fullText: string;
  rawResponse: Record<string, unknown>;
}) {
  if (!shouldLogDocumentAiResponse()) {
    return;
  }

  const entities = input.document?.entities ?? [];
  const summary: Record<string, unknown> = {
    at: new Date().toISOString(),
    processor: input.processor,
    processorName: input.processorName,
    mimeType: input.mimeType,
    pages: input.document?.pages?.length ?? 0,
    entities: entities.length,
    textLength: input.fullText.length,
    textPreview: entityTextPreview(input.fullText, 1200),
    entityPreview: entities
      .slice(0, 50)
      .map((entity) => summarizeDocumentAiEntity(input.document ?? {}, entity))
  };

  if (entities.length > 50) {
    summary.entityPreviewTruncated = entities.length - 50;
  }

  if (shouldLogRawDocumentAiResponse()) {
    summary.rawResponse = input.rawResponse;
  }

  console.info("[document-ai] process_response", summary);
}

export async function processDocumentWithDocumentAi(input: {
  processor: DocumentAiProcessorKind;
  bytes: Buffer | Uint8Array;
  mimeType: string;
  skipHumanReview?: boolean;
  processOptions?: DocumentAiProcessOptions;
  imagelessMode?: boolean;
  labels?: Record<string, string>;
  fieldMaskPaths?: string[];
}) {
  const processorName = getDocumentAiProcessorName(input.processor);
  const debug = startServerDebug("document_ai_process", {
    processor: input.processor,
    processorName,
    mimeType: input.mimeType
  });

  try {
    const [response] = await getDocumentAiClient().processDocument({
      name: processorName,
      skipHumanReview: input.skipHumanReview ?? true,
      imagelessMode: input.imagelessMode,
      labels: input.labels,
      processOptions: input.processOptions,
      fieldMask: input.fieldMaskPaths?.length ? { paths: input.fieldMaskPaths } : undefined,
      rawDocument: {
        content: Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes),
        mimeType: input.mimeType
      }
    });

    const document = response.document ?? null;
    const fullText = getDocumentAiFullText(document);
    const rawResponse = toSerializableDocumentAiResponse(response);

    debug.complete({
      pages: document?.pages?.length ?? 0,
      entities: document?.entities?.length ?? 0,
      textLength: fullText.length
    });
    logDocumentAiResponse({
      processor: input.processor,
      processorName,
      mimeType: input.mimeType,
      document,
      fullText,
      rawResponse
    });

    return {
      processor: input.processor,
      processorName,
      response,
      document,
      fullText,
      pageCount: document?.pages?.length ?? 0,
      entityCount: document?.entities?.length ?? 0,
      rawResponse
    };
  } catch (error) {
    debug.fail(error, {
      processor: input.processor,
      processorName
    });
    throw error;
  }
}

export function resetDocumentAiClientForTests() {
  documentAiClientCache = null;
}
