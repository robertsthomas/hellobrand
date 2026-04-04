import { serve } from "inngest/next";

import { getDocumentProcessingBackend } from "@/lib/document-processing";
import { inngest } from "@/lib/inngest/client";
import {
  emailActionItemDeadlineCheckFunction,
  emailIncrementalSyncFunction,
  emailInitialSyncFunction,
  emailPaymentOverdueCheckFunction,
  emailRenewalSweepFunction
} from "@/lib/inngest/email-functions";
import {
  checkWorkspaceDuplicatesFunction,
  invoiceReminderSweepFunction,
  notificationEmailSendFunction,
  processContractFunction,
  workspaceNudgeSweepFunction,
  workspaceReminderSweepFunction
} from "@/lib/inngest/functions";

const documentProcessingBackend = getDocumentProcessingBackend();

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ...(documentProcessingBackend === "inngest" ? [processContractFunction] : []),
    checkWorkspaceDuplicatesFunction,
    notificationEmailSendFunction,
    invoiceReminderSweepFunction,
    workspaceReminderSweepFunction,
    workspaceNudgeSweepFunction,
    emailInitialSyncFunction,
    emailIncrementalSyncFunction,
    emailRenewalSweepFunction,
    emailActionItemDeadlineCheckFunction,
    emailPaymentOverdueCheckFunction
  ]
});
