import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { reprocessDocumentForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { documentId } = await params;
    const aggregate = await reprocessDocumentForViewer(viewer, documentId);

    if (!aggregate) {
      return fail("Document not found.", 404);
    }

    return ok({ report: aggregate });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reprocess document.";
    return fail(message, message === "Unauthorized" ? 401 : 422);
  }
}
