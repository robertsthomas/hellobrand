import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { createDraftIntakeSessionForViewer } from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(request: NextRequest) {
  const debug = startServerDebug("api_intake_draft_create", {
    method: request.method,
    path: "/api/intake/draft"
  });

  try {
    const viewer = await requireApiViewer();
    const body = await request.json().catch(() => ({}));
    const session = await createDraftIntakeSessionForViewer(viewer, {
      brandName:
        typeof body.brandName === "string" ? String(body.brandName) : null,
      campaignName:
        typeof body.campaignName === "string" ? String(body.campaignName) : null,
      notes: typeof body.notes === "string" ? String(body.notes) : null
    });

    debug.complete({
      viewerId: viewer.id,
      sessionId: session.id
    });

    return ok({ session }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not create draft intake.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
