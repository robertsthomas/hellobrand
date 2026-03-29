import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { uploadDocumentsForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { dealId } = await params;
    const formData = await request.formData();
    const file = formData.get("contract");

    if (!(file instanceof File) || file.size === 0) {
      return fail("Please upload a PDF or DOCX contract.");
    }

    const aggregate = await uploadDocumentsForViewer(viewer, dealId, {
      files: [file]
    });
    return ok({ report: aggregate });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process contract.";
    return fail(message, message === "Unauthorized" ? 401 : 422);
  }
}
