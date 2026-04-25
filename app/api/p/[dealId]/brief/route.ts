/**
 * This route handles authenticated workspace HTTP requests.
 * It connects partnership reads, writes, and document operations to the shared deal and document domain code.
 */
import { NextRequest } from "next/server";

import { buildFallbackBrief } from "@/lib/analysis/fallback";
import { generateBriefWithLlm, hasLlmKey } from "@/lib/analysis/llm";
import { requireApiViewer } from "@/lib/auth";
import {
  assertViewerHasFeature,
  assertViewerWithinUsageLimit,
  recordViewerUsage,
} from "@/lib/billing/entitlements";
import { getDealForViewer, saveGeneratedBriefSummaryForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";

export async function POST(
  request: NextRequest,
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

    const body = (await request.json().catch(() => null)) as { mode?: string } | null;
    const mode = body?.mode === "summary" ? "summary" : "brief";
    const generatedBrief = hasLlmKey()
      ? await generateBriefWithLlm(aggregate, { mode })
      : buildFallbackBrief(aggregate);
    const fallbackBrief = buildFallbackBrief(aggregate);
    const brief =
      Array.isArray(generatedBrief.sections) && generatedBrief.sections.length > 0
        ? generatedBrief
        : fallbackBrief;

    if (mode === "summary" && aggregate.terms?.briefData) {
      await saveGeneratedBriefSummaryForViewer(viewer, dealId, brief);
    }

    await recordViewerUsage(viewer, "brief_generations_monthly");

    return ok({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate brief.";
    if (message === "Unauthorized") {
      return fail(message, 401);
    }

    return fail("Could not generate brief. Try again in a moment.", 500, {
      error,
      area: "brief",
      name: "generate",
    });
  }
}
