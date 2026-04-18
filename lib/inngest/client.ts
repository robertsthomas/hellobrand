import { Inngest } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";

import { sanitizeInngestUrlEnv } from "@/lib/inngest/env";

sanitizeInngestUrlEnv();

export const inngest = new Inngest({
  id: "hellobrand",
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: process.env.NODE_ENV !== "production",
  checkpointing: {
    maxRuntime: "240s",
  },
  middleware: [sentryMiddleware()],
});
