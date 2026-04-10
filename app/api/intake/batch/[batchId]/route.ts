/**
 * This route handles intake HTTP requests.
 * It connects session, draft, batch, and document requests to the intake workflow code in `lib/intake` and related helpers.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import {
  confirmBatchGroupForViewer,
  getBatchForViewer,
  reassignDocumentInBatch
} from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const debug = startServerDebug("api_intake_batch_get", {
    method: request.method,
    path: `/api/intake/batch/${batchId}`
  });

  try {
    const viewer = await requireApiViewer();
    const batch = await getBatchForViewer(viewer, batchId);

    debug.complete({ viewerId: viewer.id, batchId });
    return ok({ batch });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not fetch batch.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const debug = startServerDebug("api_intake_batch_patch", {
    method: request.method,
    path: `/api/intake/batch/${batchId}`
  });

  try {
    const viewer = await requireApiViewer();
    const body = await request.json().catch(() => ({}));

    if (body.action === "confirm_group") {
      const result = await confirmBatchGroupForViewer(viewer, batchId, body.groupId, {
        brandName: body.brandName ?? "",
        campaignName: body.campaignName ?? ""
      });

      debug.complete({
        viewerId: viewer.id,
        action: "confirm_group",
        groupId: body.groupId,
        dealId: result.dealId
      });

      return ok(result);
    }

    if (body.action === "reassign_document") {
      const batch = await reassignDocumentInBatch(
        viewer,
        batchId,
        body.documentId,
        body.fromGroupId,
        body.toGroupId
      );

      debug.complete({
        viewerId: viewer.id,
        action: "reassign_document",
        documentId: body.documentId
      });

      return ok({ batch });
    }

    return fail("Unknown action.", 400);
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not update batch.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
