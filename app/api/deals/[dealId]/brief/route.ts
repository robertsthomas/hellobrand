import { NextRequest } from "next/server";

import { buildFallbackBrief } from "@/lib/analysis/fallback";
import { generateBriefWithLlm, hasLlmKey } from "@/lib/analysis/llm";
import { requireApiViewer } from "@/lib/auth";
import {
  assertViewerHasFeature,
  assertViewerWithinUsageLimit,
  recordViewerUsage
} from "@/lib/billing/entitlements";
import { getDealForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "brief_generation");
    await assertViewerWithinUsageLimit(viewer, "brief_generations_monthly");
    const { dealId } = await params;
    const aggregate = await getDealForViewer(viewer, dealId);

    if (!aggregate) {
      return fail("Deal not found.", 404);
    }

    const brief = hasLlmKey()
      ? await generateBriefWithLlm(aggregate)
      : buildFallbackBrief(aggregate);
    await recordViewerUsage(viewer, "brief_generations_monthly");

    return ok({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate brief.";
    return fail(message, message === "Unauthorized" ? 401 : 500);
  }
}
