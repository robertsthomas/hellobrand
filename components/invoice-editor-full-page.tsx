"use client";

/**
 * This file renders the full-page invoice editor.
 * It manages the local invoice editing experience while numbering, reminders, and persistence stay in `lib/invoices`.
 */
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { InvoicePreview } from "@/components/invoice-preview";
import type { EmailThreadListItem } from "@/lib/types";

import {
  deleteInvoiceAction,
  finalizeInvoiceAction,
  regenerateInvoiceDraftAction,
  saveInvoiceDraftAction,
  voidInvoiceAction,
} from "@/app/actions";
import { AssistantTriggerButton } from "@/components/assistant-trigger-button";
import { SubmitButton } from "@/components/submit-button";
import type {
  DocumentRecord,
  InvoiceDeliveryRecord,
  InvoiceLineItem,
  InvoiceRecord,
  PaymentStatus,
} from "@/lib/types";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

function createClientLineItemId() {
  if (typeof window !== "undefined" && "randomUUID" in (window.crypto ?? {})) {
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
    amount: 0,
  };
}

function updateLineItemAmount(item: InvoiceLineItem) {
  return { ...item, amount: Math.round(item.quantity * item.unitRate * 100) / 100 };
}

function FormLoadingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-[2px] dark:bg-[#111318]/80">
      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        Processing...
      </div>
    </div>
  );
}

const inputClass =
  "w-full border border-black/10 bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring dark:border-white/12 dark:bg-white/[0.03] dark:focus:border-ring";
const textareaClass = `${inputClass} min-h-24`;

function statusBadgeClass(status: string) {
  if (status === "draft")
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  if (status === "finalized")
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (status === "sent")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/60";
}

// fallow-ignore-next-line complexity
export function InvoiceEditorFullPage({
  dealId,
  invoice,
  invoiceDeliveries = [],
  invoiceDocuments,
  paymentStatus,
  paymentTerms,
  linkedThreads = [],
  hasPremiumInbox = false,
}: {
  dealId: string;
  invoice: InvoiceRecord;
  invoiceDeliveries?: InvoiceDeliveryRecord[];
  invoiceDocuments: DocumentRecord[];
  paymentStatus: PaymentStatus;
  paymentTerms: string | null;
  linkedThreads?: EmailThreadListItem[];
  hasPremiumInbox?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    invoice.lineItems.length ? invoice.lineItems : [createLineItem()]
  );
  const [showPreview, setShowPreview] = useState(false);

  const subtotal = useMemo(
    () => Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
    [lineItems]
  );

  const lineItemsJson = useMemo(() => JSON.stringify(lineItems), [lineItems]);

  const updateItem = (
    id: string,
    patch: Partial<
      Pick<InvoiceLineItem, "title" | "description" | "channel" | "quantity" | "unitRate">
    >
  ) => {
    setLineItems((current) =>
      current.map((item) => (item.id === id ? updateLineItemAmount({ ...item, ...patch }) : item))
    );
  };

  const readFormField = useCallback((name: string) => {
    if (!formRef.current) return "";
    const el = formRef.current.elements.namedItem(name);
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return el.value;
    }
    return "";
  }, []);

// fallow-ignore-next-line complexity
  const previewData = useMemo(() => {
    if (!showPreview) return null;
    return {
      invoiceNumber: readFormField("invoiceNumber") || invoice.invoiceNumber,
      invoiceDate: readFormField("invoiceDate") || invoice.invoiceDate,
      dueDate: readFormField("dueDate") || invoice.dueDate,
      currency: readFormField("currency") || invoice.currency || "USD",
      billTo: {
        name: readFormField("billToName") || invoice.billTo.name,
        email: readFormField("billToEmail") || invoice.billTo.email,
        companyName: readFormField("billToCompanyName") || invoice.billTo.companyName,
        address: readFormField("billToAddress") || invoice.billTo.address,
        taxId: readFormField("billToTaxId") || invoice.billTo.taxId,
        payoutDetails: invoice.billTo.payoutDetails,
      },
      issuer: {
        name: readFormField("issuerName") || invoice.issuer.name,
        email: readFormField("issuerEmail") || invoice.issuer.email,
        companyName: readFormField("issuerCompanyName") || invoice.issuer.companyName,
        address: readFormField("issuerAddress") || invoice.issuer.address,
        taxId: readFormField("issuerTaxId") || invoice.issuer.taxId,
        payoutDetails: readFormField("issuerPayoutDetails") || invoice.issuer.payoutDetails,
      },
      lineItems,
      subtotal,
      notes: readFormField("notes") || invoice.notes,
    };
  }, [showPreview, lineItems, subtotal, invoice]);

  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reuseNumber, setReuseNumber] = useState(false);

  const isReadOnly = invoice.status === "voided";
  const isDraft = invoice.status === "draft";
  const isFinalized = invoice.status === "finalized" || invoice.status === "sent";
  const hasPaymentFollowUp =
    paymentStatus === "late" ||
    paymentStatus === "awaiting_payment" ||
    paymentStatus === "invoiced";
  const hasPdf = Boolean(invoice.pdfDocumentId);

  const issuerMissingFields = [
    !invoice.issuer.companyName?.trim() && "business name",
    !invoice.issuer.address?.trim() && "address",
    !invoice.issuer.taxId?.trim() && "tax ID",
  ].filter(Boolean) as string[];

  return (
    <div className="mt-6 space-y-8">
      {/* Profile prefill banner */}
      {isDraft && issuerMissingFields.length > 0 ? (
        <div className="border border-black/8 bg-[#f7f4ed] px-4 py-3 dark:border-white/10 dark:bg-[#16181d]">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Missing {issuerMissingFields.join(", ")}</span> in your
            issuer details.{" "}
            <Link
              href="/app/settings/profile"
              className="font-medium underline underline-offset-4 transition hover:text-primary"
            >
              Set up your creator profile
            </Link>{" "}
            to prefill these for future invoices.
          </p>
        </div>
      ) : null}

      {/* Header */}
      <div className="space-y-4 border-b border-black/8 pb-6 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
                {invoice.invoiceNumber}
              </h1>
              <span
                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusBadgeClass(invoice.status)}`}
              >
                {humanizeToken(invoice.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(invoice.invoiceDate)} · Due {formatDate(invoice.dueDate)}
            </p>
            {invoice.sentAt ? (
              <p className="text-sm text-muted-foreground">
                Sent {formatDate(invoice.sentAt)}
                {invoice.lastSentToEmail ? ` to ${invoice.lastSentToEmail}` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`inline-flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-medium transition ${
              showPreview
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-black/10 text-foreground hover:border-black/20 dark:border-white/10"
            }`}
          >
            {showPreview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        {/* Action bar: scrollable on mobile */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap">
            {hasPaymentFollowUp ? (
              <AssistantTriggerButton
                label="Draft follow-up"
                trigger={{
                  kind: "payment",
                  sourceId: invoice.id,
                  label: "Follow up on payment",
                  prompt:
                    "Draft a concise creator-professional payment follow-up email for this partnership.",
                }}
              />
            ) : null}
            {hasPdf ? (
              <>
                <Link
                  href={`/api/documents/${invoice.pdfDocumentId}/content`}
                  target="_blank"
                  className="inline-flex shrink-0 items-center gap-2 border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20 dark:border-white/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View PDF
                </Link>
                <Link
                  href={`/api/documents/${invoice.pdfDocumentId}/content?download=1`}
                  className="inline-flex shrink-0 items-center gap-2 border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20 dark:border-white/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Link>
              </>
            ) : null}
            {/* Attach to email */}
            {hasPdf && isFinalized && hasPremiumInbox && !isReadOnly ? (
              linkedThreads.length === 1 ? (
                <Link
                  href={`/app/inbox?dealId=${dealId}&thread=${linkedThreads[0].thread.id}&attachInvoice=1`}
                  className="inline-flex shrink-0 items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Attach to email
                </Link>
              ) : linkedThreads.length > 1 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEmailMenuOpen((v) => !v)}
                    className="inline-flex shrink-0 items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Attach to email
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {emailMenuOpen ? (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setEmailMenuOpen(false)} />
                      <div className="fixed inset-x-4 top-auto z-50 mt-1 border border-black/10 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-80 dark:border-white/10 dark:bg-card">
                        <div className="max-h-64 overflow-y-auto">
                          <p className="border-b border-black/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:border-white/10">
                            Choose a thread
                          </p>
                          {linkedThreads.map((item) => (
                            <Link
                              key={item.thread.id}
                              href={`/app/inbox?dealId=${dealId}&thread=${item.thread.id}&attachInvoice=1`}
                              onClick={() => setEmailMenuOpen(false)}
                              className="block border-b border-black/6 px-4 py-3 transition last:border-b-0 hover:bg-sand/50 dark:border-white/8 dark:hover:bg-white/[0.03]"
                            >
                              <p className="truncate text-sm font-medium text-foreground">
                                {item.thread.subject}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {item.account.emailAddress} ·{" "}
                                {formatDate(item.thread.lastMessageAt)}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <Link
                  href={`/app/inbox?dealId=${dealId}`}
                  className="inline-flex shrink-0 items-center gap-2 border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20 dark:border-white/10"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Link an email first
                </Link>
              )
            ) : hasPdf && isFinalized && !hasPremiumInbox && !isReadOnly ? (
              <div className="shrink-0 border border-black/8 bg-sand/25 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                Email sending on Premium
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Live preview */}
      {showPreview && previewData ? (
        <InvoicePreview
          invoiceNumber={previewData.invoiceNumber}
          invoiceDate={previewData.invoiceDate}
          dueDate={previewData.dueDate}
          currency={previewData.currency}
          billTo={previewData.billTo}
          issuer={previewData.issuer}
          lineItems={previewData.lineItems}
          subtotal={previewData.subtotal}
          notes={previewData.notes}
        />
      ) : null}

      {/* Form */}
      <form ref={formRef} className={`relative space-y-8 ${showPreview ? "hidden" : ""}`}>
        <FormLoadingOverlay />
        <input type="hidden" name="dealId" value={dealId} />
        <input type="hidden" name="lineItemsJson" value={lineItemsJson} />
        <input type="hidden" name="pdfDocumentId" value={invoice.pdfDocumentId ?? ""} />
        <input
          type="hidden"
          name="manualNumberOverride"
          value={invoice.manualNumberOverride ? "true" : "false"}
        />

        {/* Metadata */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
            Invoice number
            <input
              className={inputClass}
              name="invoiceNumber"
              defaultValue={invoice.invoiceNumber}
              readOnly={isReadOnly}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Invoice date
            <input
              className={inputClass}
              type="date"
              name="invoiceDate"
              defaultValue={invoice.invoiceDate?.slice(0, 10) ?? ""}
              readOnly={isReadOnly}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Due date
            <input
              className={inputClass}
              type="date"
              name="dueDate"
              defaultValue={invoice.dueDate?.slice(0, 10) ?? ""}
              readOnly={isReadOnly}
            />
          </label>
        </div>

        {/* Parties */}
        <div className="grid gap-8 xl:grid-cols-2">
          {/* Bill To */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Bill to
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Contact name
                <input
                  className={inputClass}
                  name="billToName"
                  defaultValue={invoice.billTo.name}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Email
                <input
                  className={inputClass}
                  name="billToEmail"
                  defaultValue={invoice.billTo.email ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Company
                <input
                  className={inputClass}
                  name="billToCompanyName"
                  defaultValue={invoice.billTo.companyName ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Address
                <textarea
                  className={textareaClass}
                  name="billToAddress"
                  defaultValue={invoice.billTo.address ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Tax ID
                <input
                  className={inputClass}
                  name="billToTaxId"
                  defaultValue={invoice.billTo.taxId ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <input
                type="hidden"
                name="billToPayoutDetails"
                value={invoice.billTo.payoutDetails ?? ""}
              />
            </div>
          </div>

          {/* Issuer */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              From (your details)
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Name
                <input
                  className={inputClass}
                  name="issuerName"
                  defaultValue={invoice.issuer.name}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Email
                <input
                  className={inputClass}
                  name="issuerEmail"
                  defaultValue={invoice.issuer.email ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Business
                <input
                  className={inputClass}
                  name="issuerCompanyName"
                  defaultValue={invoice.issuer.companyName ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Tax ID
                <input
                  className={inputClass}
                  name="issuerTaxId"
                  defaultValue={invoice.issuer.taxId ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Currency
                <input
                  className={inputClass}
                  name="currency"
                  defaultValue={invoice.currency ?? "USD"}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Address
                <textarea
                  className={textareaClass}
                  name="issuerAddress"
                  defaultValue={invoice.issuer.address ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Payout / remittance details
                <textarea
                  className={textareaClass}
                  name="issuerPayoutDetails"
                  defaultValue={invoice.issuer.payoutDetails ?? ""}
                  readOnly={isReadOnly}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="border-t border-black/8 pt-6 dark:border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Line items
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generated from workspace deliverables. Edit if the billing breakdown needs to
                change.
              </p>
            </div>
            {!isReadOnly ? (
              <button
                type="button"
                onClick={() => setLineItems((c) => [...c, createLineItem()])}
                className="inline-flex shrink-0 items-center gap-2 border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20 dark:border-white/10"
              >
                <Plus className="h-4 w-4" />
                Add item
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="border border-black/8 p-3 dark:border-white/10 sm:p-4">
                {/* Title + delete */}
                <div className="flex items-start gap-3">
                  <input
                    className={`${inputClass} flex-1`}
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.currentTarget.value })}
                    placeholder="Line item title"
                    aria-label="Line item title"
                    readOnly={isReadOnly}
                  />
                  {!isReadOnly ? (
                    <button
                      type="button"
                      aria-label={`Remove ${item.title || "line item"}`}
                      onClick={() =>
                        setLineItems((c) =>
                          c.length === 1 ? c : c.filter((e) => e.id !== item.id)
                        )
                      }
                      className="inline-flex h-[46px] w-10 shrink-0 items-center justify-center border border-red-200 text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {/* Channel + description */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    value={item.channel ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, { channel: e.currentTarget.value || null })
                    }
                    placeholder="Channel (e.g. Instagram)"
                    readOnly={isReadOnly}
                  />
                  <textarea
                    className={`${inputClass} min-h-16 sm:min-h-20`}
                    value={item.description ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, { description: e.currentTarget.value || null })
                    }
                    placeholder="Description"
                    readOnly={isReadOnly}
                  />
                </div>

                {/* Qty / Rate / Amount */}
                <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                  <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Qty
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, {
                          quantity: Math.max(Number(e.currentTarget.value || 1), 1),
                        })
                      }
                      readOnly={isReadOnly}
                    />
                  </label>
                  <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Rate
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitRate}
                      onChange={(e) =>
                        updateItem(item.id, {
                          unitRate: Math.max(Number(e.currentTarget.value || 0), 0),
                        })
                      }
                      readOnly={isReadOnly}
                    />
                  </label>
                  <div className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Amount
                    <div className="flex items-center border border-black/10 bg-sand/35 px-3 py-3 text-sm font-semibold text-foreground dark:border-white/12 dark:bg-white/[0.04]">
                      {formatCurrency(item.amount, invoice.currency ?? "USD")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes + Subtotal */}
        <div className="grid gap-6 border-t border-black/8 pt-6 dark:border-white/10 md:grid-cols-[minmax(0,1fr)_240px]">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Notes
            <textarea
              className={`${inputClass} min-h-28`}
              name="notes"
              defaultValue={invoice.notes ?? ""}
              placeholder="Payment instructions, remittance details, or additional notes for the brand."
              readOnly={isReadOnly}
            />
          </label>
          <div className="border border-black/8 p-5 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Subtotal
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              {formatCurrency(subtotal, invoice.currency ?? "USD")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {lineItems.length} line item{lineItems.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10">
          <div className="border-t border-black/8 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-[#11161c]/95 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {isReadOnly
                  ? "Voided"
                  : invoice.finalizedAt
                    ? `Exported ${formatDate(invoice.finalizedAt)}`
                    : "Draft"}
              </span>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {isDraft ? (
                  <>
                    <SubmitButton
                      formAction={regenerateInvoiceDraftAction}
                      pendingLabel="Refreshing..."
                      className="hidden items-center border border-black/10 bg-white px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-sand/50 sm:inline-flex dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      Regenerate
                    </SubmitButton>
                    <SubmitButton
                      formAction={saveInvoiceDraftAction}
                      pendingLabel="Saving..."
                      className="inline-flex flex-1 items-center justify-center border border-black/10 bg-white px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-sand/50 sm:flex-none dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      Save draft
                    </SubmitButton>
                  </>
                ) : null}
                {isDraft ? (
                  <SubmitButton
                    formAction={finalizeInvoiceAction}
                    pendingLabel="Exporting..."
                    className="inline-flex flex-1 items-center justify-center bg-primary px-5 py-2.5 text-sm font-semibold text-white sm:flex-none"
                  >
                    Export invoice
                  </SubmitButton>
                ) : isFinalized ? (
                  <SubmitButton
                    formAction={finalizeInvoiceAction}
                    pendingLabel="Re-exporting..."
                    className="inline-flex items-center border border-black/10 bg-white px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-sand/50 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    Re-export PDF
                  </SubmitButton>
                ) : null}
                {!isReadOnly && !isDraft ? (
                  <SubmitButton
                    formAction={voidInvoiceAction}
                    pendingLabel="Voiding..."
                    className="inline-flex items-center border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Void
                  </SubmitButton>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-500 transition hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Attached documents */}
      {!showPreview && invoiceDocuments.length > 0 ? (
        <div className="border-t border-black/8 pt-6 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Attached invoice documents
          </p>
          <div className="mt-3 space-y-2">
            {invoiceDocuments.map((doc) => (
              <Link
                key={doc.id}
                href={`/api/documents/${doc.id}/content`}
                target="_blank"
                className="flex items-center justify-between border border-black/8 px-4 py-3 text-sm transition hover:border-black/20 dark:border-white/10"
              >
                <span>{doc.fileName}</span>
                <span className="text-muted-foreground">Open</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Delivery history */}
      {!showPreview && invoiceDeliveries.length > 0 ? (
        <div className="border-t border-black/8 pt-6 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Delivery history
          </p>
          <div className="mt-3 space-y-2">
            {invoiceDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="flex flex-wrap items-start justify-between gap-3 border border-black/8 px-4 py-3 text-sm dark:border-white/10"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {humanizeToken(delivery.status)}
                    {delivery.toEmail ? ` to ${delivery.toEmail}` : ""}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {delivery.subject} · {formatDate(delivery.sentAt)}
                  </p>
                  {delivery.errorMessage ? (
                    <p className="mt-1 text-red-600">{delivery.errorMessage}</p>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  {delivery.provider ? humanizeToken(delivery.provider) : "Linked inbox"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Delete confirmation dialog */}
      {deleteDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-card">
            <h3 className="text-lg font-semibold text-foreground">Delete invoice</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{invoice.invoiceNumber}</span> and reset
              the workspace payment status. You can generate a new invoice afterward.
            </p>

            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 border border-black/8 p-3 dark:border-white/10">
                <input
                  type="radio"
                  name="numberChoice"
                  checked={!reuseNumber}
                  onChange={() => setReuseNumber(false)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Reserve this number</p>
                  <p className="text-xs text-muted-foreground">
                    Keep {invoice.invoiceNumber} used. Next invoice will be the next sequential
                    number. Best for accounting records.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 border border-black/8 p-3 dark:border-white/10">
                <input
                  type="radio"
                  name="numberChoice"
                  checked={reuseNumber}
                  onChange={() => setReuseNumber(true)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Reuse this number</p>
                  <p className="text-xs text-muted-foreground">
                    Free up {invoice.invoiceNumber} so the next invoice can use it again.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground transition hover:text-muted-foreground"
              >
                Cancel
              </button>
              <form action={deleteInvoiceAction}>
                <input type="hidden" name="dealId" value={dealId} />
                <input type="hidden" name="reuseNumber" value={reuseNumber ? "true" : "false"} />
                <SubmitButton
                  pendingLabel="Deleting..."
                  className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete invoice
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
