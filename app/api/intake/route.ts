/**
 * This route handles intake HTTP requests.
 * It connects session, draft, batch, and document requests to the intake workflow code in `lib/intake` and related helpers.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { createIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { startServerDebug } from "@/lib/server-debug";
import { createIntakeSessionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const debug = startServerDebug("api_intake_create", {
    method: request.method,
    path: "/api/intake"
  });

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
          : null
    });

    const session = await createIntakeSessionForViewer(viewer, {
      ...input,
      files
    });

    debug.complete({
      viewerId: viewer.id,
      sessionId: session.id,
      fileCount: files.length,
      pastedChars: input.pastedText?.length ?? 0
    });

    return ok({ session }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not start intake session.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
