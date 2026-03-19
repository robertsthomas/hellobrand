import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { linkThreadToDealForViewer } from "@/lib/email/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { threadId } = await params;
    const body = (await request.json()) as { dealId?: string };

    if (!body.dealId) {
      return fail("Missing dealId.", 400);
    }

    const link = await linkThreadToDealForViewer(viewer, threadId, body.dealId);
    if (!link) {
      return fail("Thread or deal not found.", 404);
    }

    return ok({ link }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not link email thread.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
