import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { getEmailThreadForViewer } from "@/lib/email/service";
import { getPersistedReplySuggestionsForThread } from "@/lib/email/reply-suggestion-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
  ) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "premium_inbox");
    const { threadId } = await params;
    const thread = await getEmailThreadForViewer(viewer, threadId);

    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    const suggestions = await getPersistedReplySuggestionsForThread(viewer, thread);

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate suggestions." },
      { status: 500 }
    );
  }
}
