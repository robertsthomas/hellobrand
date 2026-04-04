import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PaymentsWorkspaceDetail } from "@/components/payments-workspace-detail";
import { PaymentsSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { getCachedDealForViewer } from "@/lib/cached-data";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { listLinkedEmailThreadsForViewerDeal } from "@/lib/email/service";
import { buildInvoiceLineItems } from "@/lib/invoices";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function PaymentWorkspacePage({
  params
}: {
  params: Promise<{ dealId: string }>;
}) {
  return (
    <Suspense fallback={<PaymentsSkeleton />}>
      <PaymentWorkspaceContent params={params} />
    </Suspense>
  );
}

async function PaymentWorkspaceContent({
  params
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const viewer = await requireViewer();
  const [aggregate, linkedEmailThreads] = await Promise.all([
    getCachedDealForViewer(viewer, dealId),
    listLinkedEmailThreadsForViewerDeal(viewer, dealId)
  ]);

  if (!aggregate) {
    notFound();
  }

  const labels = getDisplayDealLabels(aggregate.deal);
  const displayDeal = {
    ...aggregate.deal,
    brandName: labels.brandName ?? aggregate.deal.brandName,
    campaignName: labels.campaignName ?? aggregate.deal.campaignName
  };

  const payment =
    aggregate.paymentRecord ?? {
      id: `payment-${displayDeal.id}`,
      dealId: displayDeal.id,
      amount: aggregate.terms?.paymentAmount ?? null,
      currency: aggregate.terms?.currency ?? "USD",
      invoiceDate: null,
      dueDate: null,
      paidDate: null,
      status: displayDeal.paymentStatus,
      notes: null,
      source: null,
      createdAt: displayDeal.createdAt,
      updatedAt: displayDeal.updatedAt
    };
  const invoice = aggregate.invoiceRecord ?? null;
  const invoiceDocuments = aggregate.documents.filter((document) => document.documentKind === "invoice");
  const sendViaInboxHref =
    invoice?.pdfDocumentId && linkedEmailThreads[0]?.thread.id
      ? `/app/inbox?dealId=${displayDeal.id}&thread=${linkedEmailThreads[0].thread.id}&attachInvoice=1`
      : null;
  const breakdownItems =
    invoice?.lineItems.length
      ? invoice.lineItems
        : buildInvoiceLineItems({
            deliverables: aggregate.terms?.deliverables ?? [],
            amount: aggregate.paymentRecord?.amount ?? aggregate.terms?.paymentAmount ?? null,
            fallbackTitle: displayDeal.campaignName,
            paymentStructure: aggregate.terms?.paymentStructure ?? null,
            revisionRounds: aggregate.terms?.revisionRounds ?? null
          });

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <section className="space-y-5 border-b border-black/8 pb-8">
          <Link
            href="/app/payments"
            className="inline-flex border-b border-black/20 pb-1 text-sm font-medium text-foreground transition hover:border-black/50"
          >
            Back to payments
          </Link>

          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
              Payments
            </p>
            <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.06em] text-foreground">
              {displayDeal.campaignName}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {displayDeal.brandName} · Total {formatCurrency(payment.amount, payment.currency ?? "USD")} · Due {formatDate(payment.dueDate)}
            </p>
          </div>
        </section>

        <PaymentsWorkspaceDetail
          deal={displayDeal}
          payment={payment}
          invoice={invoice}
          invoiceDocuments={invoiceDocuments}
          breakdownItems={breakdownItems}
          sendViaInboxHref={sendViaInboxHref}
        />
      </div>
    </div>
  );
}
