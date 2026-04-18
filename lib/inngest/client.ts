import { Inngest } from "inngest";

import { sanitizeInngestUrlEnv } from "@/lib/inngest/env";

sanitizeInngestUrlEnv();

export const inngest = new Inngest({
  id: "hellobrand",
  eventKey: process.env.INNGEST_EVENT_KEY
});
