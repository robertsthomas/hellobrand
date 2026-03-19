import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { draftReplyForViewer } from "@/lib/email/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { threadId } = await params;
    const body = (await request.json()) as { dealId?: string | null };
    const draft = await draftReplyForViewer(viewer, threadId, body.dealId ?? null);

    if (!draft) {
      return fail("Email thread not found.", 404);
    }

    return ok({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate reply draft.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
