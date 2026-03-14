"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import {
  confirmIntakeSessionForViewer,
  createIntakeSessionForViewer,
  deleteIntakeDraftForViewer,
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
import { startServerDebug } from "@/lib/server-debug";
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
  const debug = startServerDebug("action_start_intake", {
    action: "startIntakeAction"
  });

  const viewer = await requireViewer();
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const input = createIntakeSessionSchema.parse({
    brandName: parseNullableString(formData.get("brandName")),
    campaignName: parseNullableString(formData.get("campaignName")),
    notes: parseNullableString(formData.get("notes")),
    pastedText: parseNullableString(formData.get("pastedText"))
  });

  try {
    const session = await createIntakeSessionForViewer(viewer, {
      ...input,
      files
    });

    debug.complete({
      viewerId: viewer.id,
      sessionId: session.id,
      fileCount: files.length,
      pastedChars: input.pastedText?.length ?? 0
    });

    redirect(`/app/intake/${session.id}`);
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id,
      fileCount: files.length
    });
    throw error;
  }
}

export async function retryIntakeSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const debug = startServerDebug("action_retry_intake", {
    action: "retryIntakeSessionAction",
    sessionId
  });

  const viewer = await requireViewer();
  try {
    await retryIntakeSessionForViewer(viewer, sessionId);
    debug.complete({
      viewerId: viewer.id
    });
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id
    });
    throw error;
  }
  revalidatePath(`/app/intake/${sessionId}`);
}

export async function deleteIntakeDraftAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const debug = startServerDebug("action_delete_intake_draft", {
    action: "deleteIntakeDraftAction",
    sessionId
  });

  const viewer = await requireViewer();
  const redirectTo = parseNullableString(formData.get("redirectTo"));

  try {
    await deleteIntakeDraftForViewer(viewer, sessionId);
    debug.complete({
      viewerId: viewer.id,
      redirectTo
    });
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id,
      redirectTo
    });
    throw error;
  }

  revalidatePath("/app");
  revalidatePath("/app/intake/new");

  if (redirectTo) {
    redirect(redirectTo);
  }
}

export async function confirmIntakeSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const debug = startServerDebug("action_confirm_intake", {
    action: "confirmIntakeSessionAction",
    sessionId
  });

  const viewer = await requireViewer();
  const deliverablesJson = String(formData.get("deliverablesJson") ?? "[]");
  const timelineItemsJson = String(formData.get("timelineItemsJson") ?? "[]");
  const analyticsJson = String(formData.get("analyticsJson") ?? "null");
  const input = confirmIntakeSessionSchema.parse({
    brandName: String(formData.get("brandName") ?? "").trim(),
    contractTitle: String(formData.get("contractTitle") ?? "").trim(),
    agencyName: parseNullableString(formData.get("agencyName")),
    contractSummary: parseNullableString(formData.get("contractSummary")),
    primaryContactOrganizationType:
      parseNullableString(formData.get("primaryContactOrganizationType")) as
        | "brand"
        | "agency"
        | null,
    primaryContactName: parseNullableString(formData.get("primaryContactName")),
    primaryContactTitle: parseNullableString(formData.get("primaryContactTitle")),
    primaryContactEmail: parseNullableString(formData.get("primaryContactEmail")),
    primaryContactPhone: parseNullableString(formData.get("primaryContactPhone")),
    paymentAmount: parseNullableNumber(formData.get("paymentAmount")),
    deliverables: JSON.parse(deliverablesJson),
    timelineItems: JSON.parse(timelineItemsJson),
    analytics: JSON.parse(analyticsJson),
    notes: parseNullableString(formData.get("notes"))
  });

  try {
    const aggregate = await confirmIntakeSessionForViewer(viewer, sessionId, input);
    if (!aggregate) {
      throw new Error("Could not confirm intake session.");
    }

    debug.complete({
      viewerId: viewer.id,
      dealId: aggregate.deal.id
    });

    redirect(`/app/deals/${aggregate.deal.id}`);
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id
    });
    throw error;
  }
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
