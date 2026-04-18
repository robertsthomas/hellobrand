/**
 * Thin barrel re-exporting all deal domain functions.
 * New code should import from the specific submodule when possible,
 * but this file keeps the existing `@/lib/deals` import path stable.
 */
export { mergeTerms } from "./deals/shared";

export {
  listDealsForViewer,
  listDealAggregatesForViewer,
  listDocumentsForViewer,
  getDealForViewer,
  createDealForViewer,
  updateDealForViewer,
  deleteDealForViewer,
  activateSummaryVariantForViewer,
  saveGeneratedBriefSummaryForViewer,
} from "./deals/service";

export {
  enqueueDocumentProcessing,
  registerDirectDocumentUploadsForViewer,
  completeDirectDocumentUploadsForViewer,
  uploadDocumentsForViewer,
  reprocessDocumentForViewer,
} from "./deals/documents";

export {
  updateTermsForViewer,
  confirmTermsFieldForViewer,
  updateDealNotesForViewer,
} from "./deals/terms";

export {
  applyPendingChangesForViewer,
  dismissPendingChangesForViewer,
} from "./deals/pending-changes";
