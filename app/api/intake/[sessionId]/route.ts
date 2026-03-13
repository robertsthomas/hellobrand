import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { sessionId } = await params;
    const payload = await getIntakeSessionForViewer(viewer, sessionId);
    return ok(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 404);
  }
}
