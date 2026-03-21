import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { reviewDealEmailCandidatesForViewer } from "@/lib/email/service";

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const body = (await request.json()) as {
      confirmIds?: string[];
      rejectIds?: string[];
    };

    const result = await reviewDealEmailCandidatesForViewer(viewer, {
      confirmIds: Array.isArray(body.confirmIds) ? body.confirmIds : [],
      rejectIds: Array.isArray(body.rejectIds) ? body.rejectIds : []
    });

    return ok(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not review deal email candidates.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
