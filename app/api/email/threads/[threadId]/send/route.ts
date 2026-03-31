import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { sendEmailThreadReplyForViewer } from "@/lib/email/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const body = (await request.json()) as {
      dealId?: string | null;
      subject?: string | null;
      body?: string | null;
      attachmentDocumentIds?: string[] | null;
    };

    const result = await sendEmailThreadReplyForViewer(viewer, threadId, {
      dealId: body.dealId ?? null,
      subject: body.subject?.trim() ?? "",
      body: body.body?.trim() ?? "",
      attachmentDocumentIds: Array.isArray(body.attachmentDocumentIds)
        ? body.attachmentDocumentIds.filter((value): value is string => typeof value === "string")
        : []
    });

    return ok(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send reply.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
