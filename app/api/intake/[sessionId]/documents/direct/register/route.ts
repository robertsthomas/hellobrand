import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { registerDirectDocumentsToIntakeSessionForViewer } from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const debug = startServerDebug("api_intake_documents_direct_register", {
    method: request.method,
    path: `/api/intake/${sessionId}/documents/direct/register`,
    sessionId
  });

  try {
    const viewer = await requireApiViewer();
    const body = (await request.json()) as {
      files?: Array<{
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        checksumSha256: string | null;
      }>;
      pastedText?: string | null;
    };

    const result = await registerDirectDocumentsToIntakeSessionForViewer(viewer, sessionId, {
      files: body.files,
      pastedText: body.pastedText
    });

    debug.complete({
      viewerId: viewer.id,
      mode: result.registration.mode,
      fileCount: body.files?.length ?? 0,
      documentCount: result.registration.documents.length
    });

    return ok({ session: result.session, registration: result.registration }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    return fail(error instanceof Error ? error.message : "Could not register uploads.", 400);
  }
}
