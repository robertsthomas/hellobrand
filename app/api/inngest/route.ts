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
  invoiceReminderSweepFunction,
  notificationEmailSendFunction,
  workspaceNudgeSweepFunction,
  workspaceReminderSweepFunction
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
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
