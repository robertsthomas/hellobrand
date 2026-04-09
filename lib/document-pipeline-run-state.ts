import type {
  DocumentProcessingRunState,
  DocumentRecord,
  JobType
} from "@/lib/types";

export const DOCUMENT_PIPELINE_STEPS: JobType[] = [
  "extract_text",
  "classify_document",
  "section_document",
  "extract_fields",
  "merge_results",
  "analyze_risks",
  "generate_summary"
];

export function createDocumentProcessingRunState(runId: string): DocumentProcessingRunState {
  return {
    runId,
    completedSteps: [],
    stepCompletedAt: {},
    failedStep: null,
    failedAt: null,
    lastError: null
  };
}

export function getDocumentProcessingRunState(
  document: Pick<DocumentRecord, "processingRunId" | "processingRunStateJson">
): DocumentProcessingRunState | null {
  if (!document.processingRunId) {
    return null;
  }

  const state = document.processingRunStateJson;
  if (!state || state.runId !== document.processingRunId) {
    return createDocumentProcessingRunState(document.processingRunId);
  }

  return {
    runId: state.runId,
    completedSteps: Array.isArray(state.completedSteps)
      ? state.completedSteps.filter((step): step is JobType =>
          DOCUMENT_PIPELINE_STEPS.includes(step as JobType)
        )
      : [],
    stepCompletedAt: state.stepCompletedAt ?? {},
    failedStep: state.failedStep ?? null,
    failedAt: state.failedAt ?? null,
    lastError: state.lastError ?? null
  };
}

export function isDocumentPipelineStepComplete(
  document: Pick<DocumentRecord, "processingRunId" | "processingRunStateJson">,
  runId: string,
  step: JobType
) {
  const state = getDocumentProcessingRunState(document);
  return state?.runId === runId && state.completedSteps.includes(step);
}

export function markDocumentPipelineStepComplete(
  state: DocumentProcessingRunState,
  step: JobType
): DocumentProcessingRunState {
  const completedSteps = state.completedSteps.includes(step)
    ? state.completedSteps
    : [...state.completedSteps, step];

  return {
    ...state,
    completedSteps,
    stepCompletedAt: {
      ...state.stepCompletedAt,
      [step]: new Date().toISOString()
    },
    failedStep: null,
    failedAt: null,
    lastError: null
  };
}

export function markDocumentPipelineRunFailed(
  state: DocumentProcessingRunState,
  input: { step: JobType | null; message: string }
): DocumentProcessingRunState {
  return {
    ...state,
    failedStep: input.step,
    failedAt: new Date().toISOString(),
    lastError: input.message
  };
}
