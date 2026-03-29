"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeDealCategory } from "@/lib/conflict-intelligence";
import { requireViewer } from "@/lib/auth";
import {
  applyPendingChangesForViewer,
  activateSummaryVariantForViewer,
  createDealForViewer as createDealFromDeals,
  confirmTermsFieldForViewer,
  deleteDealForViewer as deleteDealFromDeals,
  dismissPendingChangesForViewer,
  generateDraftForViewer as generateDraftFromDeals,
  reprocessDocumentForViewer as reprocessDocumentFromDeals,
  restoreSummaryForViewer,
  updateDealNotesForViewer as updateDealNotesFromDeals,
  updateDealForViewer as updateDealFromDeals,
  updateTermsForViewer as updateTermsFromDeals,
  uploadDocumentsForViewer as uploadDocumentsFromDeals
} from "@/lib/deals";
import {
  finalizeInvoiceForViewer,
  generateInvoiceDraftForViewer,
  saveInvoiceDraftForViewer
} from "@/lib/invoices";
import { startServerDebug } from "@/lib/server-debug";
import {
  createDealSchema,
  dealTermsInputSchema,
  draftIntentSchema,
  invoiceRecordInputSchema,
  updateDealSchema
} from "@/lib/validation";
import type {
  DraftIntent,
  InvoiceLineItem,
  InvoiceParty,
  SummaryType
} from "@/lib/types";
import {
  parseNullableBoolean,
  parseNullableNumber,
  parseNullableString
} from "@/app/action-helpers";

function invalidateDeals(viewerId: string, dealId?: string) {
  updateTag(`user-${viewerId}-deals`);
  if (dealId) {
    updateTag(`deal-${dealId}`);
  }
}

function resolveSafeWorkspaceRedirect(target: string | null | undefined) {
  if (!target || !target.startsWith("/app")) {
    return "/app";
  }

  return target;
}

async function performWorkspaceDelete(
  viewer: Awaited<ReturnType<typeof requireViewer>>,
  dealId: string,
  redirectTo: string,
  actionName: string
) {
  const debug = startServerDebug("action_delete_workspace", {
    action: actionName,
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
  revalidatePath("/app/p/history");
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app/payments");
  revalidatePath("/app/inbox");
  revalidatePath("/app/analytics");
  revalidatePath("/app/settings/notifications");
  invalidateDeals(viewer.id, dealId);
  updateTag(`user-${viewer.id}-payments`);
  updateTag(`user-${viewer.id}-notifications`);
}

export async function createDealAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = createDealSchema.parse({
    brandName: String(formData.get("brandName") ?? "").trim(),
    campaignName: String(formData.get("campaignName") ?? "").trim(),
    notes: parseNullableString(formData.get("notes"))
  });

  const deal = await createDealFromDeals(viewer, input);
  redirect(`/app/p/${deal.id}`);
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
  revalidatePath(`/app/p/${dealId}`);
  invalidateDeals(viewer.id, dealId);
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
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
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

  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
}

export async function saveDealNotesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await updateDealNotesFromDeals(viewer, dealId, parseNullableString(formData.get("notes")));

  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
}

export async function confirmTermsReviewAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const fieldPath = String(formData.get("fieldPath") ?? "");

  await confirmTermsFieldForViewer(viewer, dealId, fieldPath);

  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
}

export async function generateDraftAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const intent = draftIntentSchema.parse(formData.get("intent")) as DraftIntent;

  await generateDraftFromDeals(viewer, dealId, intent);
  revalidatePath(`/app/p/${dealId}`);
  invalidateDeals(viewer.id, dealId);
}

const SUMMARY_TYPES = ["legal", "plain_language", "short"] as const;

export async function activateSummaryVariantAction(
  dealId: string,
  summaryType: SummaryType
) {
  const viewer = await requireViewer();

  if (!SUMMARY_TYPES.includes(summaryType)) {
    return {
      error: "Unknown summary type."
    };
  }

  try {
    await activateSummaryVariantForViewer(viewer, dealId, summaryType);
    revalidatePath(`/app/p/${dealId}`);
    revalidatePath("/app");
    invalidateDeals(viewer.id, dealId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not switch summary versions right now."
    };
  }
}

export async function restoreSummaryVersionAction(dealId: string, summaryId: string) {
  const viewer = await requireViewer();

  try {
    await restoreSummaryForViewer(viewer, dealId, summaryId);
    revalidatePath(`/app/p/${dealId}`);
    revalidatePath("/app");
    invalidateDeals(viewer.id, dealId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not restore that summary version."
    };
  }
}

export async function deleteWorkspaceAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const redirectTo = resolveSafeWorkspaceRedirect(String(formData.get("redirectTo") ?? "/app"));

  await performWorkspaceDelete(viewer, dealId, redirectTo, "deleteWorkspaceAction");
  redirect(redirectTo);
}

export async function deleteWorkspaceConfirmedAction(
  _previousState: { error: string | null },
  formData: FormData
) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const redirectTo = resolveSafeWorkspaceRedirect(String(formData.get("redirectTo") ?? "/app"));
  const confirmation = String(formData.get("confirmationText") ?? "").trim().toLowerCase();

  if (confirmation !== "delete") {
    return {
      error: 'Type "delete" to confirm this partnership deletion.'
    };
  }

  await performWorkspaceDelete(
    viewer,
    dealId,
    redirectTo,
    "deleteWorkspaceConfirmedAction"
  );
  redirect(redirectTo);
}

export async function applyPendingChangesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const acceptedFieldsJson = String(formData.get("acceptedFieldsJson") ?? "[]");
  const acceptedFields: string[] = JSON.parse(acceptedFieldsJson);

  await applyPendingChangesForViewer(viewer, dealId, acceptedFields);

  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
}

export async function archiveDealAction(dealId: string) {
  const viewer = await requireViewer();
  const deal = await updateDealFromDeals(viewer, dealId, {});

  if (!deal) {
    return { error: "Partnership not found." };
  }

  if (deal.status === "archived") {
    return { error: "Partnership is already archived." };
  }

  await updateDealFromDeals(viewer, dealId, {
    statusBeforeArchive: deal.status,
    status: "archived"
  });

  revalidatePath("/app");
  revalidatePath("/app/p/history");
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app/payments");
  invalidateDeals(viewer.id, dealId);
}

export async function unarchiveDealAction(dealId: string) {
  const viewer = await requireViewer();
  const deal = await updateDealFromDeals(viewer, dealId, {});

  if (!deal) {
    return { error: "Partnership not found." };
  }

  if (deal.status !== "archived") {
    return { error: "Partnership is not archived." };
  }

  const restoreStatus = deal.statusBeforeArchive ?? "completed";

  await updateDealFromDeals(viewer, dealId, {
    status: restoreStatus as never,
    statusBeforeArchive: null
  });

  revalidatePath("/app");
  revalidatePath("/app/p/history");
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app/payments");
  invalidateDeals(viewer.id, dealId);
}

export async function dismissPendingChangesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await dismissPendingChangesForViewer(viewer, dealId);

  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
}

export async function updateDeliverablesAction(dealId: string, deliverables: unknown[]) {
  const viewer = await requireViewer();
  await updateTermsFromDeals(viewer, dealId, { deliverables: deliverables as never });
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
}

function parseInvoicePartyFromForm(formData: FormData, prefix: "billTo" | "issuer"): InvoiceParty {
  return {
    name: String(formData.get(`${prefix}Name`) ?? "").trim(),
    email: parseNullableString(formData.get(`${prefix}Email`)),
    companyName: parseNullableString(formData.get(`${prefix}CompanyName`)),
    address: parseNullableString(formData.get(`${prefix}Address`)),
    taxId: parseNullableString(formData.get(`${prefix}TaxId`)),
    payoutDetails: parseNullableString(formData.get(`${prefix}PayoutDetails`))
  };
}

function parseInvoiceLineItemsFromForm(formData: FormData): InvoiceLineItem[] {
  const raw = String(formData.get("lineItemsJson") ?? "[]");
  const parsed = JSON.parse(raw) as unknown[];

  return parsed.map((item) => {
    const record = item as Partial<InvoiceLineItem>;
    return {
      id: String(record.id ?? ""),
      deliverableId:
        typeof record.deliverableId === "string" ? record.deliverableId : null,
      title: String(record.title ?? ""),
      description:
        typeof record.description === "string" ? record.description : null,
      channel: typeof record.channel === "string" ? record.channel : null,
      quantity: Number(record.quantity ?? 1),
      unitRate: Number(record.unitRate ?? 0),
      amount: Number(record.amount ?? 0)
    };
  });
}

function parseInvoiceInputFromForm(formData: FormData) {
  const lineItems = parseInvoiceLineItemsFromForm(formData);
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return invoiceRecordInputSchema.parse({
    invoiceNumber: String(formData.get("invoiceNumber") ?? "").trim(),
    status: String(formData.get("status") ?? "draft"),
    invoiceDate: parseNullableString(formData.get("invoiceDate")),
    dueDate: parseNullableString(formData.get("dueDate")),
    currency: parseNullableString(formData.get("currency")),
    subtotal,
    notes: parseNullableString(formData.get("notes")),
    billTo: parseInvoicePartyFromForm(formData, "billTo"),
    issuer: parseInvoicePartyFromForm(formData, "issuer"),
    lineItems,
    pdfDocumentId: parseNullableString(formData.get("pdfDocumentId")),
    manualNumberOverride: String(formData.get("manualNumberOverride") ?? "") === "true"
  });
}

function invalidateInvoiceSurfaces(viewerId: string, dealId: string) {
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app/payments");
  revalidatePath("/app");
  invalidateDeals(viewerId, dealId);
  updateTag(`user-${viewerId}-payments`);
  updateTag(`user-${viewerId}-notifications`);
}

export async function generateInvoiceDraftAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await generateInvoiceDraftForViewer(viewer, dealId);
  invalidateInvoiceSurfaces(viewer.id, dealId);
}

export async function saveInvoiceDraftAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const input = parseInvoiceInputFromForm(formData);

  await saveInvoiceDraftForViewer(viewer, dealId, {
    ...input,
    status: "draft",
    draftSavedAt: null,
    finalizedAt: null,
    pdfDocumentId: input.pdfDocumentId ?? null,
    manualNumberOverride: input.manualNumberOverride ?? false
  });
  invalidateInvoiceSurfaces(viewer.id, dealId);
}

export async function finalizeInvoiceAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const input = parseInvoiceInputFromForm(formData);

  await finalizeInvoiceForViewer(viewer, dealId, {
    ...input,
    status: "draft",
    draftSavedAt: null,
    finalizedAt: null,
    pdfDocumentId: input.pdfDocumentId ?? null,
    manualNumberOverride: input.manualNumberOverride ?? false
  });
  invalidateInvoiceSurfaces(viewer.id, dealId);
}
