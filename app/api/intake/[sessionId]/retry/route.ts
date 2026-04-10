/**
 * This route handles intake HTTP requests.
 * It connects session, draft, batch, and document requests to the intake workflow code in `lib/intake` and related helpers.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { retryIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const debug = startServerDebug("api_intake_retry", {
    method: _request.method,
    path: `/api/intake/${sessionId}/retry`,
    sessionId
  });

  try {
    const viewer = await requireApiViewer();
    const session = await retryIntakeSessionForViewer(viewer, sessionId);
    debug.complete({
      viewerId: viewer.id,
      status: session.status
    });
    return ok({ session });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not retry intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
