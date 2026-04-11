"use server";

/**
 * Intake server action entrypoint.
 * This file keeps the public intake action exports stable while the implementations live in focused session and batch modules.
 */

export {
  startIntakeAction,
  retryIntakeSessionAction,
  deleteIntakeDraftAction,
  confirmIntakeSessionAction
} from "./intake-session-actions";
export {
  startBulkIntakeAction,
  confirmBatchGroupAction,
  reassignDocumentAction
} from "./intake-batch-actions";
