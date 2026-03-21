import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { updateEmailActionItemStatus } from "@/lib/email/repository";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ actionItemId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { actionItemId } = await params;
    const body = (await request.json()) as { status?: string };
    const validStatuses = ["pending", "completed", "dismissed"];

    if (!body.status || !validStatuses.includes(body.status)) {
      return fail("Invalid status. Must be pending, completed, or dismissed.", 400);
    }

    const updated = await updateEmailActionItemStatus(
      viewer.id,
      actionItemId,
      body.status as "pending" | "completed" | "dismissed"
    );

    if (!updated) {
      return fail("Action item not found.", 404);
    }

    return ok({ item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update action item.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
