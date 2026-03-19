import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { startQueuedIntakeAnalysisForViewer } from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(request: NextRequest) {
  const debug = startServerDebug("api_intake_queue_start", {
    method: request.method,
    path: "/api/intake/queue/start"
  });

  try {
    const viewer = await requireApiViewer();
    const body = await request.json().catch(() => ({}));
    const sessionIds = Array.isArray(body.sessionIds)
      ? body.sessionIds.filter(
          (value: unknown): value is string => typeof value === "string"
        )
      : undefined;

    const session = await startQueuedIntakeAnalysisForViewer(viewer, {
      sessionIds
    });

    debug.complete({
      viewerId: viewer.id,
      sessionId: session.id
    });

    return ok({ session }, { status: 200 });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not start queued analysis.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
