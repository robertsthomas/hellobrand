import { computeTermsDiff } from "@/lib/pending-changes";
import type { DealTermsRecord, PendingExtractionData } from "@/lib/types";
import { PendingChangesPanel } from "@/components/pending-changes-panel";

export function PendingChangesBanner({
  dealId,
  terms
}: {
  dealId: string;
  terms: DealTermsRecord;
}) {
  if (!terms.pendingExtraction) {
    return null;
  }

  const diff = computeTermsDiff(
    terms,
    terms.pendingExtraction as PendingExtractionData
  );

  if (!diff.hasPendingChanges) {
    return null;
  }

  return <PendingChangesPanel dealId={dealId} diff={diff} />;
}
