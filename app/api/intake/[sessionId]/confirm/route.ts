import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { confirmIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { confirmIntakeSessionSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { sessionId } = await params;
    const body = await request.json();
    const input = confirmIntakeSessionSchema.parse(body);
    const aggregate = await confirmIntakeSessionForViewer(viewer, sessionId, input);
    return ok({ deal: aggregate?.deal });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not confirm intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
