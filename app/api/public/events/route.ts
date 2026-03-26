import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { logPublicFunnelEvent } from "@/lib/public-funnel-events";
import { publicFunnelEventSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const payload = publicFunnelEventSchema.parse(await request.json());
    await logPublicFunnelEvent(payload.name, payload.payload);
    return ok({ success: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not record event.");
  }
}
