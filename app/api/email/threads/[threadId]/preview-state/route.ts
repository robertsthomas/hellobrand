import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { markEmailThreadPreviewSectionSeenForViewer } from "@/lib/email/preview-state";
import { fail, ok } from "@/lib/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const body = (await request.json().catch(() => null)) as
      | {
          section?: "updates" | "actionItems";
          seenAt?: string;
        }
      | null;

    if (!body?.section || !body?.seenAt) {
      return fail("Section and seenAt are required.");
    }

    if (body.section !== "updates" && body.section !== "actionItems") {
      return fail("Invalid preview section.");
    }

    const previewState = await markEmailThreadPreviewSectionSeenForViewer({
      viewer,
      threadId,
      section: body.section,
      seenAt: body.seenAt
    });

    return ok({ previewState });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update preview state.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
