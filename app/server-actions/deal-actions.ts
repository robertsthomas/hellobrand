/**
 * Deal server action entrypoint.
 * This file keeps the public action exports stable while the implementations live in smaller deal action modules.
 */

export {
  reprocessDocumentAction,
  saveTermsAction,
  saveDealNotesAction,
  confirmTermsReviewAction,
} from "./deal-workspace-actions";
export {
  activateSummaryVariantAction,
  applyPendingChangesAction,
  dismissPendingChangesAction,
  updateDeliverablesAction,
} from "./deal-summary-actions";
export {
  deleteWorkspaceConfirmedAction,
  archiveDealAction,
  unarchiveDealAction,
} from "./deal-lifecycle-actions";
export {
  generateInvoiceDraftAction,
  regenerateInvoiceDraftAction,
  saveInvoiceDraftAction,
  finalizeInvoiceAction,
  voidInvoiceAction,
  deleteInvoiceAction,
} from "./deal-invoice-actions";
