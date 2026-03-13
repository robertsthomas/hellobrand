import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { generateDraftForViewer, getDealForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";
import { draftIntentSchema } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { dealId } = await params;
    const aggregate = await getDealForViewer(viewer, dealId);

    if (!aggregate) {
      return fail("Deal not found.", 404);
    }

    return ok({ drafts: aggregate.emailDrafts });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { dealId } = await params;
    const body = await request.json();
    const intent = draftIntentSchema.parse(body.intent);
    const draft = await generateDraftForViewer(viewer, dealId, intent);

    if (!draft) {
      return fail("Deal not found.", 404);
    }

    return ok({ draft }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate draft.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
