/**
 * This file handles AI summary and drafting helpers for inbox threads.
 * It keeps prompt-building and AI orchestration separate from sync, OAuth, and repository mutation flows.
 */
import { getProfileForViewer } from "@/lib/profile";
import {
  generateEmailReplyDraft,
  generateEmailThreadSummary,
  streamEmailReplyDraft
} from "@/lib/email/ai";
import {
  getEmailThreadDetailForUser,
  listEmailThreadNotesForUser,
  saveEmailThreadSummary
} from "@/lib/email/repository";
import {
  assertPremiumInboxAccess,
  loadLinkedDealAggregate
} from "@/lib/email/service-shared";
import type { DealAggregate, NegotiationStance, Viewer } from "@/lib/types";

export async function summarizeEmailThreadForViewer(viewer: Viewer, threadId: string) {
  await assertPremiumInboxAccess(viewer);
  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  if (!detail) {
    return null;
  }

  const summary = await generateEmailThreadSummary(detail);
  await saveEmailThreadSummary(viewer.id, threadId, summary);
  return summary;
}

export async function draftReplyForViewer(
  viewer: Viewer,
  threadId: string,
  explicitDealId?: string | null,
  stance?: NegotiationStance | null,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null
) {
  await assertPremiumInboxAccess(viewer);
  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  if (!detail) {
    return null;
  }

  const [deal, profile, notes] = await Promise.all([
    loadLinkedDealAggregate(viewer, detail, explicitDealId),
    getProfileForViewer(viewer),
    listEmailThreadNotesForUser(viewer.id, threadId)
  ]);

  return generateEmailReplyDraft(
    detail,
    deal as DealAggregate | null,
    profile,
    stance ?? null,
    instructions ?? null,
    currentDraft ?? null,
    notes
  );
}

export async function streamDraftReplyForViewer(
  viewer: Viewer,
  threadId: string,
  explicitDealId?: string | null,
  stance?: NegotiationStance | null,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null
) {
  await assertPremiumInboxAccess(viewer);
  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  if (!detail) {
    return null;
  }

  const [deal, profile, notes] = await Promise.all([
    loadLinkedDealAggregate(viewer, detail, explicitDealId),
    getProfileForViewer(viewer),
    listEmailThreadNotesForUser(viewer.id, threadId)
  ]);

  return streamEmailReplyDraft({
    viewer,
    thread: detail,
    partnership: deal as DealAggregate | null,
    profile,
    stance: stance ?? null,
    instructions: instructions ?? null,
    currentDraft: currentDraft ?? null,
    notes
  });
}
