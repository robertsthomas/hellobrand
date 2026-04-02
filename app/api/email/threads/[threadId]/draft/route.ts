import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import {
  getSavedEmailThreadDraftForViewer,
  saveEmailThreadDraftForViewer,
  streamDraftReplyForViewer
} from "@/lib/email/service";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const draft = await getSavedEmailThreadDraftForViewer(viewer, threadId);
    return ok({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load saved draft.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

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
      stance?: string | null;
      instructions?: string | null;
      currentDraft?: {
        subject?: string | null;
        body?: string | null;
      } | null;
    };
    const validStances = ["firm", "collaborative", "exploratory"];
    const stance = validStances.includes(body.stance ?? "") ? body.stance as "firm" | "collaborative" | "exploratory" : null;
    const instructions = body.instructions?.trim() || null;
    const currentDraft =
      body.currentDraft?.subject?.trim() && body.currentDraft?.body?.trim()
        ? {
            subject: body.currentDraft.subject.trim(),
            body: body.currentDraft.body.trim()
          }
        : null;
    const draftStream = await streamDraftReplyForViewer(
      viewer,
      threadId,
      body.dealId ?? null,
      stance,
      instructions,
      currentDraft
    );

    if (!draftStream) {
      return fail("Email thread not found.", 404);
    }

    return draftStream;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate reply draft.";
    return fail(message, message === "Unauthorized" ? 401 : 400, {
      error,
      capture: true,
      area: "email",
      name: "draft_reply"
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const body = (await request.json()) as {
      subject?: string | null;
      body?: string | null;
      status?: "in_progress" | "ready" | null;
      source?: "manual" | "ai" | null;
    };

    const subject = body.subject?.trim() ?? "";
    const draftBody = body.body?.trim() ?? "";
    if (!subject || !draftBody) {
      return fail("Draft subject and body are required.", 400);
    }

    const draft = await saveEmailThreadDraftForViewer(viewer, threadId, {
      subject,
      body: draftBody,
      status: body.status === "ready" ? "ready" : "in_progress",
      source: body.source === "ai" ? "ai" : "manual"
    });

    if (!draft) {
      return fail("Email thread not found.", 404);
    }

    return ok({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save draft.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
