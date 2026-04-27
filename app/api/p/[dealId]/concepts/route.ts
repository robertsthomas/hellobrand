/**
 * API route for concept generation within a deal workspace.
 * Supports generating new concepts, variations, favoriting, and inline editing.
 * All endpoints validate viewer ownership of the target deal.
 */
import { NextRequest } from "next/server";

import { conceptGenerationEnabled } from "@/flags";
import { requireApiViewer } from "@/lib/auth";
import {
  assertViewerHasFeature,
  assertViewerWithinUsageLimit,
  EntitlementFeatureError,
  EntitlementUsageError,
  recordViewerUsage,
} from "@/lib/billing/entitlements";
import { getDealForViewer } from "@/lib/deals/service";
import {
  generateConceptsForDeliverable,
  generateConceptVariations,
  listConceptsForDeal,
  toggleConceptFavorite,
  updateConcept,
} from "@/lib/concepts/service";
import { fail, ok } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    if (!(await conceptGenerationEnabled())) {
      return fail("Concept generation is unavailable.", 404);
    }

    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "concept_generation");
    const { dealId } = await params;
    if (!(await getDealForViewer(viewer, dealId))) {
      return fail("Deal not found.", 404);
    }

    const concepts = await listConceptsForDeal(dealId);
    return ok({ concepts });
  } catch (error) {
    if (error instanceof EntitlementFeatureError) {
      return fail(error.message, 403);
    }
    return fail("Failed to list concepts.", 500, { error, area: "concepts", name: "list" });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    if (!(await conceptGenerationEnabled())) {
      return fail("Concept generation is unavailable.", 404);
    }

    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "concept_generation");
    await assertViewerWithinUsageLimit(viewer, "concept_generations_monthly");

    const { dealId } = await params;
    if (!(await getDealForViewer(viewer, dealId))) {
      return fail("Deal not found.", 404);
    }

    const body = (await request.json().catch(() => null)) as {
      mode?: string;
      deliverableIndex?: number;
      parentConceptId?: string;
    } | null;
    const mode = body?.mode === "variations" ? "variations" : "generate";
    const deliverableIndex = body?.deliverableIndex ?? 0;
    const parentConceptId = body?.parentConceptId;

    if (mode === "variations" && !parentConceptId) {
      return fail("parentConceptId is required for variations.", 400);
    }

    const result =
      mode === "variations"
        ? await generateConceptVariations(viewer, dealId, deliverableIndex, parentConceptId!)
        : await generateConceptsForDeliverable(viewer, dealId, deliverableIndex);

    await recordViewerUsage(viewer, "concept_generations_monthly");
    return ok(result);
  } catch (error) {
    if (error instanceof EntitlementFeatureError) {
      return fail(error.message, 403);
    }
    if (error instanceof EntitlementUsageError) {
      return fail(error.message, 429);
    }
    return fail("Concept generation failed.", 500, { error, area: "concepts", name: "generate" });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    if (!(await conceptGenerationEnabled())) {
      return fail("Concept generation is unavailable.", 404);
    }

    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "concept_generation");
    const { dealId } = await params;
    if (!(await getDealForViewer(viewer, dealId))) {
      return fail("Deal not found.", 404);
    }

    const body = (await request.json().catch(() => null)) as {
      conceptId?: string;
      isFavorite?: boolean;
      patch?: Record<string, string>;
    } | null;

    const conceptId = body?.conceptId;
    if (!conceptId) {
      return fail("Missing conceptId.", 400);
    }

    if (typeof body?.isFavorite === "boolean") {
      const updated = await toggleConceptFavorite(viewer, conceptId, dealId, body.isFavorite);
      return ok({ concept: updated });
    }

    if (body?.patch) {
      const updated = await updateConcept(viewer, dealId, conceptId, body.patch);
      return ok({ concept: updated });
    }

    return fail("No update specified.", 400);
  } catch (error) {
    if (error instanceof EntitlementFeatureError) {
      return fail(error.message, 403);
    }
    if (error instanceof EntitlementUsageError) {
      return fail(error.message, 429);
    }
    if (error instanceof Error && error.message === "Concept not found.") {
      return fail(error.message, 404);
    }
    return fail("Concept update failed.", 500, { error, area: "concepts", name: "update" });
  }
}
