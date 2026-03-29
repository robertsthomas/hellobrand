import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { DeleteWorkspaceConfirmationForm } from "@/components/delete-workspace-confirmation-form";
import { requireViewer } from "@/lib/auth";
import { getCachedDealForViewer } from "@/lib/cached-data";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { listLinkedEmailThreadsForViewerDeal } from "@/lib/email/service";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { formatCurrency, formatDate } from "@/lib/utils";

function safeRedirectTarget(input: string | undefined, fallback: string) {
  if (!input || !input.startsWith("/app")) {
    return fallback;
  }

  return input;
}

export default async function DeletePartnershipPage({
  params,
  searchParams
}: {
  params: Promise<{ dealId: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { dealId } = await params;
  const resolvedSearchParams = await searchParams;
  const viewer = await requireViewer();
  const aggregate = await getCachedDealForViewer(viewer, dealId);

  if (!aggregate) {
    notFound();
  }

  const normalized = buildNormalizedIntakeRecord(aggregate);
  const labels = getDisplayDealLabels({
    brandName: normalized?.brandName ?? aggregate.deal.brandName,
    campaignName: normalized?.contractTitle ?? aggregate.deal.campaignName
  });
  const dealName = labels.campaignName ?? aggregate.deal.campaignName;
  const brandName = labels.brandName ?? aggregate.deal.brandName;
  const paymentAmount =
    aggregate.paymentRecord?.amount ?? aggregate.terms?.paymentAmount ?? null;
  const paymentCurrency =
    aggregate.paymentRecord?.currency ?? aggregate.terms?.currency ?? "USD";
  const invoiceDocumentCount = aggregate.documents.filter(
    (document) => document.documentKind === "invoice"
  ).length;
  const linkedThreads = await listLinkedEmailThreadsForViewerDeal(viewer, dealId);
  const redirectTo = safeRedirectTarget(
    resolvedSearchParams.redirectTo,
    `/app/p/${dealId}`
  );

  const lossItems = [
    {
      label: "Tracked payment",
      value:
        typeof paymentAmount === "number"
          ? formatCurrency(paymentAmount, paymentCurrency)
          : "Not specified"
    },
    {
      label: "Documents",
      value: `${aggregate.documents.length} file${aggregate.documents.length === 1 ? "" : "s"}`
    },
    {
      label: "Summaries",
      value: `${aggregate.summaries.length} version${aggregate.summaries.length === 1 ? "" : "s"}`
    },
    {
      label: "Linked emails",
      value: `${linkedThreads.length} thread${linkedThreads.length === 1 ? "" : "s"}`
    },
    {
      label: "Invoices",
      value: `${aggregate.invoiceRecord ? 1 : 0} record, ${invoiceDocumentCount} file${invoiceDocumentCount === 1 ? "" : "s"}`
    }
  ];

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link
          href={redirectTo}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.05em] text-foreground">
            Delete {dealName}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {brandName}, last updated {formatDate(aggregate.deal.updatedAt)}.
          </p>
        </div>

        <div className="border border-destructive/20 bg-destructive/[0.04] p-5 dark:border-destructive/30 dark:bg-destructive/[0.08]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm font-semibold text-foreground">
              This action cannot be undone. The following will be permanently deleted:
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 pl-8 sm:grid-cols-3">
            {lossItems.map((item) => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <DeleteWorkspaceConfirmationForm
          dealId={dealId}
          dealName={dealName}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
