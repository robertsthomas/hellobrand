import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { getEmailAttachmentForViewer } from "@/lib/email/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { attachmentId } = await params;
    const attachment = await getEmailAttachmentForViewer(viewer, attachmentId);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    const disposition =
      request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

    return new NextResponse(attachment.bytes, {
      headers: {
        "content-type": attachment.mimeType,
        "content-length": String(attachment.sizeBytes),
        "content-disposition": `${disposition}; filename="${encodeURIComponent(attachment.filename)}"`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=60"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load email attachment.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 }
    );
  }
}
