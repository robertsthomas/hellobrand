/**
 * This route handles notification HTTP requests.
 * It accepts reads and updates here while notification generation and delivery stay in the notification domain modules.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { markNotificationStateForViewer } from "@/lib/notification-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (
      action !== "mark_read" &&
      action !== "mark_unread" &&
      action !== "clear"
    ) {
      return fail("Unsupported notification action.", 400);
    }

    const notification = await markNotificationStateForViewer(viewer, id, action);
    return ok({ notification });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update notification.",
      400
    );
  }
}
