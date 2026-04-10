/**
 * Email draft generation operations for deals.
 */
import { generateEmailDraft } from "@/lib/email/generate";
import { assertViewerWithinUsageLimit, recordViewerUsage } from "@/lib/billing/entitlements";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import type { DealAggregate, DraftIntent, Viewer } from "@/lib/types";
import { queueAssistantSnapshotRefresh } from "./shared";
import { getDealForViewer } from "./service";

export async function generateDraftForViewer(
  viewer: Viewer,
  dealId: string,
  intent: DraftIntent
) {
  await assertViewerWithinUsageLimit(viewer, "deal_drafts_monthly");
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;
  const senderName =
    profile?.preferredSignature?.trim() ||
    profile?.displayName?.trim() ||
    viewer.displayName;
  const draft = generateEmailDraft(aggregate, intent, senderName);
  const saved = await getRepository().saveEmailDraft(dealId, intent, draft);
  await recordViewerUsage(viewer, "deal_drafts_monthly");
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return saved;
}

export async function ensureDraftsForDeal(
  viewer: Viewer,
  dealId: string,
  intents: DraftIntent[]
) {
  const aggregate = (await getDealForViewer(viewer, dealId)) as DealAggregate | null;
  if (!aggregate) {
    return null;
  }

  for (const intent of intents) {
    if (!aggregate.emailDrafts.some((draft) => draft.intent === intent)) {
      await generateDraftForViewer(viewer, dealId, intent);
    }
  }

  return getDealForViewer(viewer, dealId);
}
