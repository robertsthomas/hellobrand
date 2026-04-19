import * as Sentry from "@sentry/nextjs";
import { waitForLaunchDarkly, isLaunchDarklyConfigured } from "@/lib/launchdarkly";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    if (isLaunchDarklyConfigured()) {
      await waitForLaunchDarkly();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
