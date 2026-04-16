"use client";

import type { InvoiceLineItem, InvoiceParty } from "@/lib/types";

function formatMoney(value: number | null | undefined, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function PartyBlock({ label, party }: { label: string; party: InvoiceParty }) {
  const hasContent = party.name || party.companyName || party.email;
  if (!hasContent) return null;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/40">{label}</p>
      <div className="mt-1.5 space-y-0.5 text-[13px] leading-5 text-black/80">
        {party.companyName ? <p className="font-semibold">{party.companyName}</p> : null}
        {party.name ? <p>{party.name}</p> : null}
        {party.email ? <p>{party.email}</p> : null}
        {party.address ? <p className="whitespace-pre-line">{party.address}</p> : null}
        {party.taxId ? <p className="text-black/50">Tax ID: {party.taxId}</p> : null}
      </div>
    </div>
  );
}

export function InvoicePreview({
  invoiceNumber,
  invoiceDate,
  dueDate,
  currency,
  billTo,
  issuer,
  lineItems,
  subtotal,
  notes,
}: {
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string;
  billTo: InvoiceParty;
  issuer: InvoiceParty;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  notes: string | null;
}) {
  return (
    <div className="border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#fafaf9]">
      {/* Paper */}
      <div className="mx-auto max-w-[640px] overflow-x-auto px-4 py-8 text-black sm:px-12 sm:py-14">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-black">INVOICE</h2>
            <p className="mt-1 text-sm text-black/50">{invoiceNumber}</p>
          </div>
          <div className="text-right text-[13px] leading-6 text-black/60">
            <p>Date: {formatDate(invoiceDate)}</p>
            <p>Due: {formatDate(dueDate)}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <PartyBlock label="Bill to" party={billTo} />
          <PartyBlock label="From" party={issuer} />
        </div>

        {/* Line items */}
        <div className="mt-10">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-2 border-black/10 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-black/40">
                <th scope="col" className="pb-2 pr-4">
                  Description
                </th>
                <th scope="col" className="w-16 pb-2 pr-4 text-right">
                  Qty
                </th>
                <th scope="col" className="w-24 pb-2 pr-4 text-right">
                  Rate
                </th>
                <th scope="col" className="w-24 pb-2 text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems
                .filter((item) => item.title.trim())
                .map((item) => (
                  <tr key={item.id} className="border-b border-black/6">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-black/80">{item.title}</p>
                      {item.channel ? (
                        <p className="mt-0.5 text-[11px] text-black/40">{item.channel}</p>
                      ) : null}
                      {item.description ? (
                        <p className="mt-0.5 text-[11px] text-black/40">{item.description}</p>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-black/70">{item.quantity}</td>
                    <td className="py-2.5 pr-4 text-right text-black/70">
                      {formatMoney(item.unitRate, currency)}
                    </td>
                    <td className="py-2.5 text-right font-medium text-black/80">
                      {formatMoney(item.amount, currency)}
                    </td>
                  </tr>
                ))}
              {lineItems.filter((item) => item.title.trim()).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-black/30">
                    No line items
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Subtotal */}
        <div className="mt-4 flex justify-end">
          <div className="w-48 border-t-2 border-black/10 pt-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/40">
              Subtotal
            </p>
            <p className="mt-1 text-xl font-bold text-black">{formatMoney(subtotal, currency)}</p>
          </div>
        </div>

        {/* Notes */}
        {notes?.trim() ? (
          <div className="mt-8 border-t border-black/6 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/40">Notes</p>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-black/60">
              {notes}
            </p>
          </div>
        ) : null}

        {/* Payout details */}
        {issuer.payoutDetails?.trim() ? (
          <div className="mt-6 border-t border-black/6 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/40">
              Remittance / payout details
            </p>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-black/60">
              {issuer.payoutDetails}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
