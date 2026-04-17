import type {
  SummaryRecord,
  SummaryRecordInput,
  SummarySource,
  SummaryType
} from "@/lib/types";

const SUMMARY_TYPES: SummaryType[] = ["legal", "plain_language", "short"];

const SUMMARY_TYPE_LABELS: Record<SummaryType, string> = {
  legal: "Legal",
  plain_language: "Plain language",
  short: "Short"
};

function isIntakeSummaryVersion(version: string) {
  return version.startsWith("intake-normalized:");
}

function isSummaryType(value: unknown): value is SummaryType {
  return typeof value === "string" && SUMMARY_TYPES.includes(value as SummaryType);
}

function isSummarySource(value: unknown): value is SummarySource {
  return value === "analysis" || value === "simplification";
}

export function normalizeSummaryInput(input: SummaryRecordInput): SummaryRecordInput {
  if (isIntakeSummaryVersion(input.version)) {
    return {
      ...input,
      summaryType: null,
      source: null,
      parentSummaryId: null,
      isCurrent: false
    };
  }

  return {
    ...input,
    summaryType: input.summaryType ?? "legal",
    source: input.source ?? "analysis",
    parentSummaryId: input.parentSummaryId ?? null,
    isCurrent: input.isCurrent ?? true
  };
}

export function normalizeSummaryRecord(
  summary: Omit<SummaryRecord, "summaryType" | "source" | "parentSummaryId" | "isCurrent"> & {
    summaryType?: SummaryType | null;
    source?: SummarySource | null;
    parentSummaryId?: string | null;
    isCurrent?: boolean | null;
  }
): SummaryRecord {
  const normalized = normalizeSummaryInput({
    body: summary.body,
    version: summary.version,
    summaryType: summary.summaryType ?? null,
    source: summary.source ?? null,
    parentSummaryId: summary.parentSummaryId ?? null,
    isCurrent: summary.isCurrent ?? false
  });

  return {
    ...summary,
    summaryType: normalized.summaryType ?? null,
    source: normalized.source ?? null,
    parentSummaryId: normalized.parentSummaryId ?? null,
    isCurrent: normalized.isCurrent ?? false
  };
}

export function getWorkspaceSummaries(summaries: SummaryRecord[]) {
  return summaries.filter(
    (summary) => summary.summaryType !== null && !isIntakeSummaryVersion(summary.version)
  );
}

export function getCurrentWorkspaceSummary(summaries: SummaryRecord[]) {
  const workspaceSummaries = getWorkspaceSummaries(summaries);
  return workspaceSummaries.find((summary) => summary.isCurrent) ?? workspaceSummaries[0] ?? null;
}

export function getLatestSummaryByType(
  summaries: SummaryRecord[],
  summaryType: SummaryType
) {
  return (
    [...getWorkspaceSummaries(summaries)]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .find((summary) => summary.summaryType === summaryType) ?? null
  );
}

export function getSummaryTypeLabel(summaryType: SummaryType) {
  return SUMMARY_TYPE_LABELS[summaryType];
}
