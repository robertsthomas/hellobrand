/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { importEmailAttachmentToWorkspaceForViewer } from "@/lib/email/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { attachmentId } = await params;
    const body = (await request.json()) as { dealId?: string | null };
    const dealId = body.dealId?.trim() ?? "";

    if (!dealId) {
      return fail("Missing dealId.", 400);
    }

    const document = await importEmailAttachmentToWorkspaceForViewer(viewer, attachmentId, dealId);
    return ok({ document }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not import email attachment.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
