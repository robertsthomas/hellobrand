import * as Sentry from "@sentry/nextjs";
import { init } from "@launchdarkly/node-server-sdk";

let client: ReturnType<typeof init> | null = null;

function getSdkKey() {
  return process.env.LAUNCHDARKLY_SDK_KEY?.trim() || "";
}

export function isLaunchDarklyConfigured() {
  return getSdkKey().length > 0;
}

export function getLaunchDarklyClient() {
  if (!client) {
    const key = getSdkKey();
    if (!key) {
      return null;
    }
    client = init(key);
  }
  return client;
}

export async function waitForLaunchDarkly() {
  const c = getLaunchDarklyClient();
  if (!c) return;
  try {
    await c.waitForInitialization({ timeout: 5 });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { "monitoring.area": "launchdarkly", "monitoring.name": "init-timeout" },
    });
  }
}
