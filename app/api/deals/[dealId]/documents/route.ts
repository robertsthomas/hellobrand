import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getDealForViewer, listDocumentsForViewer, uploadDocumentsForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { dealId } = await params;
    const aggregate = await getDealForViewer(viewer, dealId);

    if (!aggregate) {
      return fail("Deal not found.", 404);
    }

    const documents = await listDocumentsForViewer(viewer, dealId);
    return ok({ documents });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { dealId } = await params;
    const formData = await request.formData();
    const files = formData
      .getAll("documents")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const aggregate = await uploadDocumentsForViewer(viewer, dealId, {
      files,
      pastedText:
        typeof formData.get("pastedText") === "string"
          ? String(formData.get("pastedText"))
          : null,
      pastedTextTitle:
        typeof formData.get("pastedTextTitle") === "string"
          ? String(formData.get("pastedTextTitle"))
          : null
    });

    return ok({ report: aggregate }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process documents.";
    return fail(message, message === "Unauthorized" ? 401 : 422);
  }
}
