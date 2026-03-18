import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { createBulkIntakeForViewer } from "@/lib/intake";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(request: NextRequest) {
  const debug = startServerDebug("api_intake_batch_create", {
    method: request.method,
    path: "/api/intake/batch"
  });

  try {
    const viewer = await requireApiViewer();
    const formData = await request.formData();
    const files = formData
      .getAll("documents")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const notes =
      typeof formData.get("notes") === "string"
        ? String(formData.get("notes"))
        : null;

    const batch = await createBulkIntakeForViewer(viewer, { files, notes });

    debug.complete({
      viewerId: viewer.id,
      batchId: batch.id,
      groupCount: batch.groups.length,
      fileCount: files.length
    });

    return ok({ batch }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    const message =
      error instanceof Error ? error.message : "Could not create batch intake.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
