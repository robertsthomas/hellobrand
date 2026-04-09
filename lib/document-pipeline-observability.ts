import type {
  DealAggregate,
  DocumentArtifactRecord,
  DocumentReviewItemRecord,
  DocumentRunRecord,
  JobType
} from "@/lib/types";

type StageMetrics = {
  durationMs: number;
  failed: boolean;
};

export interface DocumentRunObservabilitySummary {
  runId: string;
  status: DocumentRunRecord["status"];
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  totalDurationMs: number;
  estimatedCostUsd: number;
  pagesProcessed: number;
  extractionConfidence: number | null;
  openReviewItems: number;
  lowConfidenceReviewItems: number;
  conflictReviewItems: number;
  fallbackCount: number;
  processorsUsed: string[];
  stages: Partial<Record<JobType, StageMetrics>>;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function payloadOf(artifact: DocumentArtifactRecord) {
  return artifact.payload ?? {};
}

function collectStageMetrics(artifacts: DocumentArtifactRecord[]) {
  const stages: Partial<Record<JobType, StageMetrics>> = {};

  for (const artifact of artifacts) {
    if (artifact.kind !== "observability") {
      continue;
    }

    const payload = payloadOf(artifact);
    if (payload.event !== "step_result") {
      continue;
    }

    const durationMs = asNumber(payload.durationMs);
    if (durationMs === null) {
      continue;
    }

    stages[artifact.step] = {
      durationMs,
      failed: asBoolean(payload.failed)
    };
  }

  return stages;
}

function summarizeProcessors(artifacts: DocumentArtifactRecord[]) {
  return Array.from(
    new Set(
      artifacts
        .map((artifact) => artifact.processor)
        .filter((value): value is string => Boolean(value))
    )
  );
}

function sumNumericArtifacts(
  artifacts: DocumentArtifactRecord[],
  matcher: (artifact: DocumentArtifactRecord) => boolean,
  key: string
) {
  return Number(
    artifacts
      .filter(matcher)
      .reduce((sum, artifact) => sum + (asNumber(payloadOf(artifact)[key]) ?? 0), 0)
      .toFixed(4)
  );
}

function extractConfidence(artifacts: DocumentArtifactRecord[]) {
  const extractionArtifact = artifacts.find((artifact) => artifact.kind === "normalized_extraction");
  if (!extractionArtifact) {
    return null;
  }

  return asNumber(payloadOf(extractionArtifact).confidence);
}

export function summarizeDocumentRunObservability(input: {
  aggregate: Pick<DealAggregate, "documentRuns" | "documentArtifacts" | "documentReviewItems">;
  runId: string;
}) {
  const run = input.aggregate.documentRuns.find((entry) => entry.id === input.runId);
  if (!run) {
    return null;
  }

  const artifacts = input.aggregate.documentArtifacts.filter((entry) => entry.runId === input.runId);
  const reviewItems = input.aggregate.documentReviewItems.filter((entry) => entry.runId === input.runId);

  return {
    runId: run.id,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    failedAt: run.failedAt,
    totalDurationMs:
      run.startedAt && (run.completedAt ?? run.failedAt)
        ? new Date(run.completedAt ?? run.failedAt!).getTime() - new Date(run.startedAt).getTime()
        : 0,
    estimatedCostUsd: sumNumericArtifacts(
      artifacts,
      (artifact) => artifact.kind === "observability",
      "estimatedCostUsd"
    ),
    pagesProcessed: sumNumericArtifacts(
      artifacts,
      (artifact) => artifact.kind === "observability",
      "pageCount"
    ),
    extractionConfidence: extractConfidence(artifacts),
    openReviewItems: reviewItems.filter((entry) => entry.status === "open").length,
    lowConfidenceReviewItems: reviewItems.filter(
      (entry) => entry.status === "open" && entry.reason === "low_confidence"
    ).length,
    conflictReviewItems: reviewItems.filter(
      (entry) => entry.status === "open" && entry.reason === "conflict"
    ).length,
    fallbackCount: artifacts.filter((artifact) => {
      if (artifact.kind !== "observability") {
        return false;
      }

      const payload = payloadOf(artifact);
      return asBoolean(payload.usedFallback) || Boolean(asString(payload.fallbackRoute));
    }).length,
    processorsUsed: summarizeProcessors(artifacts),
    stages: collectStageMetrics(artifacts)
  } satisfies DocumentRunObservabilitySummary;
}
