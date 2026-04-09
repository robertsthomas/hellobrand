import { getDocumentProcessingRunState } from "@/lib/document-pipeline-shared";
import type {
  DocumentRecord,
  DocumentReviewItemRecord,
  JobRecord,
  JobType
} from "@/lib/types";

export type DocumentDisplayState =
  | "uploaded"
  | "parsing"
  | "extracting"
  | "review_needed"
  | "ready"
  | "failed";

export interface DocumentDisplayStatus {
  state: DocumentDisplayState;
  label: string;
  detail: string;
  reviewCount: number;
  activeJobType: JobType | null;
}

function getActiveJobType(documentId: string, jobs: JobRecord[]) {
  return (
    [...jobs]
      .filter((job) => job.documentId === documentId && job.status === "processing")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.type ?? null
  );
}

function isParsingJob(jobType: JobType | null) {
  return (
    jobType === "extract_text" ||
    jobType === "classify_document" ||
    jobType === "section_document"
  );
}

export function getDocumentDisplayStatus(input: {
  document: DocumentRecord;
  jobs?: JobRecord[];
  reviewItems?: DocumentReviewItemRecord[];
}) {
  const jobs = input.jobs ?? [];
  const reviewItems = input.reviewItems ?? [];
  const reviewCount = reviewItems.filter(
    (item) => item.documentId === input.document.id && item.status === "open"
  ).length;

  if (input.document.processingStatus === "failed") {
    return {
      state: "failed" as const,
      label: "Failed",
      detail: input.document.errorMessage?.trim() || "Processing failed. Retry this document.",
      reviewCount,
      activeJobType: null
    };
  }

  if (input.document.processingStatus === "ready") {
    if (reviewCount > 0) {
      return {
        state: "review_needed" as const,
        label: "Review needed",
        detail:
          reviewCount === 1
            ? "1 extracted field needs confirmation."
            : `${reviewCount} extracted fields need confirmation.`,
        reviewCount,
        activeJobType: null
      };
    }

    return {
      state: "ready" as const,
      label: "Ready",
      detail: "Extraction complete.",
      reviewCount,
      activeJobType: null
    };
  }

  if (input.document.processingStatus === "pending") {
    return {
      state: "uploaded" as const,
      label: "Uploaded",
      detail: "Queued for processing.",
      reviewCount,
      activeJobType: null
    };
  }

  const activeJobType = getActiveJobType(input.document.id, jobs);
  const runState = getDocumentProcessingRunState(input.document);
  const completedSteps = new Set(runState?.completedSteps ?? []);
  const extractingByProgress =
    completedSteps.has("extract_fields") ||
    completedSteps.has("merge_results") ||
    completedSteps.has("analyze_risks") ||
    completedSteps.has("generate_summary");

  if (isParsingJob(activeJobType) || (!activeJobType && !extractingByProgress)) {
    return {
      state: "parsing" as const,
      label: "Parsing",
      detail: "Reading and structuring the document.",
      reviewCount,
      activeJobType
    };
  }

  return {
    state: "extracting" as const,
    label: "Extracting",
    detail: "Extracting terms, risks, and summary data.",
    reviewCount,
    activeJobType
  };
}
