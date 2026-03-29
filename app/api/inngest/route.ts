import { serve } from "inngest/next";

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
  workspaceReminderSweepFunction
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processContractFunction,
    checkWorkspaceDuplicatesFunction,
    notificationEmailSendFunction,
    invoiceReminderSweepFunction,
    workspaceReminderSweepFunction,
    emailInitialSyncFunction,
    emailIncrementalSyncFunction,
    emailRenewalSweepFunction,
    emailActionItemDeadlineCheckFunction,
    emailPaymentOverdueCheckFunction
  ]
});
