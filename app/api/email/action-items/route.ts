import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { listEmailActionItemsForUser } from "@/lib/email/repository";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const status = request.nextUrl.searchParams.get("status") ?? "pending";
    const items = await listEmailActionItemsForUser(viewer.id, status);
    return ok({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list action items.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
