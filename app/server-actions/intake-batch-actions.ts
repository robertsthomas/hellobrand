"use server";

/**
 * Intake batch actions.
 * This file handles multi-document intake batch creation, group confirmation, and document reassignment inside a batch.
 */
import { revalidatePath } from "next/cache";

import { requireViewer } from "@/lib/auth";
import {
  confirmBatchGroupForViewer,
  createBulkIntakeForViewer,
  reassignDocumentInBatch
} from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";
import { parseNullableString } from "@/app/action-helpers";

import { getUploadedFiles, redirectToCreatedBatch } from "./intake-shared";

export async function startBulkIntakeAction(formData: FormData) {
  const debug = startServerDebug("action_start_bulk_intake", {
    action: "startBulkIntakeAction"
  });

  const viewer = await requireViewer();
  const files = getUploadedFiles(formData);
  const notes = parseNullableString(formData.get("notes"));

  try {
    const batch = await createBulkIntakeForViewer(viewer, { files, notes });

    debug.complete({
      viewerId: viewer.id,
      batchId: batch.id,
      groupCount: batch.groups.length,
      fileCount: files.length
    });

    redirectToCreatedBatch(batch);
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
