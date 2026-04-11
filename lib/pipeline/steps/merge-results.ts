/**
 * This file merges a document extraction into the deal aggregate.
 * It owns the auto-apply decision, pending changes persistence, and aggregate-level updates.
 */
import {
  createEmptyTerms,
  earliestDeliverableDate,
  getPreferredCreatorNameForViewer,
  mergeTerms,
  withPreferredCreatorName
} from "@/lib/document-pipeline-shared";
import { syncPaymentRecordForDeal } from "@/lib/payments";
import {
  coalesceExtractions,
  hasMeaningfulChanges,
  planExtractionMerge
} from "@/lib/pending-changes";
import { getRepository } from "@/lib/repository";
import { executePipelineStep, loadExtractionFromRecords } from "@/lib/pipeline/run-state";
import type { DealAggregate, PendingExtractionData } from "@/lib/types";

export async function runMergeResultsStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "merge_results" }, async ({ document, viewer }) => {
    const repository = getRepository();
    const extraction = await loadExtractionFromRecords(document);
    const latestAggregate = await repository.getDealAggregate(viewer.id, document.dealId);

    if (!latestAggregate) {
      throw new Error("Deal not found.");
    }

    const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
    const isFirstDocument = latestAggregate.terms === null;
    const existingTerms = latestAggregate.terms ?? createEmptyTerms(latestAggregate.deal);
    const isIntakeDocument =
      latestAggregate.deal.confirmedAt &&
      document.createdAt <= latestAggregate.deal.confirmedAt;
    const currentTerms = withPreferredCreatorName(existingTerms, preferredCreatorName) as DealAggregate["terms"] extends infer T
      ? NonNullable<T>
      : never;
    const mergePlan = planExtractionMerge(currentTerms, extraction);
    const nextTerms = mergeTerms(currentTerms, mergePlan.autoApplied, {
      manuallyEditedFields: latestAggregate.terms?.manuallyEditedFields ?? []
    });

    const shouldPersistTerms =
      isFirstDocument ||
      isIntakeDocument ||
      hasMeaningfulChanges(currentTerms, mergePlan.autoApplied);

    if (shouldPersistTerms) {
      await repository.upsertTerms(document.dealId, nextTerms);
      if (process.env.DATABASE_URL) {
        await syncPaymentRecordForDeal(document.dealId, nextTerms);
      }
    }

    if (mergePlan.hasPendingChanges) {
      const existingPending = latestAggregate.terms?.pendingExtraction as PendingExtractionData | null;
      const pendingData = existingPending
        ? coalesceExtractions(existingPending, mergePlan.pending, (base, patch) => {
            const full = { ...base, pendingExtraction: null };
            const merged = mergeTerms(full, patch);
            const { pendingExtraction: _pending, ...rest } = merged;
            return rest as PendingExtractionData;
          })
        : mergePlan.pending;

      await repository.savePendingExtraction(document.dealId, pendingData);
    }

    await repository.updateDeal(viewer.id, document.dealId, {
      analyzedAt: new Date().toISOString(),
      nextDeliverableDate: earliestDeliverableDate(nextTerms),
      brandName: nextTerms.brandName ?? latestAggregate.deal.brandName,
      campaignName: nextTerms.campaignName ?? latestAggregate.deal.campaignName
    });

    return extraction;
  });
}
