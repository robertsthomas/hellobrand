import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BatchReviewPanel } from "@/components/batch-review-panel";
import { requireViewer } from "@/lib/auth";
import { getBatchForViewer } from "@/lib/intake";
import { getRepository } from "@/lib/repository";

export default async function BatchReviewPage({
  params
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
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
        <section className="space-y-4">
          <Link
            href="/app/intake/new"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to intake
          </Link>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
              Bulk intake
            </p>
            <h1 className="text-4xl font-semibold text-ink">
              Review detected deals
            </h1>
            <p className="text-[17px] leading-8 text-black/60 dark:text-white/65">
              We detected multiple deals in your uploaded documents. Review the
              groupings below, reassign documents if needed, then create each deal.
            </p>
          </div>
        </section>

        <BatchReviewPanel batch={batch} documentNames={documentNames} />
      </div>
    </div>
  );
}
