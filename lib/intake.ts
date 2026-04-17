/**
 * Thin barrel re-exporting all intake domain functions.
 * The full implementation lives in lib/intake/index.ts.
 * New code should import from the specific submodule when possible,
 * but this file keeps the existing `@/lib/intake` import path stable.
 */
export {
  createIntakeSessionForViewer,
  createDraftIntakeSessionForViewer,
  appendDocumentsToIntakeSessionForViewer,
  listIntakeDraftsForViewer,
  deleteIntakeDraftForViewer,
  getIntakeSessionForViewer,
  startQueuedIntakeAnalysisForViewer,
  retryIntakeSessionForViewer,
  confirmIntakeSessionForViewer,
  createBulkIntakeForViewer,
  getBatchForViewer,
  confirmBatchGroupForViewer,
  reassignDocumentInBatch,
} from "./intake/index";
