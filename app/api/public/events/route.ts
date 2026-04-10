/**
 * This route handles public event tracking and anonymous upload HTTP requests.
 * It keeps the public request boundary here and relies on the anonymous analysis modules for throttling, analysis, and claim behavior.
 */
import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { logPublicFunnelEvent } from "@/lib/public-funnel-events";
import { capturePostHogServerEvent, resolvePostHogDistinctId } from "@/lib/posthog/server";
import { publicFunnelEventSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const payload = publicFunnelEventSchema.parse(await request.json());
    await logPublicFunnelEvent(payload.name, payload.payload);
    await capturePostHogServerEvent({
      distinctId: resolvePostHogDistinctId({
        distinctId: payload.distinctId,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: request.headers.get("user-agent")
      }),
      event: payload.name,
      properties: {
        ...payload.payload,
        $current_url:
          payload.currentUrl ?? request.headers.get("referer") ?? undefined,
        source: "public_funnel"
      }
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not record event.");
  }
}
