import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BatchReviewPanel } from "@/components/batch-review-panel";
import { IntakeBatchReviewHeader } from "@/components/patterns/intake";
import { CardSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { batchIntakeEnabled } from "@/flags";
import { getBatchForViewer } from "@/lib/intake";
import { getRepository } from "@/lib/repository";

export default function BatchReviewPage({ params }: { params: Promise<{ batchId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <div className="mx-auto max-w-4xl">
            <CardSkeleton />
          </div>
        </div>
      }
    >
      <BatchReviewContent params={params} />
    </Suspense>
  );
}

async function BatchReviewContent({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  if ((await batchIntakeEnabled()) !== true) {
    notFound();
  }
  const viewer = await requireViewer();

  let batch;
  try {
    batch = await getBatchForViewer(viewer, batchId);
  } catch {
    notFound();
  }

  const allDocumentIds = batch.groups.flatMap((g) => g.documentIds);
  const documentNames: Record<string, string> = {};

  for (const docId of allDocumentIds) {
    const doc = await getRepository().getDocument(docId);
    if (doc) {
      documentNames[docId] = doc.fileName;
    }
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <IntakeBatchReviewHeader />

        <BatchReviewPanel batch={batch} documentNames={documentNames} />
      </div>
    </div>
  );
}
