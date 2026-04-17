/**
 * Prisma mappers for payment and invoice records.
 * These helpers keep invoice-specific row conversion and JSON parsing out of the repository implementation.
 */

import type {
  InvoiceDeliveryRecord,
  InvoiceLineItem,
  InvoiceParty,
  InvoiceRecord,
  InvoiceReminderTouchpointRecord,
  PaymentRecord
} from "@/lib/types";

import { iso } from "./prisma-shared";

export function toPaymentRecord(record: {
  id: string;
  dealId: string;
  amount: number | null;
  currency: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  paidDate: Date | null;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentRecord {
  return {
    ...record,
    status: record.status as PaymentRecord["status"],
    invoiceDate: iso(record.invoiceDate),
    dueDate: iso(record.dueDate),
    paidDate: iso(record.paidDate),
    createdAt: iso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(record.updatedAt) ?? new Date().toISOString()
  };
}

function toInvoiceParty(value: unknown): InvoiceParty {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    name: typeof record.name === "string" ? record.name : "",
    email: typeof record.email === "string" ? record.email : null,
    companyName: typeof record.companyName === "string" ? record.companyName : null,
    address: typeof record.address === "string" ? record.address : null,
    taxId: typeof record.taxId === "string" ? record.taxId : null,
    payoutDetails: typeof record.payoutDetails === "string" ? record.payoutDetails : null
  };
}

function toInvoiceLineItems(value: unknown): InvoiceLineItem[] {
  return Array.isArray(value)
    ? value
        .map((entry, index) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return null;
          }

          const record = entry as Record<string, unknown>;
          return {
            id: typeof record.id === "string" ? record.id : `line-${index + 1}`,
            deliverableId:
              typeof record.deliverableId === "string" ? record.deliverableId : null,
            title: typeof record.title === "string" ? record.title : "",
            description: typeof record.description === "string" ? record.description : null,
            channel: typeof record.channel === "string" ? record.channel : null,
            quantity:
              typeof record.quantity === "number" && record.quantity > 0
                ? record.quantity
                : 1,
            unitRate:
              typeof record.unitRate === "number" && record.unitRate >= 0
                ? record.unitRate
                : 0,
            amount:
              typeof record.amount === "number" && record.amount >= 0
                ? record.amount
                : 0
          } satisfies InvoiceLineItem;
        })
        .filter((entry): entry is InvoiceLineItem => entry !== null)
    : [];
}

export function toInvoiceRecord(record: {
  id: string;
  dealId: string;
  userId: string;
  invoiceNumber: string;
  status: string;
  draftSavedAt: Date | null;
  finalizedAt: Date | null;
  sentAt: Date | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  currency: string | null;
  subtotal: number | null;
  notes: string | null;
  billToJson: unknown;
  issuerJson: unknown;
  lineItemsJson: unknown;
  pdfDocumentId: string | null;
  manualNumberOverride: boolean;
  lastSentThreadId: string | null;
  lastSentMessageId: string | null;
  lastSentAccountId: string | null;
  lastSentToEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InvoiceRecord {
  return {
    id: record.id,
    dealId: record.dealId,
    userId: record.userId,
    invoiceNumber: record.invoiceNumber,
    status: record.status as InvoiceRecord["status"],
    draftSavedAt: iso(record.draftSavedAt),
    finalizedAt: iso(record.finalizedAt),
    sentAt: iso(record.sentAt),
    invoiceDate: iso(record.invoiceDate),
    dueDate: iso(record.dueDate),
    currency: record.currency,
    subtotal: record.subtotal,
    notes: record.notes,
    billTo: toInvoiceParty(record.billToJson),
    issuer: toInvoiceParty(record.issuerJson),
    lineItems: toInvoiceLineItems(record.lineItemsJson),
    pdfDocumentId: record.pdfDocumentId,
    manualNumberOverride: record.manualNumberOverride,
    lastSentThreadId: record.lastSentThreadId,
    lastSentMessageId: record.lastSentMessageId,
    lastSentAccountId: record.lastSentAccountId,
    lastSentToEmail: record.lastSentToEmail,
    createdAt: iso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(record.updatedAt) ?? new Date().toISOString()
  };
}

export function toInvoiceDeliveryRecord(record: {
  id: string;
  invoiceId: string;
  dealId: string;
  userId: string;
  provider: string | null;
  threadId: string | null;
  messageId: string | null;
  accountId: string | null;
  toEmail: string | null;
  subject: string;
  status: string;
  errorMessage: string | null;
  sentAt: Date;
  createdAt: Date;
}): InvoiceDeliveryRecord {
  return {
    id: record.id,
    invoiceId: record.invoiceId,
    dealId: record.dealId,
    userId: record.userId,
    provider: record.provider as InvoiceDeliveryRecord["provider"],
    threadId: record.threadId,
    messageId: record.messageId,
    accountId: record.accountId,
    toEmail: record.toEmail,
    subject: record.subject,
    status: record.status as InvoiceDeliveryRecord["status"],
    errorMessage: record.errorMessage,
    sentAt: iso(record.sentAt) ?? new Date().toISOString(),
    createdAt: iso(record.createdAt) ?? new Date().toISOString()
  };
}

export function toInvoiceReminderTouchpointRecord(record: {
  id: string;
  dealId: string;
  userId: string;
  anchorDate: Date;
  offsetDays: number;
  sendOn: Date;
  status: string;
  notificationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InvoiceReminderTouchpointRecord {
  return {
    id: record.id,
    dealId: record.dealId,
    userId: record.userId,
    anchorDate: iso(record.anchorDate) ?? new Date().toISOString(),
    offsetDays: record.offsetDays as InvoiceReminderTouchpointRecord["offsetDays"],
    sendOn: iso(record.sendOn) ?? new Date().toISOString(),
    status: record.status as InvoiceReminderTouchpointRecord["status"],
    notificationId: record.notificationId,
    createdAt: iso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(record.updatedAt) ?? new Date().toISOString()
  };
}
