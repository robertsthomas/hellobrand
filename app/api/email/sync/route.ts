import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { syncConnectedInboxAccountsForViewer } from "@/lib/email/service";
import { fail, ok } from "@/lib/http";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const force = new URL(request.url).searchParams.get("force") === "1";
    const result = await syncConnectedInboxAccountsForViewer(viewer, { force });
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync email accounts.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
