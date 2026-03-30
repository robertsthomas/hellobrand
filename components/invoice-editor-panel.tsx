"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  finalizeInvoiceAction,
  generateInvoiceDraftAction,
  saveInvoiceDraftAction
} from "@/app/actions";
import { AssistantTriggerButton } from "@/components/assistant-trigger-button";
import { SubmitButton } from "@/components/submit-button";
import type {
  DocumentRecord,
  InvoiceLineItem,
  InvoiceRecord,
  PaymentStatus
} from "@/lib/types";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

function createClientLineItemId() {
  if (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    "randomUUID" in window.crypto
  ) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createLineItem(): InvoiceLineItem {
  return {
    id: createClientLineItemId(),
    deliverableId: null,
    title: "",
    description: null,
    channel: null,
    quantity: 1,
    unitRate: 0,
    amount: 0
  };
}

function updateLineItemAmount(item: InvoiceLineItem) {
  return {
    ...item,
    amount: Math.round(item.quantity * item.unitRate * 100) / 100
  };
}

function documentPreviewUrl(documentId: string) {
  return `/api/documents/${documentId}/content`;
}

export function InvoiceEditorPanel({
  dealId,
  invoice,
  invoiceDocuments,
  paymentStatus,
  paymentTerms
}: {
  dealId: string;
  invoice: InvoiceRecord | null;
  invoiceDocuments: DocumentRecord[];
  paymentStatus: PaymentStatus;
  paymentTerms: string | null;
}) {
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    invoice?.lineItems.length ? invoice.lineItems : [createLineItem()]
  );

  const subtotal = useMemo(
    () => Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
    [lineItems]
  );

  const lineItemsJson = useMemo(() => JSON.stringify(lineItems), [lineItems]);
  const paymentTriggerPrompt =
    paymentStatus === "late" || paymentStatus === "awaiting_payment" || paymentStatus === "invoiced"
      ? "Draft a concise creator-professional payment follow-up email for this partnership. Reference the saved workspace payment timing, ask what is still needed, and keep the tone firm but professional."
      : `Draft a concise creator-professional email asking the brand to confirm payment timing and invoice requirements for this partnership. The current workspace payment terms are ${paymentTerms ?? "not fully clear"}.`;

  const updateItem = (
    id: string,
    patch: Partial<Pick<InvoiceLineItem, "title" | "description" | "channel" | "quantity" | "unitRate">>
  ) => {
    setLineItems((current) =>
      current.map((item) =>
        item.id === id ? updateLineItemAmount({ ...item, ...patch }) : item
      )
    );
  };

  if (!invoice) {
    return (
      <section className="space-y-6 border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#161a1f] sm:p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
            Invoices
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            Generate a workspace invoice
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            HelloBrand will prefill the invoice from your workspace amount, dates, and
            deliverables. Review it, edit anything you need, and finalize when ready.
          </p>
        </div>

        <form action={generateInvoiceDraftAction}>
          <input type="hidden" name="dealId" value={dealId} />
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton
              pendingLabel="Generating invoice..."
              className="inline-flex items-center justify-center bg-primary px-5 py-3 text-sm font-semibold text-white"
            >
              Generate invoice
            </SubmitButton>
            <AssistantTriggerButton
              label={
                paymentStatus === "late" ||
                paymentStatus === "awaiting_payment" ||
                paymentStatus === "invoiced"
                  ? "Draft payment follow-up"
                  : "Clarify payment timing"
              }
              trigger={{
                kind: "payment",
                sourceId: dealId,
                label:
                  paymentStatus === "late" ||
                  paymentStatus === "awaiting_payment" ||
                  paymentStatus === "invoiced"
                    ? "Follow up on payment"
                    : "Clarify payment timing",
                prompt: paymentTriggerPrompt
              }}
            />
          </div>
        </form>

        {invoiceDocuments.length > 0 ? (
          <div className="space-y-3 border-t border-black/8 pt-5 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Attached invoices
            </p>
            {invoiceDocuments.map((document) => (
              <Link
                key={document.id}
                href={documentPreviewUrl(document.id)}
                target="_blank"
                className="flex items-center justify-between border border-black/8 px-4 py-3 text-sm transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
              >
                <span>{document.fileName}</span>
                <span className="text-muted-foreground">Open</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-6 border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#161a1f] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
            Workspace invoice
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            {invoice.invoiceNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            Status: {humanizeToken(invoice.status)} · Invoice date {formatDate(invoice.invoiceDate)} · Due {formatDate(invoice.dueDate)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(paymentStatus === "late" ||
            paymentStatus === "awaiting_payment" ||
            paymentStatus === "invoiced") ? (
            <AssistantTriggerButton
              label="Draft payment follow-up"
              trigger={{
                kind: "payment",
                sourceId: invoice.id,
                label: "Follow up on payment",
                prompt: paymentTriggerPrompt
              }}
            />
          ) : null}
          {invoice.pdfDocumentId ? (
            <Link
              href={documentPreviewUrl(invoice.pdfDocumentId)}
              target="_blank"
              className="inline-flex border-b border-black/20 pb-1 text-sm font-medium text-foreground transition hover:border-black/50"
            >
              Open finalized PDF
            </Link>
          ) : null}
        </div>
      </div>

      <form className="space-y-6">
        <input type="hidden" name="dealId" value={dealId} />
        <input type="hidden" name="lineItemsJson" value={lineItemsJson} />
        <input type="hidden" name="pdfDocumentId" value={invoice.pdfDocumentId ?? ""} />
        <input
          type="hidden"
          name="manualNumberOverride"
          value={invoice.manualNumberOverride ? "true" : "false"}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
            Invoice number
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              name="invoiceNumber"
              defaultValue={invoice.invoiceNumber}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Invoice date
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              type="date"
              name="invoiceDate"
              defaultValue={invoice.invoiceDate?.slice(0, 10) ?? ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Due date
            <input
              className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              type="date"
              name="dueDate"
              defaultValue={invoice.dueDate?.slice(0, 10) ?? ""}
            />
          </label>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                Bill to
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Contact name
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="billToName" defaultValue={invoice.billTo.name} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Contact email
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="billToEmail" defaultValue={invoice.billTo.email ?? ""} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                Company
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="billToCompanyName" defaultValue={invoice.billTo.companyName ?? ""} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                Address
                <textarea className="min-h-24 border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="billToAddress" defaultValue={invoice.billTo.address ?? ""} />
              </label>
              <input type="hidden" name="billToTaxId" value={invoice.billTo.taxId ?? ""} />
              <input type="hidden" name="billToPayoutDetails" value={invoice.billTo.payoutDetails ?? ""} />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                From
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Name
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="issuerName" defaultValue={invoice.issuer.name} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Email
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="issuerEmail" defaultValue={invoice.issuer.email ?? ""} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                Business
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="issuerCompanyName" defaultValue={invoice.issuer.companyName ?? ""} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Tax ID
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="issuerTaxId" defaultValue={invoice.issuer.taxId ?? ""} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Currency
                <input className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="currency" defaultValue={invoice.currency ?? "USD"} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                Address
                <textarea className="min-h-24 border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="issuerAddress" defaultValue={invoice.issuer.address ?? ""} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                Payout details
                <textarea className="min-h-24 border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20" name="issuerPayoutDetails" defaultValue={invoice.issuer.payoutDetails ?? ""} />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-black/8 pt-5 dark:border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                Itemized invoice
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generated from your workspace deliverables. Edit if the billing breakdown needs to change.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLineItems((current) => [...current, createLineItem()])}
              className="inline-flex items-center gap-2 border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="grid gap-3 border border-black/8 p-3 dark:border-white/10 sm:p-4 md:grid-cols-[minmax(0,1.6fr)_110px_140px_140px_auto]">
                <div className="space-y-3">
                  <input
                    className="w-full border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/20"
                    value={item.title}
                    onChange={(event) => updateItem(item.id, { title: event.currentTarget.value })}
                    placeholder="Line item title"
                  />
                  <textarea
                    className="min-h-20 w-full border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/20"
                    value={item.description ?? ""}
                    onChange={(event) =>
                      updateItem(item.id, { description: event.currentTarget.value || null })
                    }
                    placeholder="Description"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 md:contents">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                    Qty
                    <input
                      className="border border-black/10 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-black/20"
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.id, {
                          quantity: Math.max(Number(event.currentTarget.value || 1), 1)
                        })
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                    Unit rate
                    <input
                      className="border border-black/10 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-black/20"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitRate}
                      onChange={(event) =>
                        updateItem(item.id, {
                          unitRate: Math.max(Number(event.currentTarget.value || 0), 0)
                        })
                      }
                    />
                  </label>
                  <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                    Amount
                    <div className="flex items-center border border-black/10 px-3 py-2 text-sm font-semibold text-foreground">
                      {formatCurrency(item.amount, invoice.currency ?? "USD")}
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setLineItems((current) =>
                        current.length === 1
                          ? current
                          : current.filter((entry) => entry.id !== item.id)
                      )
                    }
                    className="inline-flex items-center gap-2 border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 border-t border-black/8 pt-5 dark:border-white/10 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Notes
            <textarea
              className="min-h-28 border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
              name="notes"
              defaultValue={invoice.notes ?? ""}
            />
          </label>
          <div className="space-y-3 border border-black/8 p-4 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Subtotal
            </p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              {formatCurrency(subtotal, invoice.currency ?? "USD")}
            </p>
            <p className="text-sm text-muted-foreground">
              Finalized invoices are attached back to this workspace and visible here.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/8 pt-5 dark:border-white/10">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{invoiceDocuments.length} attached invoice document{invoiceDocuments.length === 1 ? "" : "s"}</p>
            {invoice.finalizedAt ? <p>Finalized {formatDate(invoice.finalizedAt)}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton
              formAction={saveInvoiceDraftAction}
              pendingLabel="Saving invoice draft..."
              className="inline-flex items-center justify-center border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:bg-[#f7f5f1]"
            >
              Save draft
            </SubmitButton>
            <SubmitButton
              formAction={finalizeInvoiceAction}
              pendingLabel="Finalizing invoice..."
              className="inline-flex items-center justify-center bg-primary px-5 py-2 text-sm font-semibold text-white"
            >
              Finalize and attach PDF
            </SubmitButton>
          </div>
        </div>
      </form>

      {invoiceDocuments.length > 0 ? (
        <div className="space-y-3 border-t border-black/8 pt-5 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
            Attached invoices
          </p>
          {invoiceDocuments.map((document) => (
            <Link
              key={document.id}
              href={documentPreviewUrl(document.id)}
              target="_blank"
              className="flex items-center justify-between border border-black/8 px-4 py-3 text-sm transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
            >
              <span>{document.fileName}</span>
              <span className="text-muted-foreground">Open</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
