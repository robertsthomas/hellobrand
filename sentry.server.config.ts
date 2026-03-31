import * as Sentry from "@sentry/nextjs";

const isDevelopment = process.env.NODE_ENV === "development";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
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
