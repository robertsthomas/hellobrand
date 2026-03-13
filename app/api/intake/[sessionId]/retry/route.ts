import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { retryIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { sessionId } = await params;
    const session = await retryIntakeSessionForViewer(viewer, sessionId);
    return ok({ session });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not retry intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
