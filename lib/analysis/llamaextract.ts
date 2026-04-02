import type {
  CampaignDateWindow,
  DealTermsRecord,
  DisclosureObligation,
  DocumentKind,
  DocumentRecord,
  ExtractionPipelineResult,
  FieldEvidence
} from "@/lib/types";
import {
  mergeConflictIntelligence,
  normalizeDealCategory
} from "@/lib/conflict-intelligence";
import { sanitizePartyName } from "@/lib/party-labels";
import { normalizeEvidenceSnippet } from "@/lib/utils";

type TermsData = Omit<
  DealTermsRecord,
  "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction"
>;

type ExtractTier = "cost_effective" | "agentic";
type ExtractInputSource = "parse_job" | "file_upload";
type ExtractStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

type LlamaExtractJobResponse = {
  id?: string;
  status?: string;
  error?: string | null;
  extract_result?: unknown;
  extract_metadata?: {
    field_metadata?: unknown;
  } | null;
};

export type ContractLlamaExtractMode = "off" | "shadow" | "primary";

export type ContractLlamaExtractResult = {
  extraction: ExtractionPipelineResult;
  inputSource: ExtractInputSource;
  projectId: string;
};

type ExtractRequestOptions = {
  document: Pick<DocumentRecord, "fileName" | "mimeType" | "sourceType">;
  fallbackData: TermsData;
  buffer?: Buffer | null;
  parseJobId?: string | null;
  projectId?: string | null;
};

const LLAMA_CLOUD_API_BASE = "https://api.cloud.llamaindex.ai";
const EXTRACT_SCHEMA_VERSION = "llamaextract-contract-v2";

const CONTRACT_DATA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    brandName: {
      type: "string",
      description: "Brand or advertiser party name as written in the contract."
    },
    agencyName: {
      type: "string",
      description: "Agency party name if the agreement includes one."
    },
    creatorName: {
      type: "string",
      description: "Creator, talent, or influencer name."
    },
    campaignName: {
      type: "string",
      description: "Campaign title, project title, or statement of work name."
    },
    paymentAmount: {
      type: "number",
      description: "Total contract compensation as a single numeric amount."
    },
    currency: {
      type: "string",
      description: "Currency code or currency name tied to the payment amount."
    },
    paymentTerms: {
      type: "string",
      description: "Short payment terms summary such as Net 30 or 50 percent upfront."
    },
    paymentStructure: {
      type: "string",
      description: "Payment structure such as flat fee, milestone, installment, or commission."
    },
    netTermsDays: {
      type: "integer",
      description: "Number of days in the payment window when explicit."
    },
    paymentTrigger: {
      type: "string",
      description: "What event triggers payment, such as invoice receipt, content approval, or posting."
    },
    deliverables: {
      type: "array",
      description: "Required deliverables or content outputs in the agreement.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          dueDate: { type: "string" },
          channel: { type: "string" },
          quantity: { type: "number" },
          description: { type: "string" }
        }
      }
    },
    usageRights: {
      type: "string",
      description: "Summary of usage rights granted to the brand."
    },
    usageRightsOrganicAllowed: {
      type: "boolean",
      description: "Whether the brand can reuse content organically."
    },
    usageRightsPaidAllowed: {
      type: "boolean",
      description: "Whether the brand can use the content in paid media or advertisements."
    },
    whitelistingAllowed: {
      type: "boolean",
      description: "Whether the agreement allows boosting or whitelisting from the creator handle."
    },
    usageDuration: {
      type: "string",
      description: "How long usage rights last."
    },
    usageTerritory: {
      type: "string",
      description: "Geographic territory or regions where the content can be used."
    },
    usageChannels: {
      type: "array",
      description: "Specific channels or placements covered by the usage rights.",
      items: { type: "string" }
    },
    exclusivity: {
      type: "string",
      description: "Summary of exclusivity obligations or competitive restrictions."
    },
    exclusivityApplies: {
      type: "boolean",
      description: "Whether any exclusivity restriction applies."
    },
    exclusivityCategory: {
      type: "string",
      description: "Product, service, or competitive category covered by exclusivity."
    },
    exclusivityDuration: {
      type: "string",
      description: "Length of the exclusivity period."
    },
    exclusivityRestrictions: {
      type: "string",
      description: "Specific actions, brands, or categories restricted by exclusivity."
    },
    brandCategory: {
      type: "string",
      description: "Normalized best-fit brand category if explicit in the document."
    },
    competitorCategories: {
      type: "array",
      items: { type: "string" },
      description: "Competitive categories explicitly mentioned."
    },
    restrictedCategories: {
      type: "array",
      items: { type: "string" },
      description: "Restricted categories explicitly mentioned."
    },
    campaignDateWindow: {
      type: "object",
      additionalProperties: false,
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
        postingWindow: { type: "string" }
      },
      description: "Campaign dates, posting window, or performance window."
    },
    disclosureObligations: {
      type: "array",
      description: "Disclosure, sponsorship, or approval obligations in the agreement.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          source: { type: "string" }
        }
      }
    },
    revisions: {
      type: "string",
      description: "Summary of revision or edit rights."
    },
    revisionRounds: {
      type: "integer",
      description: "Number of revision rounds when explicitly stated."
    },
    termination: {
      type: "string",
      description: "Summary of termination clause terms."
    },
    terminationAllowed: {
      type: "boolean",
      description: "Whether termination is expressly allowed."
    },
    terminationNotice: {
      type: "string",
      description: "Required termination notice period if stated."
    },
    terminationConditions: {
      type: "string",
      description: "Conditions, cause requirements, or fees tied to termination."
    },
    governingLaw: {
      type: "string",
      description: "Governing law or venue clause."
    },
    notes: {
      type: "string",
      description: "Other contract terms relevant to creator operations that do not fit another field."
    }
  }
} as const;

function hasLlamaCloudKey() {
  return Boolean(process.env.LLAMA_CLOUD_API_KEY);
}

function parseTimeoutMs(value: string | undefined, fallbackMs: number) {
  if (!value) {
    return fallbackMs;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function llamaExtractTier(): ExtractTier {
  return process.env.LLAMA_EXTRACT_TIER === "cost_effective"
    ? "cost_effective"
    : "agentic";
}

function llamaExtractTimeoutMs() {
  return parseTimeoutMs(process.env.LLAMA_EXTRACT_TIMEOUT_MS, 180_000);
}

function configuredMode(): ContractLlamaExtractMode {
  const value = process.env.LLAMA_EXTRACT_CONTRACTS_MODE;
  if (value === "shadow" || value === "primary") {
    return value;
  }

  return "off";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms
    );

    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(asString).filter((entry): entry is string => Boolean(entry));
}

function asDateWindow(value: unknown): CampaignDateWindow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    startDate: asString(row.startDate),
    endDate: asString(row.endDate),
    postingWindow: asString(row.postingWindow)
  };
}

function asDisclosureObligations(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const title = asString(row.title);
      const detail = asString(row.detail);
      if (!title || !detail) {
        return null;
      }

      const obligation: DisclosureObligation = {
        id: asString(row.id) ?? `llamaextract-disclosure-${index}`,
        title,
        detail,
        source: asString(row.source)
      };

      return obligation;
    })
    .filter((entry): entry is DisclosureObligation => entry !== null);
}

function normalizeDeliverables(
  value: unknown,
  fallbackDeliverables: TermsData["deliverables"]
) {
  if (!Array.isArray(value)) {
    return fallbackDeliverables;
  }

  const normalized: TermsData["deliverables"] = [];

  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const title = asString(row.title);
    if (!title) {
      continue;
    }

    normalized.push({
      id: asString(row.id) || `llamaextract-deliverable-${index}`,
      title,
      dueDate: asString(row.dueDate),
      channel: asString(row.channel),
      quantity: asNumber(row.quantity),
      status: "pending",
      description: asString(row.description)
    });
  }

  return normalized.length > 0 ? normalized : fallbackDeliverables;
}

function normalizeTerms(rawData: unknown, fallbackData: TermsData): TermsData {
  if (!rawData || typeof rawData !== "object") {
    return fallbackData;
  }

  const input = rawData as Record<string, unknown>;
  const mergedConflictIntelligence = mergeConflictIntelligence(fallbackData, {
    competitorCategories: asStringArray(input.competitorCategories),
    restrictedCategories: asStringArray(input.restrictedCategories),
    disclosureObligations: asDisclosureObligations(input.disclosureObligations),
    campaignDateWindow: asDateWindow(input.campaignDateWindow)
  });
  const brandName = sanitizePartyName(asString(input.brandName), "brand");
  const agencyName = sanitizePartyName(asString(input.agencyName), "agency");

  return {
    ...fallbackData,
    brandName: brandName ?? fallbackData.brandName,
    agencyName:
      agencyName &&
      (!brandName || agencyName.toLowerCase() !== brandName.toLowerCase())
        ? agencyName
        : fallbackData.agencyName,
    creatorName: asString(input.creatorName) ?? fallbackData.creatorName,
    campaignName: asString(input.campaignName) ?? fallbackData.campaignName,
    paymentAmount: asNumber(input.paymentAmount) ?? fallbackData.paymentAmount,
    currency: asString(input.currency) ?? fallbackData.currency,
    paymentTerms: asString(input.paymentTerms) ?? fallbackData.paymentTerms,
    paymentStructure: asString(input.paymentStructure) ?? fallbackData.paymentStructure,
    netTermsDays: asNumber(input.netTermsDays) ?? fallbackData.netTermsDays,
    paymentTrigger: asString(input.paymentTrigger) ?? fallbackData.paymentTrigger,
    deliverables: normalizeDeliverables(input.deliverables, fallbackData.deliverables),
    usageRights: asString(input.usageRights) ?? fallbackData.usageRights,
    usageRightsOrganicAllowed:
      asBoolean(input.usageRightsOrganicAllowed) ?? fallbackData.usageRightsOrganicAllowed,
    usageRightsPaidAllowed:
      asBoolean(input.usageRightsPaidAllowed) ?? fallbackData.usageRightsPaidAllowed,
    whitelistingAllowed:
      asBoolean(input.whitelistingAllowed) ?? fallbackData.whitelistingAllowed,
    usageDuration: asString(input.usageDuration) ?? fallbackData.usageDuration,
    usageTerritory: asString(input.usageTerritory) ?? fallbackData.usageTerritory,
    usageChannels: Array.from(
      new Set([...fallbackData.usageChannels, ...asStringArray(input.usageChannels)])
    ),
    exclusivity: asString(input.exclusivity) ?? fallbackData.exclusivity,
    exclusivityApplies:
      asBoolean(input.exclusivityApplies) ?? fallbackData.exclusivityApplies,
    exclusivityCategory:
      asString(input.exclusivityCategory) ?? fallbackData.exclusivityCategory,
    exclusivityDuration:
      asString(input.exclusivityDuration) ?? fallbackData.exclusivityDuration,
    exclusivityRestrictions:
      asString(input.exclusivityRestrictions) ?? fallbackData.exclusivityRestrictions,
    brandCategory:
      normalizeDealCategory(asString(input.brandCategory)) ?? fallbackData.brandCategory,
    competitorCategories: mergedConflictIntelligence.competitorCategories,
    restrictedCategories: mergedConflictIntelligence.restrictedCategories,
    campaignDateWindow: mergedConflictIntelligence.campaignDateWindow,
    disclosureObligations: mergedConflictIntelligence.disclosureObligations,
    revisions: asString(input.revisions) ?? fallbackData.revisions,
    revisionRounds: asNumber(input.revisionRounds) ?? fallbackData.revisionRounds,
    termination: asString(input.termination) ?? fallbackData.termination,
    terminationAllowed:
      asBoolean(input.terminationAllowed) ?? fallbackData.terminationAllowed,
    terminationNotice:
      asString(input.terminationNotice) ?? fallbackData.terminationNotice,
    terminationConditions:
      asString(input.terminationConditions) ?? fallbackData.terminationConditions,
    governingLaw: asString(input.governingLaw) ?? fallbackData.governingLaw,
    notes: asString(input.notes) ?? fallbackData.notes
  };
}

function confidenceFromMetadata(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  return (
    asNumber(row.confidence) ??
    asNumber(row.extraction_confidence) ??
    asNumber(row.parsing_confidence)
  );
}

function collectFieldEvidence(
  value: unknown,
  fieldPath: string,
  evidence: FieldEvidence[]
) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectFieldEvidence(entry, fieldPath, evidence));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const row = value as Record<string, unknown>;
  const citations = Array.isArray(row.citation) ? row.citation : [];
  const confidence = confidenceFromMetadata(row);

  for (const citation of citations) {
    if (!citation || typeof citation !== "object") {
      continue;
    }

    const snippet = normalizeEvidenceSnippet(
      asString((citation as Record<string, unknown>).matching_text)
    );
    if (!snippet) {
      continue;
    }

    evidence.push({
      fieldPath,
      snippet,
      sectionKey: null,
      confidence
    });
  }

  for (const nestedValue of Object.values(row)) {
    collectFieldEvidence(nestedValue, fieldPath, evidence);
  }
}

function mapExtractMetadataToEvidence(fieldMetadata: unknown) {
  if (!fieldMetadata || typeof fieldMetadata !== "object") {
    return [];
  }

  const evidence: FieldEvidence[] = [];

  for (const [fieldPath, value] of Object.entries(
    fieldMetadata as Record<string, unknown>
  )) {
    collectFieldEvidence(value, fieldPath, evidence);
  }

  const deduped = new Map<string, FieldEvidence>();
  for (const entry of evidence) {
    deduped.set(`${entry.fieldPath}:${entry.snippet}`, entry);
  }

  return Array.from(deduped.values());
}

async function getClient() {
  const { default: LlamaCloud } = await import("@llamaindex/llama-cloud");

  return new LlamaCloud({
    apiKey: process.env.LLAMA_CLOUD_API_KEY
  });
}

async function resolveProjectId(client: Awaited<ReturnType<typeof getClient>>) {
  const projects = await client.projects.list();
  const project = projects.find((entry) => entry.is_default) ?? projects[0];

  if (!project?.id) {
    throw new Error("LlamaExtract could not resolve a default LlamaCloud project.");
  }

  return project.id;
}

async function createExtractFile(
  client: Awaited<ReturnType<typeof getClient>>,
  buffer: Buffer,
  fileName: string
) {
  const bytes = new Uint8Array(buffer);

  return client.files.create({
    file: new File([bytes], fileName),
    purpose: "extract"
  });
}

async function fetchJson<T>(url: URL, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LlamaExtract request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

async function createExtractJob(
  apiKey: string,
  projectId: string,
  fileInput: string
) {
  const url = new URL("/api/v2/extract", LLAMA_CLOUD_API_BASE);
  url.searchParams.set("project_id", projectId);

  return fetchJson<LlamaExtractJobResponse>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      file_input: fileInput,
      configuration: {
        tier: llamaExtractTier(),
        extraction_target: "per_doc",
        data_schema: CONTRACT_DATA_SCHEMA,
        cite_sources: true,
        confidence_scores: true
      }
    })
  });
}

async function getExtractJob(
  apiKey: string,
  projectId: string,
  jobId: string
) {
  const url = new URL(`/api/v2/extract/${jobId}`, LLAMA_CLOUD_API_BASE);
  url.searchParams.set("project_id", projectId);
  url.searchParams.append("expand", "extract_metadata");
  url.searchParams.append("expand", "metadata");

  return fetchJson<LlamaExtractJobResponse>(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });
}

async function waitForExtractCompletion(
  apiKey: string,
  projectId: string,
  jobId: string
) {
  const poll = async () => {
    for (;;) {
      const job = await getExtractJob(apiKey, projectId, jobId);
      const status = job.status as ExtractStatus | undefined;

      if (status === "COMPLETED") {
        return job;
      }

      if (status === "FAILED" || status === "CANCELLED") {
        throw new Error(job.error ?? `LlamaExtract job ${status.toLowerCase()}.`);
      }

      await sleep(2000);
    }
  };

  return withTimeout(poll(), llamaExtractTimeoutMs(), "LlamaExtract extraction");
}

export function resolveContractLlamaExtractMode(
  documentKind: DocumentKind,
  sourceType: DocumentRecord["sourceType"],
  options?: {
    hasApiKey?: boolean;
    requestedMode?: string | null;
  }
): ContractLlamaExtractMode {
  const requestedMode = options?.requestedMode ?? configuredMode();
  const hasApiKey = options?.hasApiKey ?? hasLlamaCloudKey();

  if (!hasApiKey || documentKind !== "contract" || sourceType !== "file") {
    return "off";
  }

  return requestedMode === "shadow" || requestedMode === "primary"
    ? requestedMode
    : "off";
}

export function mapContractLlamaExtractResponse(
  response: Pick<LlamaExtractJobResponse, "extract_result" | "extract_metadata">,
  fallbackData: TermsData
): ExtractionPipelineResult {
  return {
    schemaVersion: EXTRACT_SCHEMA_VERSION,
    model: `llamaextract:${llamaExtractTier()}`,
    confidence: null,
    data: normalizeTerms(response.extract_result, fallbackData),
    evidence: mapExtractMetadataToEvidence(response.extract_metadata?.field_metadata),
    conflicts: []
  };
}

export async function extractContractWithLlamaExtract(
  options: ExtractRequestOptions
): Promise<ContractLlamaExtractResult> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("LlamaExtract requires LLAMA_CLOUD_API_KEY.");
  }

  const client = await getClient();
  let projectId = options.projectId ?? null;
  let fileInput = options.parseJobId ?? null;
  let inputSource: ExtractInputSource = "parse_job";

  if (!fileInput) {
    if (!options.buffer) {
      throw new Error("LlamaExtract requires a file-backed contract document.");
    }

    const file = await withTimeout(
      createExtractFile(client, options.buffer, options.document.fileName),
      llamaExtractTimeoutMs(),
      "LlamaExtract file upload"
    );
    fileInput = file.id;
    inputSource = "file_upload";
  }

  if (!projectId) {
    projectId = await withTimeout(
      resolveProjectId(client),
      llamaExtractTimeoutMs(),
      "LlamaExtract project lookup"
    );
  }

  const created = await withTimeout(
    createExtractJob(apiKey, projectId, fileInput),
    llamaExtractTimeoutMs(),
    "LlamaExtract job creation"
  );

  if (!created.id) {
    throw new Error("LlamaExtract did not return a job ID.");
  }

  const completed = await waitForExtractCompletion(apiKey, projectId, created.id);
  if (!completed.extract_result || typeof completed.extract_result !== "object") {
    throw new Error("LlamaExtract returned an empty extraction result.");
  }

  return {
    extraction: mapContractLlamaExtractResponse(completed, options.fallbackData),
    inputSource,
    projectId
  };
}
