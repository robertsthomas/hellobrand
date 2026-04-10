/**
 * Document ingestion, extraction pipeline, and summary record types.
 * Keep deal policy decisions and workspace UI state out of this module.
 */

import type { DealTermsRecord, RiskFlagRecord } from "./deals";

export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";

export type DocumentKind =
  | "contract"
  | "deliverables_brief"
  | "campaign_brief"
  | "pitch_deck"
  | "invoice"
  | "email_thread"
  | "unknown";

export type SummaryType = "legal" | "plain_language" | "short";
export type SummarySource = "analysis" | "simplification";

export type JobType =
  | "extract_text"
  | "classify_document"
  | "section_document"
  | "extract_fields"
  | "merge_results"
  | "analyze_risks"
  | "generate_summary";

export interface DocumentProcessingRunState {
  runId: string;
  completedSteps: JobType[];
  stepCompletedAt: Partial<Record<JobType, string>>;
  failedStep: JobType | null;
  failedAt: string | null;
  lastError: string | null;
}

export type DocumentRunStatus = "pending" | "processing" | "ready" | "failed" | "superseded";
export type DocumentArtifactKind =
  | "text_extraction"
  | "classification"
  | "sections"
  | "raw_vendor_output"
  | "normalized_extraction"
  | "risk_analysis"
  | "summary"
  | "observability";
export type DocumentEvidenceSourceType = "document" | "section" | "vendor_entity";
export type DocumentReviewItemStatus = "open" | "resolved" | "dismissed";
export type DocumentReviewItemReason = "low_confidence" | "conflict";

export interface DocumentRecord {
  id: string;
  dealId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  processingStatus: ProcessingStatus;
  rawText: string | null;
  normalizedText: string | null;
  documentKind: DocumentKind;
  classificationConfidence: number | null;
  sourceType: "file" | "pasted_text" | "email_attachment";
  errorMessage: string | null;
  processingRunId: string | null;
  processingRunStateJson: DocumentProcessingRunState | null;
  processingStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectUploadFileRegistration {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
}

export interface JobRecord {
  id: string;
  dealId: string;
  documentId: string;
  type: JobType;
  status: ProcessingStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  failureReason: string | null;
}

export interface DocumentSectionRecord {
  id: string;
  documentId: string;
  title: string;
  content: string;
  chunkIndex: number;
  pageRange: string | null;
  createdAt: string;
}

export interface ExtractionEvidenceRecord {
  id: string;
  documentId: string;
  fieldPath: string;
  snippet: string;
  sectionId: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface ExtractionResultRecord {
  id: string;
  documentId: string;
  schemaVersion: string;
  model: string;
  data: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction">;
  confidence: number | null;
  conflicts: string[];
  createdAt: string;
}

export interface DocumentRunRecord {
  id: string;
  documentId: string;
  status: DocumentRunStatus;
  stepStateJson: DocumentProcessingRunState;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentArtifactRecord {
  id: string;
  documentId: string;
  runId: string;
  step: JobType;
  kind: DocumentArtifactKind;
  processor: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface DocumentFieldEvidenceRecord {
  id: string;
  documentId: string;
  runId: string;
  fieldPath: string;
  snippet: string;
  sourceType: DocumentEvidenceSourceType;
  sectionId: string | null;
  artifactId: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface DocumentReviewItemRecord {
  id: string;
  documentId: string;
  runId: string;
  fieldPath: string;
  status: DocumentReviewItemStatus;
  reason: DocumentReviewItemReason;
  title: string;
  detail: string;
  confidence: number | null;
  suggestedValue: unknown | null;
  currentValue: unknown | null;
  sectionId: string | null;
  artifactId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryRecord {
  id: string;
  dealId: string;
  documentId: string | null;
  body: string;
  version: string;
  summaryType: SummaryType | null;
  source: SummarySource | null;
  parentSummaryId: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface SummaryRecordInput {
  body: string;
  version: string;
  summaryType?: SummaryType | null;
  source?: SummarySource | null;
  parentSummaryId?: string | null;
  isCurrent?: boolean;
}

export interface FieldEvidence {
  fieldPath: string;
  snippet: string;
  sectionKey: string | null;
  confidence: number | null;
}

export interface DocumentSectionInput {
  title: string;
  content: string;
  chunkIndex: number;
  pageRange: string | null;
}

export interface DocumentClassificationResult {
  documentKind: DocumentKind;
  confidence: number | null;
}

export interface ExtractionPipelineResult {
  schemaVersion: string;
  model: string;
  confidence: number | null;
  data: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction">;
  evidence: FieldEvidence[];
  conflicts: string[];
}

export interface DocumentSummaryResult {
  body: string;
  version: string;
  summaryType?: SummaryType | null;
  source?: SummarySource | null;
  parentSummaryId?: string | null;
  isCurrent?: boolean;
}

export interface DocumentAnalysisResult {
  classification: DocumentClassificationResult;
  sections: DocumentSectionInput[];
  extraction: ExtractionPipelineResult;
  riskFlags: Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">[];
  summary: DocumentSummaryResult;
}
