/**
 * This route handles Inngest callbacks and function execution requests.
 * It keeps the request boundary here while the workflow behavior itself stays in the Inngest and domain modules.
 */
import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
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
  workspaceNudgeSweepFunction,
  workspaceReminderSweepFunction,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    documentProcessingFunction,
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
  ],
});
