/**
 * Prisma mappers for document pipeline records.
 * These helpers convert document, run, artifact, evidence, and summary rows into app records.
 */

import { normalizeSummaryRecord } from "@/lib/summaries";
import type {
  DocumentArtifactRecord,
  DocumentFieldEvidenceRecord,
  DocumentRecord,
  DocumentReviewItemRecord,
  DocumentRunRecord,
  DocumentSectionRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord,
  JobRecord,
  SummaryRecord
} from "@/lib/types";

import { iso, toStringArray } from "./prisma-shared";

export function toDocumentRecord(document: {
  id: string;
  dealId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  processingStatus: string;
  rawText: string | null;
  normalizedText: string | null;
  documentKind: string;
  classificationConfidence: number | null;
  sourceType: string;
  errorMessage: string | null;
  processingRunId: string | null;
  processingRunStateJson: unknown | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentRecord {
  return {
    ...document,
    processingStatus: document.processingStatus as DocumentRecord["processingStatus"],
    sourceType: document.sourceType as DocumentRecord["sourceType"],
    documentKind: document.documentKind as DocumentRecord["documentKind"],
    processingRunId: document.processingRunId,
    processingRunStateJson:
      (document.processingRunStateJson as DocumentRecord["processingRunStateJson"]) ?? null,
    processingStartedAt: iso(document.processingStartedAt),
    createdAt: iso(document.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(document.updatedAt) ?? new Date().toISOString()
  };
}

export function toJobRecord(job: {
  id: string;
  dealId: string;
  documentId: string;
  type: string;
  status: string;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  failureReason: string | null;
}): JobRecord {
  return {
    ...job,
    type: job.type as JobRecord["type"],
    status: job.status as JobRecord["status"],
    createdAt: iso(job.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(job.updatedAt) ?? new Date().toISOString()
  };
}

export function toSectionRecord(section: {
  id: string;
  documentId: string;
  title: string;
  content: string;
  chunkIndex: number;
  pageRange: string | null;
  createdAt: Date;
}): DocumentSectionRecord {
  return {
    ...section,
    createdAt: iso(section.createdAt) ?? new Date().toISOString()
  };
}

export function toExtractionResultRecord(result: {
  id: string;
  documentId: string;
  schemaVersion: string;
  model: string;
  data: unknown;
  confidence: number | null;
  conflicts: unknown;
  createdAt: Date;
}): ExtractionResultRecord {
  return {
    ...result,
    data: result.data as ExtractionResultRecord["data"],
    conflicts: toStringArray(result.conflicts),
    createdAt: iso(result.createdAt) ?? new Date().toISOString()
  };
}

export function toEvidenceRecord(entry: {
  id: string;
  documentId: string;
  fieldPath: string;
  snippet: string;
  sectionId: string | null;
  confidence: number | null;
  createdAt: Date;
}): ExtractionEvidenceRecord {
  return {
    ...entry,
    createdAt: iso(entry.createdAt) ?? new Date().toISOString()
  };
}

export function toDocumentRunRecord(run: {
  id: string;
  documentId: string;
  status: string;
  stepStateJson: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentRunRecord {
  return {
    ...run,
    status: run.status as DocumentRunRecord["status"],
    stepStateJson: run.stepStateJson as DocumentRunRecord["stepStateJson"],
    startedAt: iso(run.startedAt),
    completedAt: iso(run.completedAt),
    failedAt: iso(run.failedAt),
    createdAt: iso(run.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(run.updatedAt) ?? new Date().toISOString()
  };
}

export function toDocumentArtifactRecord(artifact: {
  id: string;
  documentId: string;
  runId: string;
  step: string;
  kind: string;
  processor: string | null;
  payload: unknown;
  createdAt: Date;
}): DocumentArtifactRecord {
  return {
    ...artifact,
    step: artifact.step as DocumentArtifactRecord["step"],
    kind: artifact.kind as DocumentArtifactRecord["kind"],
    processor: artifact.processor ?? null,
    payload:
      artifact.payload && typeof artifact.payload === "object"
        ? (artifact.payload as DocumentArtifactRecord["payload"])
        : null,
    createdAt: iso(artifact.createdAt) ?? new Date().toISOString()
  };
}

export function toDocumentFieldEvidenceRecord(entry: {
  id: string;
  documentId: string;
  runId: string;
  fieldPath: string;
  snippet: string;
  sourceType: string;
  sectionId: string | null;
  artifactId: string | null;
  confidence: number | null;
  createdAt: Date;
}): DocumentFieldEvidenceRecord {
  return {
    ...entry,
    sourceType: entry.sourceType as DocumentFieldEvidenceRecord["sourceType"],
    createdAt: iso(entry.createdAt) ?? new Date().toISOString()
  };
}

export function toDocumentReviewItemRecord(entry: {
  id: string;
  documentId: string;
  runId: string;
  fieldPath: string;
  status: string;
  reason: string;
  title: string;
  detail: string;
  confidence: number | null;
  suggestedValue: unknown;
  currentValue: unknown;
  sectionId: string | null;
  artifactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentReviewItemRecord {
  return {
    ...entry,
    status: entry.status as DocumentReviewItemRecord["status"],
    reason: entry.reason as DocumentReviewItemRecord["reason"],
    suggestedValue: entry.suggestedValue ?? null,
    currentValue: entry.currentValue ?? null,
    createdAt: iso(entry.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(entry.updatedAt) ?? new Date().toISOString()
  };
}

export function toSummaryRecord(summary: {
  id: string;
  dealId: string;
  documentId: string | null;
  body: string;
  version: string;
  summaryType?: string | null;
  source?: string | null;
  parentSummaryId?: string | null;
  isCurrent?: boolean | null;
  createdAt: Date;
}): SummaryRecord {
  return normalizeSummaryRecord({
    ...summary,
    summaryType: (summary.summaryType as SummaryRecord["summaryType"]) ?? null,
    source: (summary.source as SummaryRecord["source"]) ?? null,
    parentSummaryId: summary.parentSummaryId ?? null,
    isCurrent: summary.isCurrent ?? false,
    createdAt: iso(summary.createdAt) ?? new Date().toISOString()
  });
}
