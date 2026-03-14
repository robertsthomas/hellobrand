import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getIntakeSessionForViewer, updateIntakeDraftForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { startServerDebug } from "@/lib/server-debug";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const debug = startServerDebug("api_intake_get", {
    method: _request.method,
    path: `/api/intake/${sessionId}`,
    sessionId
  });

  try {
    const viewer = await requireApiViewer();
    const payload = await getIntakeSessionForViewer(viewer, sessionId);
    debug.complete({
      viewerId: viewer.id,
      status: payload.session.status,
      dealId: payload.session.dealId
    });
    return ok(payload);
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not load intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 404);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const debug = startServerDebug("api_intake_patch", {
    method: request.method,
    path: `/api/intake/${sessionId}`,
    sessionId
  });

  try {
    const viewer = await requireApiViewer();
    const body = await request.json();
    const session = await updateIntakeDraftForViewer(viewer, sessionId, {
      brandName:
        typeof body.brandName === "string" ? String(body.brandName) : null,
      campaignName:
        typeof body.campaignName === "string" ? String(body.campaignName) : null,
      notes: typeof body.notes === "string" ? String(body.notes) : null,
      pastedText:
        typeof body.pastedText === "string" ? String(body.pastedText) : null,
      inputSource:
        body.inputSource === "upload" ||
        body.inputSource === "paste" ||
        body.inputSource === "mixed"
          ? body.inputSource
          : null
    });

    debug.complete({
      viewerId: viewer.id,
      status: session.status,
      inputSource: session.inputSource
    });

    return ok({ session });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not update intake draft.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
