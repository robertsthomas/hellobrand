import { documentProcessingFunction } from "@/lib/inngest/document-functions";
import {
  emailActionItemDeadlineCheckFunction,
  emailIncrementalSyncFunction,
  emailInitialSyncFunction,
  emailPaymentOverdueCheckFunction,
  emailRenewalSweepFunction,
} from "@/lib/inngest/email-functions";
import {
  invoiceReminderSweepFunction,
  noDocumentsUploadedSweepFunction,
  notificationEmailSendFunction,
  resendAudienceContactSyncFunction,
  workspaceNudgeSweepFunction,
  workspaceReminderSweepFunction,
} from "@/lib/inngest/functions";

export const inngestFunctions = [
  documentProcessingFunction,
  resendAudienceContactSyncFunction,
  notificationEmailSendFunction,
  invoiceReminderSweepFunction,
  workspaceReminderSweepFunction,
  workspaceNudgeSweepFunction,
  noDocumentsUploadedSweepFunction,
  emailInitialSyncFunction,
  emailIncrementalSyncFunction,
  emailRenewalSweepFunction,
  emailActionItemDeadlineCheckFunction,
  emailPaymentOverdueCheckFunction,
];
