"use server";

import { revalidatePath } from "next/cache";
/**
 * Deal workspace mutation actions.
 * This file handles deal creation, document uploads, metadata updates, term updates, and draft generation for a single workspace.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  parseNullableBoolean,
  parseNullableNumber,
  parseNullableString,
} from "@/app/action-helpers";
import { requireViewer } from "@/lib/auth";
import { normalizeDealCategory } from "@/lib/conflict-intelligence";
import {
  confirmTermsFieldForViewer,
  createDealForViewer as createDealFromDeals,
  reprocessDocumentForViewer as reprocessDocumentFromDeals,
  sendDealForESignature as sendDealForESignatureFromDeals,
  updateDealForViewer as updateDealFromDeals,
  updateDealNotesForViewer as updateDealNotesFromDeals,
  updateTermsForViewer as updateTermsFromDeals,
  uploadDocumentsForViewer as uploadDocumentsFromDeals,
} from "@/lib/deals";
import { startServerDebug } from "@/lib/server-debug";
import { sanitizePlainTextInput } from "@/lib/utils";
import { createDealSchema, dealTermsInputSchema, updateDealSchema } from "@/lib/validation";

import { invalidateDeals, invalidateDealWorkspace } from "./deal-shared";

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  return host ? `${proto}://${host}` : null;
}

async function createDealAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = createDealSchema.parse({
    brandName: String(formData.get("brandName") ?? "").trim(),
    campaignName: String(formData.get("campaignName") ?? "").trim(),
    notes: parseNullableString(formData.get("notes")),
  });

  const deal = await createDealFromDeals(viewer, input);
  redirect(`/app/p/${deal.id}`);
}

async function uploadDocumentsAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const debug = startServerDebug("action_upload_documents", {
    action: "uploadDocumentsAction",
    dealId,
  });

  const viewer = await requireViewer();
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  try {
    await uploadDocumentsFromDeals(viewer, dealId, {
      files,
      pastedText: parseNullableString(formData.get("pastedText")),
    });
    debug.complete({
      viewerId: viewer.id,
      fileCount: files.length,
      pastedChars: parseNullableString(formData.get("pastedText"))?.length ?? 0,
    });
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id,
      fileCount: files.length,
    });
    throw error;
  }

  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  revalidatePath("/app/p/history");
  invalidateDeals(viewer.id, dealId);
}

export async function reprocessDocumentAction(formData: FormData) {
  const viewer = await requireViewer();
  const documentId = String(formData.get("documentId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  await reprocessDocumentFromDeals(viewer, documentId);
  invalidateDealWorkspace(viewer.id, dealId);
}

export async function sendForESignatureAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const appUrl = await getRequestOrigin();

  const result = await sendDealForESignatureFromDeals(viewer, dealId, { appUrl });
  invalidateDealWorkspace(viewer.id, dealId);

  return {
    ok: true,
    message: "Sent for eSignature.",
    envelopeId: result.envelopeId,
  };
}

async function saveDealMetaAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const input = updateDealSchema.parse({
    status: formData.get("status") || undefined,
    paymentStatus: formData.get("paymentStatus") || undefined,
    countersignStatus: formData.get("countersignStatus") || undefined,
  });

  await updateDealFromDeals(viewer, dealId, input);
  invalidateDealWorkspace(viewer.id, dealId);
}

export async function saveTermsAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const deliverablesJson = String(formData.get("deliverablesJson") ?? "[]");
  const usageChannelsJson = String(formData.get("usageChannelsJson") ?? "[]");
  const competitorCategoriesJson = String(formData.get("competitorCategoriesJson") ?? "[]");
  const restrictedCategoriesJson = String(formData.get("restrictedCategoriesJson") ?? "[]");

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
    usageRightsOrganicAllowed: parseNullableBoolean(formData.get("usageRightsOrganicAllowed")),
    usageRightsPaidAllowed: parseNullableBoolean(formData.get("usageRightsPaidAllowed")),
    whitelistingAllowed: parseNullableBoolean(formData.get("whitelistingAllowed")),
    usageDuration: parseNullableString(formData.get("usageDuration")),
    usageTerritory: parseNullableString(formData.get("usageTerritory")),
    usageChannels: JSON.parse(usageChannelsJson),
    exclusivity: parseNullableString(formData.get("exclusivity")),
    exclusivityApplies: parseNullableBoolean(formData.get("exclusivityApplies")),
    exclusivityCategory: parseNullableString(formData.get("exclusivityCategory")),
    exclusivityDuration: parseNullableString(formData.get("exclusivityDuration")),
    exclusivityRestrictions: parseNullableString(formData.get("exclusivityRestrictions")),
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
    terminationConditions: parseNullableString(formData.get("terminationConditions")),
    governingLaw: parseNullableString(formData.get("governingLaw")),
    notes: (() => {
      const rawNotes = parseNullableString(formData.get("notes"));
      const sanitizedNotes = sanitizePlainTextInput(rawNotes);
      return sanitizedNotes || null;
    })(),
  });

  await updateTermsFromDeals(viewer, dealId, {
    ...input,
    brandCategory: normalizeDealCategory(input.brandCategory),
  });

  invalidateDealWorkspace(viewer.id, dealId);
}

export async function saveDealNotesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const rawNotes = parseNullableString(formData.get("notes"));
  const sanitizedNotes = sanitizePlainTextInput(rawNotes);

  await updateDealNotesFromDeals(viewer, dealId, sanitizedNotes || null);
  invalidateDealWorkspace(viewer.id, dealId);
}

export async function confirmTermsReviewAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const fieldPath = String(formData.get("fieldPath") ?? "");

  await confirmTermsFieldForViewer(viewer, dealId, fieldPath);
  invalidateDealWorkspace(viewer.id, dealId);
}
