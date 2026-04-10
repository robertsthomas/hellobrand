/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { listDealEmailCandidatesForViewer } from "@/lib/email/service";

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const candidates = await listDealEmailCandidatesForViewer(viewer);
    return ok({ candidates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load email candidates.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
