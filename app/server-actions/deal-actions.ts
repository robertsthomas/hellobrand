"use server";

/**
 * Deal server action entrypoint.
 * This file keeps the public action exports stable while the implementations live in smaller deal action modules.
 */

export {
  createDealAction,
  uploadDocumentsAction,
  reprocessDocumentAction,
  saveDealMetaAction,
  saveTermsAction,
  saveDealNotesAction,
  confirmTermsReviewAction,
  generateDraftAction
} from "./deal-workspace-actions";
export {
  activateSummaryVariantAction,
  restoreSummaryVersionAction,
  applyPendingChangesAction,
  dismissPendingChangesAction,
  updateDeliverablesAction
} from "./deal-summary-actions";
export {
  deleteWorkspaceAction,
  deleteWorkspaceConfirmedAction,
  archiveDealAction,
  unarchiveDealAction
} from "./deal-lifecycle-actions";
export {
  generateInvoiceDraftAction,
  regenerateInvoiceDraftAction,
  saveInvoiceDraftAction,
  finalizeInvoiceAction,
  voidInvoiceAction,
  deleteInvoiceAction
} from "./deal-invoice-actions";
