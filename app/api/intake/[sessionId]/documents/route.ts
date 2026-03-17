import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { appendDocumentsToIntakeSessionForViewer } from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const debug = startServerDebug("api_intake_documents_upload", {
    method: request.method,
    path: `/api/intake/${sessionId}/documents`,
    sessionId
  });

  try {
    const viewer = await requireApiViewer();
    const formData = await request.formData();
    const files = formData
      .getAll("documents")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const session = await appendDocumentsToIntakeSessionForViewer(viewer, sessionId, {
      files,
      pastedText:
        typeof formData.get("pastedText") === "string"
          ? String(formData.get("pastedText"))
          : null,
      startProcessing: String(formData.get("startProcessing") ?? "") === "1"
    });

    debug.complete({
      viewerId: viewer.id,
      fileCount: files.length,
      pastedChars:
        typeof formData.get("pastedText") === "string"
          ? String(formData.get("pastedText")).length
          : 0,
      status: session.status
    });

    return ok({ session }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not upload session documents.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
