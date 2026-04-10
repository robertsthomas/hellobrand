/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { unlinkThreadFromDealForViewer } from "@/lib/email/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const body = (await request.json()) as { dealId?: string };

    if (!body.dealId) {
      return fail("Missing dealId.", 400);
    }

    const unlinked = await unlinkThreadFromDealForViewer(viewer, threadId, body.dealId);
    if (!unlinked) {
      return fail("Thread link not found.", 404);
    }

    return ok({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not unlink email thread.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
