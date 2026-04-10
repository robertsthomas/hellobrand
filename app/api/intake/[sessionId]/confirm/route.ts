/**
 * This route handles intake HTTP requests.
 * It connects session, draft, batch, and document requests to the intake workflow code in `lib/intake` and related helpers.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { confirmIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { startServerDebug } from "@/lib/server-debug";
import { confirmIntakeSessionSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const debug = startServerDebug("api_intake_confirm", {
    method: request.method,
    path: `/api/intake/${sessionId}/confirm`,
    sessionId
  });

  try {
    const viewer = await requireApiViewer();
    const body = await request.json();
    const input = confirmIntakeSessionSchema.parse(body);
    const aggregate = await confirmIntakeSessionForViewer(viewer, sessionId, input);
    debug.complete({
      viewerId: viewer.id,
      dealId: aggregate?.deal.id ?? null
    });
    return ok({ deal: aggregate?.deal });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not confirm intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
