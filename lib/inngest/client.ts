import { Inngest } from "inngest";

import { sanitizeInngestUrlEnv } from "@/lib/inngest/env";
import { logOutboundNetworkDiagnostics, normalizeUrl } from "@/lib/network/env-diagnostics";

sanitizeInngestUrlEnv();
logOutboundNetworkDiagnostics({
  service: "inngest",
  urlEnvVars: [
    "INNGEST_BASE_URL",
    "INNGEST_API_BASE_URL",
    "INNGEST_EVENT_API_BASE_URL",
    "INNGEST_DEVSERVER_URL",
  ],
  effectiveHosts: {
    api: normalizeUrl(process.env.INNGEST_API_BASE_URL || process.env.INNGEST_BASE_URL)?.hostname ??
      "api.inngest.com",
    events:
      normalizeUrl(process.env.INNGEST_EVENT_API_BASE_URL || process.env.INNGEST_BASE_URL)?.hostname ??
      "inn.gs",
  },
  extras: {
    inngestDev: process.env.INNGEST_DEV?.trim() || null,
  },
});

export const inngest = new Inngest({
  id: "hellobrand",
  eventKey: process.env.INNGEST_EVENT_KEY
});
