import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { createIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { createIntakeSessionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const formData = await request.formData();
    const files = formData
      .getAll("documents")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const input = createIntakeSessionSchema.parse({
      brandName:
        typeof formData.get("brandName") === "string"
          ? String(formData.get("brandName"))
          : null,
      campaignName:
        typeof formData.get("campaignName") === "string"
          ? String(formData.get("campaignName"))
          : null,
      notes:
        typeof formData.get("notes") === "string"
          ? String(formData.get("notes"))
          : null,
      pastedText:
        typeof formData.get("pastedText") === "string"
          ? String(formData.get("pastedText"))
          : null,
      pastedTextTitle:
        typeof formData.get("pastedTextTitle") === "string"
          ? String(formData.get("pastedTextTitle"))
          : null
    });

    const session = await createIntakeSessionForViewer(viewer, {
      ...input,
      files
    });

    return ok({ session }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
