import type { DocumentKind } from "@/lib/types";

type RolloutProcessorKind = "brief" | "contract" | "invoice" | "layout" | "ocr";

export interface DocumentPipelineRolloutConfig {
  forceLegacy: boolean;
  allowedKinds: DocumentKind[] | null;
  cohortPercent: number;
  allowedUserIds: string[] | null;
}

export interface DocumentPipelineRolloutDecision {
  enabled: boolean;
  cohortBucket: number;
  reasons: string[];
  config: DocumentPipelineRolloutConfig;
}

const DEFAULT_COHORT_PERCENT = 100;

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseCsv(value: string | null | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const entries = normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.length > 0 ? entries : null;
}

function parseBoolean(value: string | null | undefined) {
  const normalized = normalizeString(value)?.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parsePercent(value: string | null | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return DEFAULT_COHORT_PERCENT;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_COHORT_PERCENT;
  }

  return Math.max(0, Math.min(100, parsed));
}

function hashToPercent(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash % 100;
}

function resolveCohortSeed(input: {
  dealId?: string | null;
  documentId?: string | null;
  userId?: string | null;
  fileName?: string | null;
}) {
  return (
    normalizeString(input.dealId) ??
    normalizeString(input.documentId) ??
    normalizeString(input.userId) ??
    normalizeString(input.fileName) ??
    "hellobrand-default"
  );
}

export function getDocumentPipelineRolloutConfig(): DocumentPipelineRolloutConfig {
  const allowedKinds = parseCsv(process.env.DOCUMENT_PIPELINE_V2_ALLOWED_KINDS);
  const allowedUserIds = parseCsv(process.env.DOCUMENT_PIPELINE_V2_ALLOWED_USER_IDS);

  return {
    forceLegacy: parseBoolean(process.env.DOCUMENT_PIPELINE_V2_FORCE_LEGACY),
    allowedKinds: (allowedKinds as DocumentKind[] | null) ?? null,
    cohortPercent: parsePercent(process.env.DOCUMENT_PIPELINE_V2_COHORT_PERCENT),
    allowedUserIds
  };
}

export function evaluateDocumentPipelineRollout(input: {
  documentKind?: DocumentKind | null;
  dealId?: string | null;
  documentId?: string | null;
  userId?: string | null;
  fileName?: string | null;
}) {
  const config = getDocumentPipelineRolloutConfig();
  const reasons: string[] = [];

  if (config.forceLegacy) {
    reasons.push("force_legacy");
    return {
      enabled: false,
      cohortBucket: hashToPercent(resolveCohortSeed(input)),
      reasons,
      config
    } satisfies DocumentPipelineRolloutDecision;
  }

  if (config.allowedUserIds && !config.allowedUserIds.includes(input.userId ?? "")) {
    reasons.push("user_not_allowlisted");
    return {
      enabled: false,
      cohortBucket: hashToPercent(resolveCohortSeed(input)),
      reasons,
      config
    } satisfies DocumentPipelineRolloutDecision;
  }

  if (
    input.documentKind &&
    config.allowedKinds &&
    !config.allowedKinds.includes(input.documentKind)
  ) {
    reasons.push("document_kind_not_enabled");
    return {
      enabled: false,
      cohortBucket: hashToPercent(resolveCohortSeed(input)),
      reasons,
      config
    } satisfies DocumentPipelineRolloutDecision;
  }

  const cohortBucket = hashToPercent(resolveCohortSeed(input));
  if (cohortBucket >= config.cohortPercent) {
    reasons.push("cohort_not_enabled");
    return {
      enabled: false,
      cohortBucket,
      reasons,
      config
    } satisfies DocumentPipelineRolloutDecision;
  }

  reasons.push("enabled");
  return {
    enabled: true,
    cohortBucket,
    reasons,
    config
  } satisfies DocumentPipelineRolloutDecision;
}

export function isDocumentAiParsingEnabled(input: {
  dealId?: string | null;
  documentId?: string | null;
  userId?: string | null;
  fileName?: string | null;
}) {
  return evaluateDocumentPipelineRollout(input).enabled;
}

export function estimateDocumentAiCostUsd(
  processor: RolloutProcessorKind | string | null | undefined,
  pageCount: number | null | undefined
) {
  const normalizedProcessor = normalizeString(processor)?.toLowerCase();
  const safePageCount = typeof pageCount === "number" && pageCount > 0 ? pageCount : 0;

  if (!normalizedProcessor || safePageCount === 0) {
    return 0;
  }

  const perPageUsd =
    normalizedProcessor === "layout"
      ? 0.01
      : normalizedProcessor === "ocr"
        ? 0.0015
        : normalizedProcessor === "invoice"
          ? 0.01
          : normalizedProcessor === "contract" || normalizedProcessor === "brief"
            ? 0.03
            : 0;

  return Number((safePageCount * perPageUsd).toFixed(4));
}
