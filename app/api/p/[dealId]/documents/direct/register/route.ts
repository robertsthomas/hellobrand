/**
 * This route handles authenticated workspace HTTP requests.
 * It connects partnership reads, writes, and document operations to the shared deal and document domain code.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { registerDirectDocumentUploadsForViewer } from "@/lib/deals";
import { startServerDebug } from "@/lib/server-debug";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const debug = startServerDebug("api_deal_documents_direct_register", {
    method: request.method,
    path: `/api/p/${dealId}/documents/direct/register`,
    dealId
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

    const registration = await registerDirectDocumentUploadsForViewer(viewer, dealId, {
      files: body.files,
      pastedText: body.pastedText
    });

    debug.complete({
      viewerId: viewer.id,
      mode: registration.mode,
      fileCount: body.files?.length ?? 0,
      documentCount: registration.documents.length
    });

    return ok({ registration }, { status: 201 });
  } catch (error) {
    debug.fail(error);
    return fail(error instanceof Error ? error.message : "Could not register uploads.", 400);
  }
}
