/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import {
  createEmailThreadNoteForViewer,
  listEmailThreadNotesForViewer
} from "@/lib/email/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const notes = await listEmailThreadNotesForViewer(viewer, threadId);
    return ok({ notes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load thread notes.";
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
    const body = (await request.json()) as { body?: string | null };
    const noteBody = body.body?.trim() ?? "";

    if (!noteBody) {
      return fail("Note body is required.", 400);
    }

    const note = await createEmailThreadNoteForViewer(viewer, threadId, noteBody);
    if (!note) {
      return fail("Email thread not found.", 404);
    }

    return ok({ note }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save thread note.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
