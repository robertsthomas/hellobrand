import * as Sentry from "@sentry/nextjs";

const isDevelopment = process.env.NODE_ENV === "development";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const isLocalAppUrl =
  appUrl.startsWith("http://localhost") ||
  appUrl.startsWith("http://127.0.0.1");
const isSentryEnabled =
  !isDevelopment &&
  !isLocalAppUrl &&
  process.env.SENTRY_ENVIRONMENT !== "development" &&
  process.env.SENTRY_ENVIRONMENT !== "dev" &&
  process.env.VERCEL_ENV !== "development" &&
  process.env.DOPPLER_CONFIG !== "dev" &&
  process.env.DOPPLER_ENVIRONMENT !== "dev";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isSentryEnabled,
  sendDefaultPii: true,
  tracesSampleRate: isDevelopment ? 1 : 0.1,
  includeLocalVariables: true,
  integrations: [
    Sentry.openAIIntegration({
      recordInputs: true,
      recordOutputs: true
    }),
    Sentry.vercelAIIntegration({
      force: true,
      recordInputs: true,
      recordOutputs: true
    })
  ]
});
