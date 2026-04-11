"use server";

/**
 * Deal invoice actions.
 * This file handles invoice draft generation, invoice edits, finalization, voiding, and invoice deletion for a workspace.
 */
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import {
  deleteInvoiceForViewer,
  finalizeInvoiceForViewer,
  generateInvoiceDraftForViewer,
  regenerateInvoiceDraftForViewer,
  saveInvoiceDraftForViewer,
  voidInvoiceForViewer
} from "@/lib/invoices";
import { invoiceRecordInputSchema } from "@/lib/validation";
import type { InvoiceLineItem, InvoiceParty } from "@/lib/types";
import { parseNullableString } from "@/app/action-helpers";

import { invalidateInvoiceSurfaces } from "./deal-shared";

function parseInvoicePartyFromForm(formData: FormData, prefix: "billTo" | "issuer"): InvoiceParty {
  return {
    name: String(formData.get(`${prefix}Name`) ?? "").trim(),
    email: parseNullableString(formData.get(`${prefix}Email`)),
    companyName: parseNullableString(formData.get(`${prefix}CompanyName`)),
    address: parseNullableString(formData.get(`${prefix}Address`)),
    taxId: parseNullableString(formData.get(`${prefix}TaxId`)),
    payoutDetails: parseNullableString(formData.get(`${prefix}PayoutDetails`))
  };
}

function parseInvoiceLineItemsFromForm(formData: FormData): InvoiceLineItem[] {
  const raw = String(formData.get("lineItemsJson") ?? "[]");
  const parsed = JSON.parse(raw) as unknown[];

  return parsed.map((item) => {
    const record = item as Partial<InvoiceLineItem>;
    return {
      id: String(record.id ?? ""),
      deliverableId:
        typeof record.deliverableId === "string" ? record.deliverableId : null,
      title: String(record.title ?? ""),
      description:
        typeof record.description === "string" ? record.description : null,
      channel: typeof record.channel === "string" ? record.channel : null,
      quantity: Number(record.quantity ?? 1),
      unitRate: Number(record.unitRate ?? 0),
      amount: Number(record.amount ?? 0)
    };
  });
}

function parseInvoiceInputFromForm(formData: FormData) {
  const lineItems = parseInvoiceLineItemsFromForm(formData);
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return invoiceRecordInputSchema.parse({
    invoiceNumber: String(formData.get("invoiceNumber") ?? "").trim(),
    status: String(formData.get("status") ?? "draft"),
    invoiceDate: parseNullableString(formData.get("invoiceDate")),
    dueDate: parseNullableString(formData.get("dueDate")),
    currency: parseNullableString(formData.get("currency")),
    subtotal,
    notes: parseNullableString(formData.get("notes")),
    billTo: parseInvoicePartyFromForm(formData, "billTo"),
    issuer: parseInvoicePartyFromForm(formData, "issuer"),
    lineItems,
    pdfDocumentId: parseNullableString(formData.get("pdfDocumentId")),
    manualNumberOverride: String(formData.get("manualNumberOverride") ?? "") === "true"
  });
}

function buildInvoiceMutationInput(formData: FormData) {
  const input = parseInvoiceInputFromForm(formData);

  return {
    ...input,
    status: "draft" as const,
    draftSavedAt: null,
    finalizedAt: null,
    sentAt: null,
    pdfDocumentId: input.pdfDocumentId ?? null,
    manualNumberOverride: input.manualNumberOverride ?? false,
    lastSentThreadId: null,
    lastSentMessageId: null,
    lastSentAccountId: null,
    lastSentToEmail: null
  };
}

export async function generateInvoiceDraftAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await generateInvoiceDraftForViewer(viewer, dealId);
  invalidateInvoiceSurfaces(viewer.id, dealId);
}

export async function regenerateInvoiceDraftAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await regenerateInvoiceDraftForViewer(viewer, dealId);
  invalidateInvoiceSurfaces(viewer.id, dealId);
}

export async function saveInvoiceDraftAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await saveInvoiceDraftForViewer(viewer, dealId, buildInvoiceMutationInput(formData));
  invalidateInvoiceSurfaces(viewer.id, dealId);
}

export async function finalizeInvoiceAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await finalizeInvoiceForViewer(viewer, dealId, buildInvoiceMutationInput(formData));
  invalidateInvoiceSurfaces(viewer.id, dealId);
}

export async function voidInvoiceAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await voidInvoiceForViewer(viewer, dealId);
  invalidateInvoiceSurfaces(viewer.id, dealId);
}

export async function deleteInvoiceAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const reuseNumber = String(formData.get("reuseNumber") ?? "") === "true";

  await deleteInvoiceForViewer(viewer, dealId, { reuseNumber });
  invalidateInvoiceSurfaces(viewer.id, dealId);
  redirect(`/app/p/${dealId}?tab=deliverables`);
}
