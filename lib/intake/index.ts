/**
 * Compatibility barrel for intake workflows.
 * Intake is now split by workflow stage so callers can keep this import path while the internals stay organized.
 */
export {
  createIntakeSessionForViewer,
  appendDocumentsToIntakeSessionForViewer,
  registerDirectDocumentsToIntakeSessionForViewer,
  completeDirectDocumentsToIntakeSessionForViewer
} from "./sessions";

export {
  createDraftIntakeSessionForViewer,
  updateIntakeDraftForViewer,
  listIntakeDraftsForViewer,
  deleteIntakeDraftForViewer
} from "./drafts";

export {
  getIntakeSessionForViewer,
  startQueuedIntakeAnalysisForViewer,
  retryIntakeSessionForViewer,
  confirmIntakeSessionForViewer
} from "./review";

export {
  createBulkIntakeForViewer,
  getBatchForViewer,
  confirmBatchGroupForViewer,
  reassignDocumentInBatch
} from "./batch";
