import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getDealForViewer, updateTermsForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";
import { dealTermsInputSchema } from "@/lib/validation";

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

    return ok({ report: aggregate });
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
    const aggregate = await getDealForViewer(viewer, dealId);

    if (!aggregate) {
      return fail("Deal not found.", 404);
    }

    const body = await request.json();
    const input = dealTermsInputSchema.parse({
      brandName: body.brandName ?? aggregate.terms?.brandName ?? null,
      agencyName: body.agencyName ?? aggregate.terms?.agencyName ?? null,
      creatorName: body.creatorName ?? aggregate.terms?.creatorName ?? null,
      campaignName: body.campaignName ?? aggregate.terms?.campaignName ?? null,
      paymentAmount: body.paymentAmount ?? aggregate.terms?.paymentAmount ?? null,
      currency: body.currency ?? aggregate.terms?.currency ?? null,
      paymentTerms: body.paymentTerms ?? aggregate.terms?.paymentTerms ?? null,
      paymentStructure:
        body.paymentStructure ?? aggregate.terms?.paymentStructure ?? null,
      netTermsDays: body.netTermsDays ?? aggregate.terms?.netTermsDays ?? null,
      paymentTrigger: body.paymentTrigger ?? aggregate.terms?.paymentTrigger ?? null,
      deliverables: body.deliverables ?? aggregate.terms?.deliverables ?? [],
      usageRights: body.usageRights ?? aggregate.terms?.usageRights ?? null,
      usageRightsOrganicAllowed:
        body.usageRightsOrganicAllowed ??
        aggregate.terms?.usageRightsOrganicAllowed ??
        null,
      usageRightsPaidAllowed:
        body.usageRightsPaidAllowed ??
        aggregate.terms?.usageRightsPaidAllowed ??
        null,
      whitelistingAllowed:
        body.whitelistingAllowed ?? aggregate.terms?.whitelistingAllowed ?? null,
      usageDuration: body.usageDuration ?? aggregate.terms?.usageDuration ?? null,
      usageTerritory:
        body.usageTerritory ?? aggregate.terms?.usageTerritory ?? null,
      usageChannels: body.usageChannels ?? aggregate.terms?.usageChannels ?? [],
      exclusivity: body.exclusivity ?? aggregate.terms?.exclusivity ?? null,
      exclusivityApplies:
        body.exclusivityApplies ?? aggregate.terms?.exclusivityApplies ?? null,
      exclusivityCategory:
        body.exclusivityCategory ?? aggregate.terms?.exclusivityCategory ?? null,
      exclusivityDuration:
        body.exclusivityDuration ?? aggregate.terms?.exclusivityDuration ?? null,
      exclusivityRestrictions:
        body.exclusivityRestrictions ??
        aggregate.terms?.exclusivityRestrictions ??
        null,
      revisions: body.revisions ?? aggregate.terms?.revisions ?? null,
      revisionRounds: body.revisionRounds ?? aggregate.terms?.revisionRounds ?? null,
      termination: body.termination ?? aggregate.terms?.termination ?? null,
      terminationAllowed:
        body.terminationAllowed ?? aggregate.terms?.terminationAllowed ?? null,
      terminationNotice:
        body.terminationNotice ?? aggregate.terms?.terminationNotice ?? null,
      terminationConditions:
        body.terminationConditions ??
        aggregate.terms?.terminationConditions ??
        null,
      governingLaw: body.governingLaw ?? aggregate.terms?.governingLaw ?? null,
      notes: body.notes ?? aggregate.terms?.notes ?? null
    });
    const terms = await updateTermsForViewer(viewer, dealId, input);

    if (!terms) {
      return fail("Deal not found.", 404);
    }

    const nextAggregate = await getDealForViewer(viewer, dealId);
    return ok({ report: nextAggregate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save report.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
