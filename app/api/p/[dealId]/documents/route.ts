import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getDealForViewer, listDocumentsForViewer, uploadDocumentsForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";
import { startServerDebug } from "@/lib/server-debug";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const debug = startServerDebug("api_deal_documents_get", {
    method: _request.method,
    path: `/api/p/${dealId}/documents`,
    dealId
  });

  try {
    const viewer = await requireApiViewer();
    const aggregate = await getDealForViewer(viewer, dealId);

    if (!aggregate) {
      debug.fail(new Error("Deal not found."));
      return fail("Deal not found.", 404);
    }

    const documents = await listDocumentsForViewer(viewer, dealId);
    debug.complete({
      viewerId: viewer.id,
      documentCount: documents.length
    });
    return ok({ documents });
  } catch (error) {
    debug.fail(error);
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const debug = startServerDebug("api_deal_documents_upload", {
    method: request.method,
    path: `/api/p/${dealId}/documents`,
    dealId
  });

  try {
    const viewer = await requireApiViewer();
    const formData = await request.formData();
    const files = formData
      .getAll("documents")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const aggregate = await uploadDocumentsForViewer(viewer, dealId, {
      files,
      pastedText:
        typeof formData.get("pastedText") === "string"
          ? String(formData.get("pastedText"))
          : null
    });

    debug.complete({
      viewerId: viewer.id,
      fileCount: files.length,
      pastedChars:
        typeof formData.get("pastedText") === "string"
          ? String(formData.get("pastedText")).length
          : 0,
      documentCount: aggregate?.documents.length ?? 0
    });

    return ok({ report: aggregate }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not process documents.";
    return fail(message, message === "Unauthorized" ? 401 : 422);
  }
}
