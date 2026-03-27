import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PaymentsWorkspaceDetail } from "@/components/payments-workspace-detail";
import { PaymentsSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { getCachedDealForViewer } from "@/lib/cached-data";
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
  const aggregate = await getCachedDealForViewer(viewer, dealId);

  if (!aggregate) {
    notFound();
  }

  const payment =
    aggregate.paymentRecord ?? {
      id: `payment-${aggregate.deal.id}`,
      dealId: aggregate.deal.id,
      amount: aggregate.terms?.paymentAmount ?? null,
      currency: aggregate.terms?.currency ?? "USD",
      invoiceDate: null,
      dueDate: null,
      paidDate: null,
      status: aggregate.deal.paymentStatus,
      notes: null,
      source: null,
      createdAt: aggregate.deal.createdAt,
      updatedAt: aggregate.deal.updatedAt
    };
  const invoice = aggregate.invoiceRecord ?? null;
  const invoiceDocuments = aggregate.documents.filter((document) => document.documentKind === "invoice");
  const breakdownItems =
    invoice?.lineItems.length
      ? invoice.lineItems
      : buildInvoiceLineItems({
          deliverables: aggregate.terms?.deliverables ?? [],
          amount: aggregate.paymentRecord?.amount ?? aggregate.terms?.paymentAmount ?? null,
          fallbackTitle: aggregate.deal.campaignName
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
              {aggregate.deal.campaignName}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {aggregate.deal.brandName} · Total {formatCurrency(payment.amount, payment.currency ?? "USD")} · Due {formatDate(payment.dueDate)}
            </p>
          </div>
        </section>

        <PaymentsWorkspaceDetail
          deal={aggregate.deal}
          payment={payment}
          invoice={invoice}
          invoiceDocuments={invoiceDocuments}
          breakdownItems={breakdownItems}
        />
      </div>
    </div>
  );
}
