import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { discoverDealEmailCandidatesForViewer } from "@/lib/email/service";

export async function POST() {
  try {
    const viewer = await requireApiViewer();
    const candidates = await discoverDealEmailCandidatesForViewer(viewer);
    return ok({ candidates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not discover deal email candidates.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
