import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { listInboxThreadsForViewer } from "@/lib/email/service";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { searchParams } = new URL(request.url);
    const threads = await listInboxThreadsForViewer(viewer, {
      query: searchParams.get("q"),
      provider: searchParams.get("provider"),
      accountId: searchParams.get("accountId"),
      linkedDealId: searchParams.get("dealId"),
      linkedOnly: searchParams.get("linkedOnly") === "1",
      workflowState: searchParams.get("workflowState") as
        | "unlinked"
        | "needs_review"
        | "needs_reply"
        | "draft_ready"
        | "waiting_on_them"
        | "closed"
        | null,
      limit: Number(searchParams.get("limit") ?? 100)
    });

    return ok({ threads });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load email threads.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
