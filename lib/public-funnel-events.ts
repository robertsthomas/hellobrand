import { isPostHogConfigured } from "@/lib/posthog/config";
import { publicFunnelEventNames, publicFunnelEventSchema } from "@/lib/validation";

export type PublicFunnelEventName = (typeof publicFunnelEventNames)[number];
type PostHogWindow = Window &
  typeof globalThis & {
    posthog?: {
      get_distinct_id?: () => string;
    };
  };

export async function logPublicFunnelEvent(
  name: PublicFunnelEventName,
  payload: Record<string, unknown> = {}
) {
  console.info("[public-funnel]", {
    name,
    payload,
    at: new Date().toISOString()
  });
}

export function trackPublicFunnelEvent(
  name: PublicFunnelEventName,
  payload: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  const posthog = (window as PostHogWindow).posthog;
  const distinctId =
    isPostHogConfigured() && typeof posthog?.get_distinct_id === "function"
      ? posthog.get_distinct_id()
      : null;

  const body = JSON.stringify(
    publicFunnelEventSchema.parse({
      name,
      payload,
      distinctId,
      currentUrl: window.location.href
    })
  );

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/public/events", blob);
    return;
  }

  void fetch("/api/public/events", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => undefined);
}
