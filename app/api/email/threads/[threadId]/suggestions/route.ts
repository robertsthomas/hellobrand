/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { getEmailThreadForViewer } from "@/lib/email/service";
import { getPersistedReplySuggestionsForThread } from "@/lib/email/reply-suggestion-cache";
import { getRepository } from "@/lib/repository";

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
    const primaryDealId = thread.primaryLink?.dealId ?? null;
    const aggregate = primaryDealId
      ? await getRepository().getDealAggregate(viewer.id, primaryDealId)
      : null;
    const riskSuggestions = [
      ...thread.promiseDiscrepancies.slice(0, 2).map((discrepancy, index) => ({
        id: `discrepancy-${index}`,
        label: `Resolve ${discrepancy.field}`,
        detail: `${discrepancy.emailClaim} vs ${discrepancy.contractValue}`
      })),
      ...thread.crossDealConflicts.slice(0, 2).map((conflict, index) => ({
        id: `conflict-${index}`,
        label: conflict.title,
        detail: conflict.detail
      })),
      ...thread.actionItems.slice(0, 2).map((item) => ({
        id: `action-${item.id}`,
        label: item.action,
        detail: item.dueDate ? `Due ${item.dueDate}` : "Action item from thread"
      }))
    ].slice(0, 4);
    const documentSuggestions = (aggregate?.documents ?? [])
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 4)
      .map((document) => ({
        id: document.id,
        fileName: document.fileName,
        documentKind: document.documentKind
      }));

    return NextResponse.json({
      suggestions,
      riskSuggestions,
      documentSuggestions
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate suggestions." },
      { status: 500 }
    );
  }
}
