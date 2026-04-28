/**
 * Deal server action entrypoint.
 * This file keeps the public action exports stable while the implementations live in smaller deal action modules.
 */

export {
  deleteInvoiceAction,
  finalizeInvoiceAction,
  generateInvoiceDraftAction,
  regenerateInvoiceDraftAction,
  saveInvoiceDraftAction,
  voidInvoiceAction,
} from "./deal-invoice-actions";
export {
  archiveDealAction,
  deleteWorkspaceConfirmedAction,
  unarchiveDealAction,
} from "./deal-lifecycle-actions";
export {
  activateSummaryVariantAction,
  applyPendingChangesAction,
  dismissPendingChangesAction,
  updateDeliverablesAction,
} from "./deal-summary-actions";
export {
  confirmTermsReviewAction,
  reprocessDocumentAction,
  saveDealNotesAction,
  saveTermsAction,
  sendForESignatureAction,
} from "./deal-workspace-actions";
