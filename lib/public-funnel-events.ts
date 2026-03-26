import { publicFunnelEventNames, publicFunnelEventSchema } from "@/lib/validation";

export type PublicFunnelEventName = (typeof publicFunnelEventNames)[number];

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

  const body = JSON.stringify(
    publicFunnelEventSchema.parse({
      name,
      payload
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
