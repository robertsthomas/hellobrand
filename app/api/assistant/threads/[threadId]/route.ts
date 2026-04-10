/**
 * This route handles assistant HTTP requests.
 * It turns the request into assistant runtime calls while the assistant logic itself stays in `lib/assistant`.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getRepository } from "@/lib/repository";
import { fail, ok } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { threadId } = await params;
    const repository = getRepository();
    const thread = await repository.getAssistantThread(viewer.id, threadId);

    if (!thread) {
      return fail("Assistant thread not found.", 404);
    }

    const messages = await repository.listAssistantMessages(viewer.id, threadId);
    return ok({ thread, messages });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { threadId } = await params;
    const deleted = await getRepository().deleteAssistantThread(viewer.id, threadId);

    if (!deleted) {
      return fail("Assistant thread not found.", 404);
    }

    return ok({ deleted: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}
