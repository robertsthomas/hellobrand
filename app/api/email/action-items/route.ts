/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { listEmailActionItemsForUser } from "@/lib/email/repository";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const status = request.nextUrl.searchParams.get("status") ?? "pending";
    const items = await listEmailActionItemsForUser(viewer.id, status);
    return ok({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list action items.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
