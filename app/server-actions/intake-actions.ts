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
import { startServerDebug } from "@/lib/server-debug";
import {
  confirmIntakeSessionSchema,
  createIntakeSessionSchema
} from "@/lib/validation";
import {
  clampString,
  parseClampedNullableString,
  parseNullableNumber,
  parseNullableString
} from "@/app/action-helpers";

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

    redirect(`/app/p/${aggregate.deal.id}`);
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id
    });
    throw error;
  }
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
