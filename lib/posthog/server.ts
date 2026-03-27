import "server-only";

import { createHash } from "crypto";
import { PostHog } from "posthog-node";

import { getPostHogServerHost, getPostHogServerKey } from "@/lib/posthog/config";

let posthogServerClient: PostHog | null = null;

function getPostHogServerClient() {
  if (posthogServerClient) {
    return posthogServerClient;
  }

  const apiKey = getPostHogServerKey();
  if (!apiKey) {
    return null;
  }

  posthogServerClient = new PostHog(apiKey, {
    host: getPostHogServerHost()
  });

  return posthogServerClient;
}

export function resolvePostHogDistinctId(input: {
  distinctId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const explicitDistinctId = input.distinctId?.trim();
  if (explicitDistinctId) {
    return explicitDistinctId;
  }

  const fingerprint = `${input.ip ?? "unknown"}|${input.userAgent ?? "unknown"}`;
  const hash = createHash("sha256").update(fingerprint).digest("hex").slice(0, 24);
  return `anon:${hash}`;
}

export async function capturePostHogServerEvent(input: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  const client = getPostHogServerClient();
  if (!client) {
    return false;
  }

  client.capture({
    distinctId: input.distinctId,
    event: input.event,
    properties: input.properties
  });

  await client.flush();
  return true;
}
