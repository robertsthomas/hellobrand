import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { linkThreadToDealForViewer } from "@/lib/email/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const body = (await request.json()) as {
      dealId?: string;
      role?: "primary" | "reference";
    };

    if (!body.dealId) {
      return fail("Missing dealId.", 400);
    }

    const role = body.role === "reference" ? "reference" : "primary";
    const link = await linkThreadToDealForViewer(viewer, threadId, body.dealId, role);
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
