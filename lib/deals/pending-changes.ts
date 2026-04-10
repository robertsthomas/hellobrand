/**
 * Pending extraction changes: apply or dismiss.
 */
import { syncPaymentRecordForDeal } from "@/lib/payments";
import { getRepository } from "@/lib/repository";
import { buildAppliedTerms } from "@/lib/pending-changes";
import type { PendingExtractionData, Viewer } from "@/lib/types";
import { earliestDeliverableDate, queueAssistantSnapshotRefresh } from "./shared";

export async function applyPendingChangesForViewer(
  viewer: Viewer,
  dealId: string,
  acceptedFields: string[]
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);
  if (!aggregate?.terms?.pendingExtraction) {
    return null;
  }

  const pending = aggregate.terms.pendingExtraction as PendingExtractionData;
  const applied = buildAppliedTerms(aggregate.terms, pending, acceptedFields);
  await repository.upsertTerms(dealId, applied);

  if (process.env.DATABASE_URL) {
    await syncPaymentRecordForDeal(dealId, applied);
  }

  await repository.updateDeal(viewer.id, dealId, {
    nextDeliverableDate: earliestDeliverableDate(applied),
    brandName: applied.brandName ?? aggregate.deal.brandName,
    campaignName: applied.campaignName ?? aggregate.deal.campaignName
  });

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return repository.getDealAggregate(viewer.id, dealId);
}

export async function dismissPendingChangesForViewer(
  viewer: Viewer,
  dealId: string
) {
  const repository = getRepository();
  await repository.savePendingExtraction(dealId, null);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return repository.getDealAggregate(viewer.id, dealId);
}
