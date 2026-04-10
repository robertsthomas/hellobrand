/**
 * This route handles public event tracking and anonymous upload HTTP requests.
 * It keeps the public request boundary here and relies on the anonymous analysis modules for throttling, analysis, and claim behavior.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { claimAnonymousAnalysisSession } from "@/lib/public-anonymous-analysis";
import { logPublicFunnelEvent } from "@/lib/public-funnel-events";
import { publicAnonymousClaimSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const input = publicAnonymousClaimSchema.parse(await request.json());
    const claimed = await claimAnonymousAnalysisSession(viewer, input.analysisToken);

    revalidateTag(`user-${viewer.id}-deals`, "max");
    revalidateTag(`deal-${claimed.dealId}`, "max");
    revalidatePath("/app", "layout");

    await logPublicFunnelEvent("anonymous_claim_succeeded", {
      viewerId: viewer.id,
      dealId: claimed.dealId,
      alreadyClaimed: claimed.alreadyClaimed
    });

    return ok({
      dealId: claimed.dealId,
      href: claimed.href,
      alreadyClaimed: claimed.alreadyClaimed
    });
  } catch (error) {
    await logPublicFunnelEvent("anonymous_claim_failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });

    const message =
      error instanceof Error ? error.message : "Could not save this contract.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
