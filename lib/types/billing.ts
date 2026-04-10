/**
 * Billing, payment, and invoice record types.
 * Keep inbox workflow, deal policy, and persistence mapping out of this module.
 */

import type { EmailProvider } from "./common";

export type PaymentStatus =
  | "not_invoiced"
  | "invoiced"
  | "awaiting_payment"
  | "paid"
  | "late";

export type InvoiceStatus = "draft" | "finalized" | "sent" | "voided";
export type InvoiceReminderTouchpointStatus = "pending" | "sent" | "cancelled";
export type InvoiceDeliveryStatus = "sent" | "failed";

export interface PaymentRecord {
  id: string;
  dealId: string;
  amount: number | null;
  currency: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  status: PaymentStatus;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceParty {
  name: string;
  email: string | null;
  companyName: string | null;
  address: string | null;
  taxId: string | null;
  payoutDetails: string | null;
}

export interface InvoiceLineItem {
  id: string;
  deliverableId: string | null;
  title: string;
  description: string | null;
  channel: string | null;
  quantity: number;
  unitRate: number;
  amount: number;
}

export interface InvoiceRecord {
  id: string;
  dealId: string;
  userId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  draftSavedAt: string | null;
  finalizedAt: string | null;
  sentAt: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subtotal: number | null;
  notes: string | null;
  billTo: InvoiceParty;
  issuer: InvoiceParty;
  lineItems: InvoiceLineItem[];
  pdfDocumentId: string | null;
  manualNumberOverride: boolean;
  lastSentThreadId: string | null;
  lastSentMessageId: string | null;
  lastSentAccountId: string | null;
  lastSentToEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDeliveryRecord {
  id: string;
  invoiceId: string;
  dealId: string;
  userId: string;
  provider: EmailProvider | null;
  threadId: string | null;
  messageId: string | null;
  accountId: string | null;
  toEmail: string | null;
  subject: string;
  status: InvoiceDeliveryStatus;
  errorMessage: string | null;
  sentAt: string;
  createdAt: string;
}

export interface InvoiceReminderTouchpointRecord {
  id: string;
  dealId: string;
  userId: string;
  anchorDate: string;
  offsetDays: 0 | 1 | 3;
  sendOn: string;
  status: InvoiceReminderTouchpointStatus;
  notificationId: string | null;
  createdAt: string;
  updatedAt: string;
}
