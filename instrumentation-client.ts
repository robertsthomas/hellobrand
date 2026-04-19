import * as Sentry from "@sentry/nextjs";

const isDevelopment = process.env.NODE_ENV === "development";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const isLocalAppUrl =
  appUrl.startsWith("http://localhost") ||
  appUrl.startsWith("http://127.0.0.1");
const isSentryEnabled =
  !isDevelopment &&
  !isLocalAppUrl &&
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT !== "development" &&
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT !== "dev";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isSentryEnabled,
  sendDefaultPii: true,
  tracesSampleRate: isDevelopment ? 1 : 0.1,
  replaysSessionSampleRate: isDevelopment ? 1 : 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.replayIntegration()]
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
