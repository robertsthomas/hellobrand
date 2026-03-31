import Link from "next/link";

import { savePaymentAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { DocumentRecord, InvoiceLineItem, InvoiceRecord, PaymentRecord } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

function documentPreviewUrl(documentId: string) {
  return `/api/documents/${documentId}/content`;
}

function documentDownloadUrl(documentId: string) {
  return `/api/documents/${documentId}/content?download=1`;
}

function lineItemMeta(item: InvoiceLineItem) {
  return [item.channel, item.description].filter(Boolean).join(" · ");
}

export function PaymentsWorkspaceDetail({
  deal,
  payment,
  invoice,
  invoiceDocuments,
  breakdownItems,
  sendViaInboxHref
}: {
  deal: {
    id: string;
    brandName: string;
    campaignName: string;
  };
  payment: PaymentRecord;
  invoice: InvoiceRecord | null;
  invoiceDocuments: DocumentRecord[];
  breakdownItems: InvoiceLineItem[];
  sendViaInboxHref?: string | null;
}) {
  const breakdownCurrency = invoice?.currency ?? payment.currency ?? "USD";

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Payment breakdown
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoice
                ? "Using the current invoice line items for this workspace."
                : "Using the workspace deliverables to show how the total can split before an invoice is generated."}
            </p>
          </div>

          <Link
            href={`/app/p/${deal.id}?tab=${invoice ? "invoices" : "deliverables"}`}
            className="inline-flex border-b border-black/20 pb-1 text-sm font-medium text-foreground transition hover:border-black/50"
          >
            {invoice ? "Open invoice" : "Generate invoice"}
          </Link>
        </div>

        <div className="overflow-hidden border border-black/8 bg-white">
          <div className="grid grid-cols-[minmax(0,1.6fr)_90px_130px_130px] bg-[#f8f8f6] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
            <span>Item</span>
            <span>Qty</span>
            <span>Unit rate</span>
            <span>Amount</span>
          </div>
          <div className="divide-y divide-black/8">
            {breakdownItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,1.6fr)_90px_130px_130px] gap-3 px-4 py-4 text-sm text-foreground"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{item.title}</p>
                  {lineItemMeta(item) ? (
                    <p className="mt-1 text-xs text-muted-foreground">{lineItemMeta(item)}</p>
                  ) : null}
                </div>
                <span>{item.quantity}</span>
                <span>{formatCurrency(item.unitRate, breakdownCurrency)}</span>
                <span className="font-semibold">
                  {formatCurrency(item.amount, breakdownCurrency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border border-black/8 bg-white px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Invoice attachments
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoiceDocuments.length > 0
                ? `${invoiceDocuments.length} invoice document${invoiceDocuments.length === 1 ? "" : "s"} attached to this workspace.`
                : "No invoice PDF is attached yet."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {invoiceDocuments.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={documentPreviewUrl(document.id)}
                  target="_blank"
                  className="inline-flex border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
                >
                  Open {document.fileName}
                </Link>
                <Link
                  href={documentDownloadUrl(document.id)}
                  className="inline-flex border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
                >
                  Download PDF
                </Link>
              </div>
            ))}
            {invoice?.pdfDocumentId && invoice.status !== "voided" && sendViaInboxHref ? (
              <Link
                href={sendViaInboxHref}
                className="inline-flex border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
              >
                Send via linked inbox
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <form action={savePaymentAction} className="space-y-5 border border-black/8 bg-white p-5">
        <input type="hidden" name="dealId" value={deal.id} />

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Payment editor</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Update payout state
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep due dates and payment status current here. Invoice generation and attachments live in the workspace Invoices tab.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Amount
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              type="number"
              step="0.01"
              name="amount"
              defaultValue={payment.amount ?? ""}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Currency
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              name="currency"
              defaultValue={payment.currency ?? "USD"}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Invoice date
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              type="date"
              name="invoiceDate"
              defaultValue={payment.invoiceDate?.slice(0, 10) ?? ""}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Due date
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              type="date"
              name="dueDate"
              defaultValue={payment.dueDate?.slice(0, 10) ?? ""}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Paid date
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              type="date"
              name="paidDate"
              defaultValue={payment.paidDate?.slice(0, 10) ?? ""}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Status
            <select
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              name="status"
              defaultValue={payment.status}
            >
              <option value="not_invoiced">Not invoiced</option>
              <option value="awaiting_payment">Awaiting payment</option>
              <option value="paid">Paid</option>
              <option value="late" disabled>
                Late (calculated)
              </option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
            Notes
            <textarea
              className="min-h-28 border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              name="notes"
              defaultValue={payment.notes ?? ""}
            />
          </label>
        </div>

        <div className="grid gap-4 border-t border-black/8 pt-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Invoice
            </p>
            <p className="mt-2 text-foreground">
              {invoice?.invoiceNumber ?? "Not generated"}
              {invoice ? ` · ${invoice.status.replaceAll("_", " ")}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Issued
            </p>
            <p className="mt-2 text-foreground">{formatDate(invoice?.invoiceDate ?? payment.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Due
            </p>
            <p className="mt-2 text-foreground">{formatDate(invoice?.dueDate ?? payment.dueDate)}</p>
          </div>
        </div>

        {invoice?.sentAt ? (
          <div className="border-t border-black/8 pt-4 text-sm text-muted-foreground">
            Invoice sent {formatDate(invoice.sentAt)}
            {invoice.lastSentToEmail ? ` to ${invoice.lastSentToEmail}` : ""}.
          </div>
        ) : null}

        <div className="flex justify-end">
          <SubmitButton
            pendingLabel="Saving payment..."
            className="bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save payment
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
