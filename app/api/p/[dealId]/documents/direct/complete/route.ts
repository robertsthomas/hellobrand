/**
 * This route handles authenticated workspace HTTP requests.
 * It connects partnership reads, writes, and document operations to the shared deal and document domain code.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { completeDirectDocumentUploadsForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const debug = startServerDebug("api_deal_documents_direct_complete", {
    method: request.method,
    path: `/api/p/${dealId}/documents/direct/complete`,
    dealId
  });

  try {
    const viewer = await requireApiViewer();
    const body = (await request.json()) as {
      succeededDocumentIds?: string[];
      failedUploads?: Array<{ documentId: string; errorMessage: string }>;
    };

    const result = await completeDirectDocumentUploadsForViewer(viewer, dealId, {
      succeededDocumentIds: body.succeededDocumentIds ?? [],
      failedUploads: body.failedUploads ?? []
    });

    debug.complete({
      viewerId: viewer.id,
      succeededCount: result.succeededCount,
      failedCount: result.failedCount
    });

    return ok({ result }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    return fail(error instanceof Error ? error.message : "Could not complete uploads.", 400);
  }
}
