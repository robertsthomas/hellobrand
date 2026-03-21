import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { listDealEmailCandidatesForViewer } from "@/lib/email/service";

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const candidates = await listDealEmailCandidatesForViewer(viewer);
    return ok({ candidates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load email candidates.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
