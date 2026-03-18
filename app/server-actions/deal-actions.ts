"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeDealCategory } from "@/lib/conflict-intelligence";
import { requireViewer } from "@/lib/auth";
import {
  applyPendingChangesForViewer,
  createDealForViewer as createDealFromDeals,
  deleteDealForViewer as deleteDealFromDeals,
  dismissPendingChangesForViewer,
  generateDraftForViewer as generateDraftFromDeals,
  reprocessDocumentForViewer as reprocessDocumentFromDeals,
  updateDealNotesForViewer as updateDealNotesFromDeals,
  updateDealForViewer as updateDealFromDeals,
  updateTermsForViewer as updateTermsFromDeals,
  uploadDocumentsForViewer as uploadDocumentsFromDeals
} from "@/lib/deals";
import { startServerDebug } from "@/lib/server-debug";
import {
  createDealSchema,
  dealTermsInputSchema,
  draftIntentSchema,
  updateDealSchema
} from "@/lib/validation";
import type { DraftIntent } from "@/lib/types";
import {
  parseNullableBoolean,
  parseNullableNumber,
  parseNullableString
} from "@/app/action-helpers";

export async function createDealAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = createDealSchema.parse({
    brandName: String(formData.get("brandName") ?? "").trim(),
    campaignName: String(formData.get("campaignName") ?? "").trim(),
    notes: parseNullableString(formData.get("notes"))
  });

  const deal = await createDealFromDeals(viewer, input);
  redirect(`/app/deals/${deal.id}`);
}

export async function uploadDocumentsAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const debug = startServerDebug("action_upload_documents", {
    action: "uploadDocumentsAction",
    dealId
  });

  const viewer = await requireViewer();
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  try {
    await uploadDocumentsFromDeals(viewer, dealId, {
      files,
      pastedText: parseNullableString(formData.get("pastedText"))
    });
    debug.complete({
      viewerId: viewer.id,
      fileCount: files.length,
      pastedChars: parseNullableString(formData.get("pastedText"))?.length ?? 0
    });
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id,
      fileCount: files.length
    });
    throw error;
  }

  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
  revalidatePath("/app/deals/history");
}

export async function reprocessDocumentAction(formData: FormData) {
  const viewer = await requireViewer();
  const documentId = String(formData.get("documentId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  await reprocessDocumentFromDeals(viewer, documentId);
  revalidatePath(`/app/deals/${dealId}`);
}

export async function saveDealMetaAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const input = updateDealSchema.parse({
    status: formData.get("status") || undefined,
    paymentStatus: formData.get("paymentStatus") || undefined,
    countersignStatus: formData.get("countersignStatus") || undefined
  });

  await updateDealFromDeals(viewer, dealId, input);
  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}

export async function saveTermsAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const deliverablesJson = String(formData.get("deliverablesJson") ?? "[]");
  const usageChannelsJson = String(formData.get("usageChannelsJson") ?? "[]");
  const competitorCategoriesJson = String(
    formData.get("competitorCategoriesJson") ?? "[]"
  );
  const restrictedCategoriesJson = String(
    formData.get("restrictedCategoriesJson") ?? "[]"
  );

  const input = dealTermsInputSchema.parse({
    brandName: parseNullableString(formData.get("brandName")),
    agencyName: parseNullableString(formData.get("agencyName")),
    creatorName: parseNullableString(formData.get("creatorName")),
    campaignName: parseNullableString(formData.get("campaignName")),
    paymentAmount: parseNullableNumber(formData.get("paymentAmount")),
    currency: parseNullableString(formData.get("currency")),
    paymentTerms: parseNullableString(formData.get("paymentTerms")),
    paymentStructure: parseNullableString(formData.get("paymentStructure")),
    netTermsDays: parseNullableNumber(formData.get("netTermsDays")),
    paymentTrigger: parseNullableString(formData.get("paymentTrigger")),
    deliverables: JSON.parse(deliverablesJson),
    usageRights: parseNullableString(formData.get("usageRights")),
    usageRightsOrganicAllowed: parseNullableBoolean(
      formData.get("usageRightsOrganicAllowed")
    ),
    usageRightsPaidAllowed: parseNullableBoolean(
      formData.get("usageRightsPaidAllowed")
    ),
    whitelistingAllowed: parseNullableBoolean(formData.get("whitelistingAllowed")),
    usageDuration: parseNullableString(formData.get("usageDuration")),
    usageTerritory: parseNullableString(formData.get("usageTerritory")),
    usageChannels: JSON.parse(usageChannelsJson),
    exclusivity: parseNullableString(formData.get("exclusivity")),
    exclusivityApplies: parseNullableBoolean(formData.get("exclusivityApplies")),
    exclusivityCategory: parseNullableString(formData.get("exclusivityCategory")),
    exclusivityDuration: parseNullableString(formData.get("exclusivityDuration")),
    exclusivityRestrictions: parseNullableString(
      formData.get("exclusivityRestrictions")
    ),
    brandCategory: normalizeDealCategory(parseNullableString(formData.get("brandCategory"))),
    competitorCategories: JSON.parse(competitorCategoriesJson),
    restrictedCategories: JSON.parse(restrictedCategoriesJson),
    campaignDateWindow: null,
    disclosureObligations: [],
    revisions: parseNullableString(formData.get("revisions")),
    revisionRounds: parseNullableNumber(formData.get("revisionRounds")),
    termination: parseNullableString(formData.get("termination")),
    terminationAllowed: parseNullableBoolean(formData.get("terminationAllowed")),
    terminationNotice: parseNullableString(formData.get("terminationNotice")),
    terminationConditions: parseNullableString(
      formData.get("terminationConditions")
    ),
    governingLaw: parseNullableString(formData.get("governingLaw")),
    notes: parseNullableString(formData.get("notes"))
  });

  await updateTermsFromDeals(viewer, dealId, {
    ...input,
    brandCategory: normalizeDealCategory(input.brandCategory)
  });

  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}

export async function saveDealNotesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await updateDealNotesFromDeals(viewer, dealId, parseNullableString(formData.get("notes")));

  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}

export async function generateDraftAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const intent = draftIntentSchema.parse(formData.get("intent")) as DraftIntent;

  await generateDraftFromDeals(viewer, dealId, intent);
  revalidatePath(`/app/deals/${dealId}`);
}

export async function deleteWorkspaceAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/app");
  const debug = startServerDebug("action_delete_workspace", {
    action: "deleteWorkspaceAction",
    dealId,
    redirectTo
  });

  try {
    const deleted = await deleteDealFromDeals(viewer, dealId);

    if (!deleted) {
      throw new Error("Could not delete workspace.");
    }

    debug.complete({
      viewerId: viewer.id,
      dealId
    });
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id,
      dealId
    });
    throw error;
  }

  revalidatePath("/app");
  revalidatePath("/app/deals/history");
  revalidatePath("/app/payments");
  redirect(redirectTo);
}

export async function applyPendingChangesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const acceptedFieldsJson = String(formData.get("acceptedFieldsJson") ?? "[]");
  const acceptedFields: string[] = JSON.parse(acceptedFieldsJson);

  await applyPendingChangesForViewer(viewer, dealId, acceptedFields);

  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}

export async function dismissPendingChangesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await dismissPendingChangesForViewer(viewer, dealId);

  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}

export async function updateDeliverablesAction(dealId: string, deliverables: unknown[]) {
  const viewer = await requireViewer();
  await updateTermsFromDeals(viewer, dealId, { deliverables: deliverables as never });
  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}
