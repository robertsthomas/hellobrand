/**
 * This route handles intake HTTP requests.
 * It connects session, draft, batch, and document requests to the intake workflow code in `lib/intake` and related helpers.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { completeDirectDocumentsToIntakeSessionForViewer } from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const debug = startServerDebug("api_intake_documents_direct_complete", {
    method: request.method,
    path: `/api/intake/${sessionId}/documents/direct/complete`,
    sessionId
  });

  try {
    const viewer = await requireApiViewer();
    const body = (await request.json()) as {
      succeededDocumentIds?: string[];
      failedUploads?: Array<{ documentId: string; errorMessage: string }>;
      startProcessing?: boolean;
    };

    const session = await completeDirectDocumentsToIntakeSessionForViewer(viewer, sessionId, {
      succeededDocumentIds: body.succeededDocumentIds ?? [],
      failedUploads: body.failedUploads ?? [],
      startProcessing: body.startProcessing
    });

    debug.complete({
      viewerId: viewer.id,
      status: session.status,
      succeededCount: body.succeededDocumentIds?.length ?? 0,
      failedCount: body.failedUploads?.length ?? 0
    });

    return ok({ session }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    return fail(error instanceof Error ? error.message : "Could not complete uploads.", 400);
  }
}
