import { NextRequest } from "next/server";

import { buildFallbackBrief } from "@/lib/analysis/fallback";
import { generateBriefWithLlm, hasLlmKey } from "@/lib/analysis/llm";
import { requireApiViewer } from "@/lib/auth";
import { getDealForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { dealId } = await params;
    const aggregate = await getDealForViewer(viewer, dealId);

    if (!aggregate) {
      return fail("Deal not found.", 404);
    }

    const brief = hasLlmKey()
      ? await generateBriefWithLlm(aggregate)
      : buildFallbackBrief(aggregate);

    return ok({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate brief.";
    return fail(message, message === "Unauthorized" ? 401 : 500);
  }
}
