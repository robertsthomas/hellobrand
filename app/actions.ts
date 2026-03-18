"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import {
  confirmBatchGroupForViewer,
  confirmIntakeSessionForViewer,
  createBulkIntakeForViewer,
  createIntakeSessionForViewer,
  deleteIntakeDraftForViewer,
  reassignDocumentInBatch,
  retryIntakeSessionForViewer
} from "@/lib/intake";
import {
  createDealForViewer as createDealFromDeals,
  deleteDealForViewer as deleteDealFromDeals,
  generateDraftForViewer as generateDraftFromDeals,
  reprocessDocumentForViewer as reprocessDocumentFromDeals,
  updateDealNotesForViewer as updateDealNotesFromDeals,
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

function clampString(value: string, maximum: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maximum) {
    return trimmed;
  }

  return trimmed.slice(0, maximum).trim();
}

function parseClampedNullableString(
  value: FormDataEntryValue | null,
  maximum: number
) {
  const parsed = parseNullableString(value);
  if (!parsed) {
    return null;
  }

  return clampString(parsed, maximum);
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
    brandCategory: parseNullableString(formData.get("brandCategory")),
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

  await updateTermsFromDeals(viewer, dealId, input);

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

export async function startIntakeAction(formData: FormData) {
  const debug = startServerDebug("action_start_intake", {
    action: "startIntakeAction"
  });

  const viewer = await requireViewer();
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const pastedText = parseNullableString(formData.get("pastedText"));

  if (files.length > 1 && !pastedText) {
    try {
      const notes = parseNullableString(formData.get("notes"));
      const batch = await createBulkIntakeForViewer(viewer, { files, notes });

      debug.complete({
        viewerId: viewer.id,
        batchId: batch.id,
        groupCount: batch.groups.length,
        fileCount: files.length
      });

      if (batch.groups.length <= 1) {
        const group = batch.groups[0];
        if (group?.intakeSessionId) {
          redirect(`/app/intake/${group.intakeSessionId}`);
        }
      }

      redirect(`/app/intake/batch/${batch.id}`);
    } catch (error) {
      debug.fail(error, {
        viewerId: viewer.id,
        fileCount: files.length
      });
      throw error;
    }
  }

  const input = createIntakeSessionSchema.parse({
    brandName: parseNullableString(formData.get("brandName")),
    campaignName: parseNullableString(formData.get("campaignName")),
    notes: parseNullableString(formData.get("notes")),
    pastedText
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
  revalidatePath(`/app/intake/${sessionId}/review`);
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
  revalidatePath(`/app/intake/${sessionId}/review`);

  if (redirectTo) {
    redirect(redirectTo);
  }
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

export async function confirmIntakeSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const debug = startServerDebug("action_confirm_intake", {
    action: "confirmIntakeSessionAction",
    sessionId
  });

  const viewer = await requireViewer();
  const deliverablesJson = String(formData.get("deliverablesJson") ?? "[]");
  const timelineItemsJson = String(formData.get("timelineItemsJson") ?? "[]");
  const analyticsJson = String(formData.get("analyticsJson") ?? "{\"highlights\":[]}");
  const competitorCategoriesJson = String(
    formData.get("competitorCategoriesJson") ?? "[]"
  );
  const restrictedCategoriesJson = String(
    formData.get("restrictedCategoriesJson") ?? "[]"
  );
  const campaignDateWindowJson = String(
    formData.get("campaignDateWindowJson") ?? "null"
  );
  const disclosureObligationsJson = String(
    formData.get("disclosureObligationsJson") ?? "[]"
  );
  const input = confirmIntakeSessionSchema.parse({
    brandName: clampString(String(formData.get("brandName") ?? ""), 120),
    contractTitle: clampString(String(formData.get("contractTitle") ?? ""), 160),
    agencyName: parseClampedNullableString(formData.get("agencyName"), 120),
    contractSummary: parseClampedNullableString(formData.get("contractSummary"), 12000),
    primaryContactOrganizationType:
      parseNullableString(formData.get("primaryContactOrganizationType")) as
        | "brand"
        | "agency"
        | null,
    primaryContactName: parseClampedNullableString(formData.get("primaryContactName"), 120),
    primaryContactTitle: parseClampedNullableString(
      formData.get("primaryContactTitle"),
      160
    ),
    primaryContactEmail: parseClampedNullableString(formData.get("primaryContactEmail"), 320),
    primaryContactPhone: parseClampedNullableString(formData.get("primaryContactPhone"), 40),
    paymentAmount: parseNullableNumber(formData.get("paymentAmount")),
    currency: parseClampedNullableString(formData.get("currency"), 12),
    brandCategory: parseNullableString(formData.get("brandCategory")),
    competitorCategories: JSON.parse(competitorCategoriesJson),
    restrictedCategories: JSON.parse(restrictedCategoriesJson),
    campaignDateWindow: JSON.parse(campaignDateWindowJson),
    disclosureObligations: JSON.parse(disclosureObligationsJson),
    deliverables: JSON.parse(deliverablesJson),
    timelineItems: JSON.parse(timelineItemsJson),
    analytics: JSON.parse(analyticsJson),
    notes: parseClampedNullableString(formData.get("notes"), 5000)
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

export async function startBulkIntakeAction(formData: FormData) {
  const debug = startServerDebug("action_start_bulk_intake", {
    action: "startBulkIntakeAction"
  });

  const viewer = await requireViewer();
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const notes = parseNullableString(formData.get("notes"));

  try {
    const batch = await createBulkIntakeForViewer(viewer, { files, notes });

    debug.complete({
      viewerId: viewer.id,
      batchId: batch.id,
      groupCount: batch.groups.length,
      fileCount: files.length
    });

    if (batch.groups.length <= 1) {
      const group = batch.groups[0];
      if (group?.intakeSessionId) {
        redirect(`/app/intake/${group.intakeSessionId}`);
      }
    }

    redirect(`/app/intake/batch/${batch.id}`);
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id,
      fileCount: files.length
    });
    throw error;
  }
}

export async function confirmBatchGroupAction(formData: FormData) {
  const batchId = String(formData.get("batchId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");
  const debug = startServerDebug("action_confirm_batch_group", {
    action: "confirmBatchGroupAction",
    batchId,
    groupId
  });

  const viewer = await requireViewer();

  try {
    const result = await confirmBatchGroupForViewer(viewer, batchId, groupId, {
      brandName: String(formData.get("brandName") ?? "").trim(),
      campaignName: String(formData.get("campaignName") ?? "").trim()
    });

    debug.complete({
      viewerId: viewer.id,
      dealId: result.dealId
    });
  } catch (error) {
    debug.fail(error, { viewerId: viewer.id });
    throw error;
  }

  revalidatePath(`/app/intake/batch/${batchId}`);
}

export async function reassignDocumentAction(formData: FormData) {
  const batchId = String(formData.get("batchId") ?? "");
  const debug = startServerDebug("action_reassign_document", {
    action: "reassignDocumentAction",
    batchId
  });

  const viewer = await requireViewer();

  try {
    await reassignDocumentInBatch(
      viewer,
      batchId,
      String(formData.get("documentId") ?? ""),
      String(formData.get("fromGroupId") ?? ""),
      String(formData.get("toGroupId") ?? "")
    );

    debug.complete({ viewerId: viewer.id });
  } catch (error) {
    debug.fail(error, { viewerId: viewer.id });
    throw error;
  }

  revalidatePath(`/app/intake/batch/${batchId}`);
}
