import * as Sentry from "@sentry/nextjs";

const isDevelopment = process.env.NODE_ENV === "development";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: isDevelopment ? 1 : 0.1,
  replaysSessionSampleRate: isDevelopment ? 1 : 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.replayIntegration()]
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
