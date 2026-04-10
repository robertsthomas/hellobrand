/**
 * This route handles authenticated workspace HTTP requests.
 * It connects partnership reads, writes, and document operations to the shared deal and document domain code.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getDealForViewer, updateDealForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";
import { updateDealSchema } from "@/lib/validation";

export async function GET(
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

    return ok({ deal: aggregate.deal });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { dealId } = await params;
    const input = updateDealSchema.parse(await request.json());
    const deal = await updateDealForViewer(viewer, dealId, input);

    if (!deal) {
      return fail("Deal not found.", 404);
    }

    return ok({ deal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update deal.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
