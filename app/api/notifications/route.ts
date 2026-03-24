import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import {
  clearAllNotificationsForViewer,
  listNotificationsForViewer,
  markAllNotificationsReadForViewer
} from "@/lib/notification-service";

function isTruthy(value: string | null) {
  return value === "1" || value === "true";
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get("limit") ?? "50");
    const response = await listNotificationsForViewer(viewer, {
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
      includeRead: !isTruthy(searchParams.get("unreadOnly")),
      includeCleared: isTruthy(searchParams.get("includeCleared")),
      includeSuperseded: isTruthy(searchParams.get("includeSuperseded"))
    });

    return ok(response);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not load notifications.",
      400
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "mark_all_read") {
      await markAllNotificationsReadForViewer(viewer);
      return ok({ ok: true });
    }

    if (action === "clear_all") {
      await clearAllNotificationsForViewer(viewer);
      return ok({ ok: true });
    }

    return fail("Unsupported notification action.", 400);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update notifications.",
      400
    );
  }
}

export async function DELETE() {
  try {
    const viewer = await requireApiViewer();
    await clearAllNotificationsForViewer(viewer);
    return ok({ ok: true });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not clear notifications.",
      400
    );
  }
}
