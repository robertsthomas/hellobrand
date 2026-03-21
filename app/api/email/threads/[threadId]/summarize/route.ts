import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { summarizeEmailThreadForViewer } from "@/lib/email/service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const summary = await summarizeEmailThreadForViewer(viewer, threadId);

    if (!summary) {
      return fail("Email thread not found.", 404);
    }

    return ok({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not summarize email thread.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
