import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import {
  emailIncrementalSyncFunction,
  emailInitialSyncFunction,
  emailRenewalSweepFunction
} from "@/lib/inngest/email-functions";
import { processContractFunction } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processContractFunction,
    emailInitialSyncFunction,
    emailIncrementalSyncFunction,
    emailRenewalSweepFunction
  ]
});
