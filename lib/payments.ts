import { prisma } from "@/lib/prisma";
import type { DealTermsRecord, PaymentRecord, PaymentStatus, Viewer } from "@/lib/types";

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toPaymentRecord(record: {
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
    id: record.id,
    dealId: record.dealId,
    amount: record.amount,
    currency: record.currency,
    invoiceDate: iso(record.invoiceDate),
    dueDate: iso(record.dueDate),
    paidDate: iso(record.paidDate),
    status: normalizePaymentStatus(record.status, record.dueDate, record.paidDate),
    notes: record.notes,
    source: record.source,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function normalizePaymentStatus(
  status: string,
  dueDate: Date | null,
  paidDate: Date | null
): PaymentStatus {
  const normalizedInputStatus = status === "invoiced" ? "not_invoiced" : status;

  if (paidDate || status === "paid") {
    return "paid";
  }

  if (
    dueDate &&
    dueDate.getTime() < Date.now() &&
    normalizedInputStatus === "awaiting_payment"
  ) {
    return "late";
  }

  if (normalizedInputStatus === "awaiting_payment") {
    return "awaiting_payment";
  }

  return "not_invoiced";
}

function dueDateFromTerms(terms: Pick<DealTermsRecord, "netTermsDays">) {
  if (!terms.netTermsDays || terms.netTermsDays <= 0) {
    return null;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + terms.netTermsDays);
  return dueDate;
}

export async function syncPaymentRecordForDeal(
  dealId: string,
  terms: Pick<DealTermsRecord, "paymentAmount" | "currency" | "netTermsDays" | "paymentTrigger">
) {
  const current = await prisma.paymentRecord.findUnique({ where: { dealId } });
  const nextStatus = normalizePaymentStatus(
    current?.status ?? "not_invoiced",
    current?.dueDate ?? dueDateFromTerms(terms),
    current?.paidDate ?? null
  );

  const saved = await prisma.paymentRecord.upsert({
    where: { dealId },
    update: {
      amount: terms.paymentAmount,
      currency: terms.currency ?? current?.currency ?? "USD",
      dueDate: current?.dueDate ?? dueDateFromTerms(terms),
      notes: current?.notes ?? terms.paymentTrigger ?? null,
      status: nextStatus,
      source: current?.source ?? "ai_extraction"
    },
    create: {
      dealId,
      amount: terms.paymentAmount,
      currency: terms.currency ?? "USD",
      dueDate: dueDateFromTerms(terms),
      status: nextStatus,
      notes: terms.paymentTrigger ?? null,
      source: "ai_extraction"
    }
  });

  await prisma.deal.update({
    where: { id: dealId },
    data: { paymentStatus: nextStatus }
  });

  return toPaymentRecord(saved);
}

export async function listPaymentsForViewer(viewer: Viewer) {
  const rows = await prisma.paymentRecord.findMany({
    where: {
      deal: {
        userId: viewer.id,
        confirmedAt: { not: null }
      }
    },
    include: {
      deal: true
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }]
  });

  return rows.map((row) => ({
    payment: toPaymentRecord(row),
    deal: row.deal
  }));
}

export async function updatePaymentForViewer(
  viewer: Viewer,
  dealId: string,
  patch: {
    amount: number | null;
    currency: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    paidDate: string | null;
    status: PaymentStatus;
    notes: string | null;
    source?: string | null;
  }
) {
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      userId: viewer.id
    },
    select: { id: true }
  });

  if (!deal) {
    return null;
  }

  const normalizedStatus = normalizePaymentStatus(
    patch.status,
    patch.dueDate ? new Date(patch.dueDate) : null,
    patch.paidDate ? new Date(patch.paidDate) : null
  );

  const saved = await prisma.paymentRecord.upsert({
    where: { dealId },
    update: {
      amount: patch.amount,
      currency: patch.currency,
      invoiceDate: patch.invoiceDate ? new Date(patch.invoiceDate) : null,
      dueDate: patch.dueDate ? new Date(patch.dueDate) : null,
      paidDate: patch.paidDate ? new Date(patch.paidDate) : null,
      status: normalizedStatus,
      notes: patch.notes,
      source: patch.source ?? "manual"
    },
    create: {
      dealId,
      amount: patch.amount,
      currency: patch.currency,
      invoiceDate: patch.invoiceDate ? new Date(patch.invoiceDate) : null,
      dueDate: patch.dueDate ? new Date(patch.dueDate) : null,
      paidDate: patch.paidDate ? new Date(patch.paidDate) : null,
      status: normalizedStatus,
      notes: patch.notes,
      source: patch.source ?? "manual"
    }
  });

  await prisma.deal.update({
    where: { id: dealId },
    data: { paymentStatus: normalizedStatus }
  });

  return toPaymentRecord(saved);
}
