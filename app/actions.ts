"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import {
  confirmIntakeSessionForViewer,
  createIntakeSessionForViewer,
  retryIntakeSessionForViewer
} from "@/lib/intake";
import {
  createDealForViewer as createDealFromDeals,
  generateDraftForViewer as generateDraftFromDeals,
  reprocessDocumentForViewer as reprocessDocumentFromDeals,
  updateDealForViewer as updateDealFromDeals,
  updateTermsForViewer as updateTermsFromDeals,
  uploadDocumentsForViewer as uploadDocumentsFromDeals
} from "@/lib/deals";
import { updatePaymentForViewer } from "@/lib/payments";
import { updateProfileForViewer } from "@/lib/profile";
import {
  confirmIntakeSessionSchema,
  createIntakeSessionSchema,
  createDealSchema,
  dealTermsInputSchema,
  draftIntentSchema,
  paymentRecordInputSchema,
  profileInputSchema,
  updateDealSchema
} from "@/lib/validation";
import type { DraftIntent } from "@/lib/types";

function parseNullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

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
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  await uploadDocumentsFromDeals(viewer, dealId, {
    files,
    pastedText: parseNullableString(formData.get("pastedText")),
    pastedTextTitle: parseNullableString(formData.get("pastedTextTitle"))
  });

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

  await updateTermsFromDeals(viewer, dealId, input);

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

export async function startIntakeAction(formData: FormData) {
  const viewer = await requireViewer();
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const input = createIntakeSessionSchema.parse({
    brandName: parseNullableString(formData.get("brandName")),
    campaignName: parseNullableString(formData.get("campaignName")),
    notes: parseNullableString(formData.get("notes")),
    pastedText: parseNullableString(formData.get("pastedText")),
    pastedTextTitle: parseNullableString(formData.get("pastedTextTitle"))
  });

  const session = await createIntakeSessionForViewer(viewer, {
    ...input,
    files
  });

  redirect(`/app/intake/${session.id}`);
}

export async function retryIntakeSessionAction(formData: FormData) {
  const viewer = await requireViewer();
  const sessionId = String(formData.get("sessionId") ?? "");
  await retryIntakeSessionForViewer(viewer, sessionId);
  revalidatePath(`/app/intake/${sessionId}`);
}

export async function confirmIntakeSessionAction(formData: FormData) {
  const viewer = await requireViewer();
  const sessionId = String(formData.get("sessionId") ?? "");
  const input = confirmIntakeSessionSchema.parse({
    brandName: String(formData.get("brandName") ?? "").trim(),
    campaignName: String(formData.get("campaignName") ?? "").trim(),
    agencyName: parseNullableString(formData.get("agencyName")),
    paymentAmount: parseNullableNumber(formData.get("paymentAmount")),
    notes: parseNullableString(formData.get("notes"))
  });

  const aggregate = await confirmIntakeSessionForViewer(viewer, sessionId, input);
  if (!aggregate) {
    throw new Error("Could not confirm intake session.");
  }

  redirect(`/app/deals/${aggregate.deal.id}`);
}

export async function savePaymentAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const input = paymentRecordInputSchema.parse({
    amount: parseNullableNumber(formData.get("amount")),
    currency: parseNullableString(formData.get("currency")),
    invoiceDate: parseNullableString(formData.get("invoiceDate")),
    dueDate: parseNullableString(formData.get("dueDate")),
    paidDate: parseNullableString(formData.get("paidDate")),
    status: String(formData.get("status") ?? ""),
    notes: parseNullableString(formData.get("notes")),
    source: parseNullableString(formData.get("source"))
  });

  await updatePaymentForViewer(viewer, dealId, input);
  revalidatePath("/app/payments");
  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
}

export async function saveProfileAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = profileInputSchema.parse({
    displayName: parseNullableString(formData.get("displayName")),
    creatorLegalName: parseNullableString(formData.get("creatorLegalName")),
    businessName: parseNullableString(formData.get("businessName")),
    contactEmail: parseNullableString(formData.get("contactEmail")),
    preferredSignature: parseNullableString(formData.get("preferredSignature")),
    payoutDetails: parseNullableString(formData.get("payoutDetails"))
  });

  await updateProfileForViewer(viewer, input);
  revalidatePath("/app/profile");
  revalidatePath("/app");
}
