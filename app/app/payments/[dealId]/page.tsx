import { Suspense } from "react";
import { notFound } from "next/navigation";

import {
  PaymentsSkeleton,
  PaymentsWorkspaceDetail,
  PaymentsWorkspaceHeader,
} from "@/components/payments";
import { requireViewer } from "@/lib/auth";
import { getCachedDealForViewer } from "@/lib/cached-data";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { listLinkedEmailThreadsForViewerDeal } from "@/lib/email/service";
import { buildInvoiceLineItems } from "@/lib/invoices";
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

// fallow-ignore-next-line complexity
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
        <PaymentsWorkspaceHeader
          campaignName={displayDeal.campaignName}
          brandName={displayDeal.brandName}
          amount={payment.amount}
          currency={payment.currency}
          dueDate={payment.dueDate}
        />

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
