/**
 * Terms update, confirmation, and notes operations for deals.
 */
import { syncPaymentRecordForDeal } from "@/lib/payments";
import { getRepository } from "@/lib/repository";
import type { DealTermsRecord, Viewer } from "@/lib/types";
import {
  createEmptyTerms,
  detectChangedFields,
  earliestDeliverableDate,
  getPreferredCreatorNameForViewer,
  mergeTerms,
  queueAssistantSnapshotRefresh,
  withPreferredCreatorName,
} from "./shared";

export async function updateTermsForViewer(
  viewer: Viewer,
  dealId: string,
  patch: Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
  const existing = withPreferredCreatorName(
    aggregate.terms ?? createEmptyTerms(aggregate.deal),
    preferredCreatorName
  );
  const changedFields = detectChangedFields(existing, patch);
  const nextManualEdits = Array.from(new Set([
    ...(aggregate.terms?.manuallyEditedFields ?? []),
    ...changedFields,
    ...(patch.manuallyEditedFields ?? [])
  ]));

  const nextTerms = mergeTerms(
    existing,
    { ...patch, manuallyEditedFields: nextManualEdits }
  );
  nextTerms.manuallyEditedFields = nextManualEdits;
  if ("pendingExtraction" in patch) {
    nextTerms.pendingExtraction = patch.pendingExtraction ?? null;
  }
  const terms = await getRepository().upsertTerms(dealId, nextTerms);
  if (process.env.DATABASE_URL) {
    await syncPaymentRecordForDeal(dealId, nextTerms);
  }

  await getRepository().updateDeal(viewer.id, dealId, {
    nextDeliverableDate: earliestDeliverableDate(nextTerms),
    brandName: nextTerms.brandName ?? aggregate.deal.brandName,
    campaignName: nextTerms.campaignName ?? aggregate.deal.campaignName
  });

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return terms;
}

export async function confirmTermsFieldForViewer(
  viewer: Viewer,
  dealId: string,
  fieldPath: string
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
  const existing = withPreferredCreatorName(
    aggregate.terms ?? createEmptyTerms(aggregate.deal),
    preferredCreatorName
  );
  const nextManualEdits = Array.from(
    new Set([...(existing.manuallyEditedFields ?? []), fieldPath])
  );

  const nextTerms = {
    ...existing,
    manuallyEditedFields: nextManualEdits
  };

  const terms = await getRepository().upsertTerms(dealId, nextTerms);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return terms;
}

export async function updateDealNotesForViewer(
  viewer: Viewer,
  dealId: string,
  notes: string | null
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const nextTerms = mergeTerms(
    withPreferredCreatorName(
      aggregate.terms ?? createEmptyTerms(aggregate.deal),
      await getPreferredCreatorNameForViewer(viewer)
    ),
    { notes }
  );
  const terms = await getRepository().upsertTerms(dealId, nextTerms);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return terms;
}
