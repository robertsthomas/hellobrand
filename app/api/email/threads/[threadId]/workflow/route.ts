/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { updateEmailThreadWorkflowForViewer } from "@/lib/email/service";

const VALID_WORKFLOW_STATES = new Set([
  "unlinked",
  "needs_review",
  "needs_reply",
  "draft_ready",
  "waiting_on_them",
  "closed"
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const body = (await request.json()) as { workflowState?: string | null };
    const workflowState = body.workflowState?.trim() ?? "";

    if (!VALID_WORKFLOW_STATES.has(workflowState)) {
      return fail("Invalid workflow state.", 400);
    }

    const thread = await updateEmailThreadWorkflowForViewer(
      viewer,
      threadId,
      workflowState as
        | "unlinked"
        | "needs_review"
        | "needs_reply"
        | "draft_ready"
        | "waiting_on_them"
        | "closed"
    );

    if (!thread) {
      return fail("Email thread not found.", 404);
    }

    return ok({ thread });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update thread workflow.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
