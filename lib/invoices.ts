import { randomUUID } from "node:crypto";

import type {
  DealAggregate,
  DeliverableItem,
  InvoiceDeliveryRecord,
  InvoiceLineItem,
  InvoiceParty,
  InvoiceRecord,
  InvoiceReminderTouchpointRecord,
  Viewer
} from "@/lib/types";
import { getProfileForViewer } from "@/lib/profile";
import { parseProfileMetadata } from "@/lib/profile-metadata";
import { getRepository } from "@/lib/repository";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { storeUploadedBytes } from "@/lib/storage";
import { updatePaymentForViewer } from "@/lib/payments";
import { renderInvoicePdf, buildInvoicePlainText } from "@/lib/invoice-pdf";
import { emitNotificationSeedForUser } from "@/lib/notification-service";
import { prisma } from "@/lib/prisma";

const TOUCHPOINT_OFFSETS = [0, 1, 3] as const;

function normalizeCurrency(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "USD";
}

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function startOfDayIso(value: string | Date) {
  const date =
    typeof value === "string"
      ? /^\d{4}-\d{2}-\d{2}/.test(value)
        ? new Date(`${value.slice(0, 10)}T00:00:00`)
        : new Date(value)
      : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function addDays(start: string | Date, days: number) {
  const date = typeof start === "string" ? new Date(start) : new Date(start);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function safeIsoDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cents(value: number) {
  return Math.round(value * 100);
}

function amountFromCents(value: number) {
  return Math.round(value) / 100;
}

function buildEmptyParty(name = ""): InvoiceParty {
  return {
    name,
    email: null,
    companyName: null,
    address: null,
    taxId: null,
    payoutDetails: null
  };
}

function latestDeliverableDate(deliverables: DeliverableItem[]) {
  return [...deliverables]
    .map((item) => safeIsoDate(item.dueDate))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function computeAnchorFromTerms(
  terms:
    | Pick<NonNullable<DealAggregate["terms"]>, "deliverables" | "campaignDateWindow">
    | null
    | undefined
) {
  const deliverableAnchor = latestDeliverableDate(terms?.deliverables ?? []);
  if (deliverableAnchor) {
    return startOfDayIso(deliverableAnchor);
  }

  const campaignEnd = safeIsoDate(terms?.campaignDateWindow?.endDate ?? null);
  return campaignEnd ? startOfDayIso(campaignEnd) : null;
}

export function computeInvoiceReminderAnchorDate(aggregate: DealAggregate) {
  return computeAnchorFromTerms(aggregate.terms);
}

function latestInvoiceDocument(aggregate: DealAggregate) {
  return aggregate.documents.find((document) => document.documentKind === "invoice") ?? null;
}

function generationReminderAnchorDate(aggregate: DealAggregate) {
  if (aggregate.invoiceRecord || latestInvoiceDocument(aggregate)) {
    return null;
  }

  return computeInvoiceReminderAnchorDate(aggregate);
}

function sendReminderAnchorDate(aggregate: DealAggregate) {
  const invoice = aggregate.invoiceRecord;
  if (!invoice || invoice.status !== "finalized" || !invoice.pdfDocumentId || invoice.sentAt) {
    return null;
  }

  return startOfDayIso(invoice.finalizedAt ?? invoice.draftSavedAt ?? invoice.updatedAt);
}

function createFallbackLineItems(input: {
  campaignName: string;
  amount: number;
}) {
  return [
    {
      id: randomUUID(),
      deliverableId: null,
      title: input.campaignName,
      description: "Partnership invoice",
      channel: null,
      quantity: 1,
      unitRate: amountFromCents(input.amount),
      amount: amountFromCents(input.amount)
    }
  ] satisfies InvoiceLineItem[];
}

export function buildInvoiceLineItems(input: {
  deliverables: DeliverableItem[];
  amount: number | null;
  fallbackTitle: string;
}) {
  const totalAmount = input.amount ?? 0;
  const deliverables = input.deliverables.filter((item) => {
    const quantity = item.quantity ?? 1;
    return quantity > 0;
  });

  if (deliverables.length === 0) {
    return createFallbackLineItems({
      campaignName: input.fallbackTitle,
      amount: cents(totalAmount)
    });
  }

  const unitCount = deliverables.reduce(
    (sum, item) => sum + Math.max(item.quantity ?? 1, 1),
    0
  );

  if (unitCount <= 0 || totalAmount <= 0) {
    return deliverables.map((item) => ({
      id: item.id || randomUUID(),
      deliverableId: item.id,
      title: item.title,
      description: item.description ?? null,
      channel: item.channel ?? null,
      quantity: Math.max(item.quantity ?? 1, 1),
      unitRate: 0,
      amount: 0
    }));
  }

  const totalCents = cents(totalAmount);
  const baseRateCents = Math.floor(totalCents / unitCount);
  let assignedCents = 0;

  return deliverables.map((item, index) => {
    const quantity = Math.max(item.quantity ?? 1, 1);
    let amountCents = baseRateCents * quantity;

    if (index === deliverables.length - 1) {
      amountCents = totalCents - assignedCents;
    } else {
      assignedCents += amountCents;
    }

    return {
      id: item.id || randomUUID(),
      deliverableId: item.id,
      title: item.title,
      description: item.description ?? null,
      channel: item.channel ?? null,
      quantity,
      unitRate: amountFromCents(baseRateCents),
      amount: amountFromCents(amountCents)
    } satisfies InvoiceLineItem;
  });
}

function computeSubtotal(lineItems: InvoiceLineItem[]) {
  return amountFromCents(
    lineItems.reduce((sum, item) => sum + cents(item.amount), 0)
  );
}

export async function allocateNextInvoiceNumber(userId: string) {
  const records = await getRepository().listInvoiceRecords(userId);
  const maxNumber = records.reduce((max, record) => {
    const match = record.invoiceNumber.match(/(\d+)$/);
    const numeric = match ? Number(match[1]) : 0;
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 1000);

  return `HB-${maxNumber + 1}`;
}

async function assertInvoiceNumberAvailable(
  userId: string,
  invoiceNumber: string,
  dealId: string
) {
  const records = await getRepository().listInvoiceRecords(userId);
  const conflict = records.find(
    (record) =>
      record.invoiceNumber.trim().toUpperCase() === invoiceNumber.trim().toUpperCase() &&
      record.dealId !== dealId
  );

  if (conflict) {
    throw new Error("Invoice number already exists for another workspace.");
  }
}

async function buildInvoiceDraftPayload(
  viewer: Viewer,
  aggregate: DealAggregate,
  existingInvoice?: InvoiceRecord | null
) {
  const profile = await getProfileForViewer(viewer);
  const { metadata } = parseProfileMetadata(profile.payoutDetails);
  const normalized = buildNormalizedIntakeRecord(aggregate);
  const paymentAmount =
    aggregate.paymentRecord?.amount ?? aggregate.terms?.paymentAmount ?? 0;
  const currency = normalizeCurrency(
    aggregate.paymentRecord?.currency ??
      aggregate.terms?.currency ??
      profile.defaultCurrency
  );
  const invoiceNumber =
    existingInvoice?.invoiceNumber ?? (await allocateNextInvoiceNumber(viewer.id));
  const invoiceDate =
    existingInvoice?.invoiceDate ?? new Date().toISOString();
  const dueDate =
    existingInvoice?.dueDate ??
    aggregate.paymentRecord?.dueDate ??
    (aggregate.terms?.netTermsDays
      ? addDays(invoiceDate, aggregate.terms.netTermsDays)
      : null);

  const issuer: InvoiceParty = existingInvoice?.issuer ?? {
    name:
      profile.creatorLegalName?.trim() ||
      profile.displayName?.trim() ||
      viewer.displayName,
    email: profile.contactEmail ?? viewer.email,
    companyName: profile.businessName ?? null,
    address: null,
    taxId: metadata.taxId ?? null,
    payoutDetails: metadata.payoutNotes ?? null
  };

  const billToContactName = normalized?.primaryContact?.name?.trim() || null;
  const billToContactEmail = normalized?.primaryContact?.email?.trim() || null;
  const billToCompany =
    normalized?.primaryContact?.organizationType === "agency"
      ? aggregate.terms?.agencyName ?? aggregate.deal.brandName
      : aggregate.deal.brandName;

  const billTo: InvoiceParty = existingInvoice?.billTo ?? {
    name: billToContactName ?? billToCompany ?? aggregate.deal.brandName,
    email: billToContactEmail,
    companyName: billToCompany ?? aggregate.deal.brandName,
    address: null,
    taxId: null,
    payoutDetails: null
  };

  const lineItems =
    existingInvoice?.lineItems?.length
      ? existingInvoice.lineItems
      : buildInvoiceLineItems({
          deliverables: aggregate.terms?.deliverables ?? [],
          amount: paymentAmount,
          fallbackTitle: aggregate.deal.campaignName
        });

  return {
    invoiceNumber,
    status: existingInvoice?.status ?? "draft",
    draftSavedAt: existingInvoice?.draftSavedAt ?? new Date().toISOString(),
    finalizedAt: existingInvoice?.finalizedAt ?? null,
    sentAt: existingInvoice?.sentAt ?? null,
    invoiceDate,
    dueDate,
    currency,
    subtotal: computeSubtotal(lineItems),
    notes:
      existingInvoice?.notes ??
      aggregate.terms?.paymentTrigger ??
      metadata.payoutNotes ??
      null,
    billTo,
    issuer,
    lineItems,
    pdfDocumentId: existingInvoice?.pdfDocumentId ?? null,
    manualNumberOverride: existingInvoice?.manualNumberOverride ?? false,
    lastSentThreadId: existingInvoice?.lastSentThreadId ?? null,
    lastSentMessageId: existingInvoice?.lastSentMessageId ?? null,
    lastSentAccountId: existingInvoice?.lastSentAccountId ?? null,
    lastSentToEmail: existingInvoice?.lastSentToEmail ?? null
  } satisfies Omit<
    InvoiceRecord,
    "id" | "dealId" | "userId" | "createdAt" | "updatedAt"
  >;
}

export async function getInvoiceForViewer(viewer: Viewer, dealId: string) {
  return getRepository().getInvoiceRecord(viewer.id, dealId);
}

export async function listInvoiceDeliveriesForViewer(viewer: Viewer, dealId: string) {
  return getRepository().listInvoiceDeliveryRecords(viewer.id, dealId);
}

export async function generateInvoiceDraftForViewer(viewer: Viewer, dealId: string) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const existing = aggregate.invoiceRecord;
  if (existing) {
    await cancelInvoiceReminderTouchpointsForViewer(viewer, dealId);
    return existing;
  }

  const payload = await buildInvoiceDraftPayload(viewer, aggregate, null);
  await assertInvoiceNumberAvailable(viewer.id, payload.invoiceNumber, dealId);
  const saved = await getRepository().upsertInvoiceRecord(viewer.id, dealId, payload);
  await cancelInvoiceReminderTouchpointsForViewer(viewer, dealId);
  return saved;
}

export async function regenerateInvoiceDraftForViewer(viewer: Viewer, dealId: string) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate?.invoiceRecord || aggregate.invoiceRecord.status !== "draft") {
    return aggregate?.invoiceRecord ?? null;
  }

  const existing = aggregate.invoiceRecord;
  const refreshed = await buildInvoiceDraftPayload(viewer, aggregate, null);
  const saved = await getRepository().upsertInvoiceRecord(viewer.id, dealId, {
    ...refreshed,
    invoiceNumber: existing.invoiceNumber,
    invoiceDate: existing.invoiceDate ?? refreshed.invoiceDate,
    dueDate: existing.dueDate ?? refreshed.dueDate,
    pdfDocumentId: existing.pdfDocumentId,
    manualNumberOverride: existing.manualNumberOverride,
    draftSavedAt: new Date().toISOString(),
    finalizedAt: null,
    sentAt: null,
    lastSentThreadId: null,
    lastSentMessageId: null,
    lastSentAccountId: null,
    lastSentToEmail: null,
    status: "draft"
  });

  await cancelInvoiceReminderTouchpointsForViewer(viewer, dealId);
  return saved;
}

export async function saveInvoiceDraftForViewer(
  viewer: Viewer,
  dealId: string,
  input: Omit<InvoiceRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  await assertInvoiceNumberAvailable(viewer.id, input.invoiceNumber, dealId);

  const existing = aggregate.invoiceRecord;
  const lineItems = input.lineItems.map((item) => ({
    ...item,
    quantity: Math.max(item.quantity, 1),
    unitRate: Math.max(item.unitRate, 0),
    amount: Math.max(item.amount, 0)
  }));

  const saved = await getRepository().upsertInvoiceRecord(viewer.id, dealId, {
    ...input,
    status: "draft",
    draftSavedAt: new Date().toISOString(),
    finalizedAt: null,
    sentAt: null,
    currency: normalizeCurrency(input.currency),
    subtotal: computeSubtotal(lineItems),
    lineItems,
    pdfDocumentId: existing?.status === "draft" ? existing?.pdfDocumentId ?? input.pdfDocumentId ?? null : null,
    manualNumberOverride:
      input.manualNumberOverride ||
      Boolean(existing && existing.invoiceNumber !== input.invoiceNumber),
    lastSentThreadId: null,
    lastSentMessageId: null,
    lastSentAccountId: null,
    lastSentToEmail: null
  });

  await cancelInvoiceReminderTouchpointsForViewer(viewer, dealId);
  return saved;
}

export async function finalizeInvoiceForViewer(
  viewer: Viewer,
  dealId: string,
  input: Omit<InvoiceRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const draft = await saveInvoiceDraftForViewer(viewer, dealId, {
    ...input,
    status: "draft"
  });

  if (!draft) {
    return null;
  }

  const finalizedAt = new Date().toISOString();
  const finalizedRecord = await getRepository().upsertInvoiceRecord(viewer.id, dealId, {
    ...draft,
    status: "finalized",
    finalizedAt,
    sentAt: null,
    lastSentThreadId: null,
    lastSentMessageId: null,
    lastSentAccountId: null,
    lastSentToEmail: null
  });

  const pdfBytes = renderInvoicePdf({
    invoice: finalizedRecord,
    workspaceLabel: `${aggregate.deal.brandName} • ${aggregate.deal.campaignName}`
  });
  const fileName = `${finalizedRecord.invoiceNumber}.pdf`;
  const { storagePath } = await storeUploadedBytes({
    fileName,
    bytes: pdfBytes,
    contentType: "application/pdf",
    folder: dealId
  });

  const rawText = buildInvoicePlainText({
    invoice: finalizedRecord,
    workspaceLabel: `${aggregate.deal.brandName} • ${aggregate.deal.campaignName}`
  });

  const document = await getRepository().createDocument({
    dealId,
    userId: viewer.id,
    fileName,
    mimeType: "application/pdf",
    storagePath,
    processingStatus: "ready",
    rawText,
    normalizedText: rawText,
    documentKind: "invoice",
    classificationConfidence: 1,
    sourceType: "file",
    errorMessage: null
  });

  const saved = await getRepository().upsertInvoiceRecord(viewer.id, dealId, {
    ...finalizedRecord,
    pdfDocumentId: document.id
  });

  if (process.env.DATABASE_URL) {
    const resolvedPaymentStatus = aggregate.paymentRecord?.paidDate
      ? "paid"
      : saved.dueDate
        ? "awaiting_payment"
        : "invoiced";

    await updatePaymentForViewer(viewer, dealId, {
      amount: aggregate.paymentRecord?.amount ?? aggregate.terms?.paymentAmount ?? saved.subtotal,
      currency: saved.currency,
      invoiceDate: saved.invoiceDate,
      dueDate: saved.dueDate,
      paidDate: aggregate.paymentRecord?.paidDate ?? null,
      status: resolvedPaymentStatus,
      notes: aggregate.paymentRecord?.notes ?? saved.notes,
      source: "invoice_finalize"
    });
  } else {
    const resolvedDealPaymentStatus = aggregate.deal.paymentStatus === "paid"
      ? "paid"
      : saved.dueDate
        ? "awaiting_payment"
        : "invoiced";

    await getRepository().updateDeal(viewer.id, dealId, {
      paymentStatus: resolvedDealPaymentStatus
    });
  }

  await syncInvoiceReminderTouchpointsForViewer(viewer, dealId);
  return saved;
}

export async function voidInvoiceForViewer(viewer: Viewer, dealId: string) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate?.invoiceRecord) {
    return null;
  }

  const currentStatus = aggregate.invoiceRecord.status;
  if (currentStatus === "draft" || currentStatus === "voided") {
    return aggregate.invoiceRecord;
  }

  const saved = await getRepository().upsertInvoiceRecord(viewer.id, dealId, {
    ...aggregate.invoiceRecord,
    status: "voided",
    sentAt: null,
    lastSentThreadId: null,
    lastSentMessageId: null,
    lastSentAccountId: null,
    lastSentToEmail: null
  });

  if (process.env.DATABASE_URL) {
    await updatePaymentForViewer(viewer, dealId, {
      amount: aggregate.paymentRecord?.amount ?? aggregate.terms?.paymentAmount ?? saved.subtotal,
      currency: saved.currency,
      invoiceDate: saved.invoiceDate,
      dueDate: saved.dueDate,
      paidDate: aggregate.paymentRecord?.paidDate ?? null,
      status: aggregate.paymentRecord?.paidDate ? "paid" : "not_invoiced",
      notes: aggregate.paymentRecord?.notes ?? saved.notes,
      source: "invoice_void"
    });
  } else {
    await getRepository().updateDeal(viewer.id, dealId, {
      paymentStatus: aggregate.deal.paymentStatus === "paid" ? "paid" : "not_invoiced"
    });
  }

  await cancelInvoiceReminderTouchpointsForViewer(viewer, dealId);
  return saved;
}

export async function markInvoiceSentForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    threadId: string;
    messageId: string | null;
    accountId: string;
    provider: InvoiceDeliveryRecord["provider"];
    toEmail: string | null;
    subject: string;
    errorMessage?: string | null;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  const invoice = aggregate?.invoiceRecord;
  if (!aggregate || !invoice || !invoice.pdfDocumentId) {
    throw new Error("Finalize the invoice before sending it.");
  }

  const sentAt = new Date().toISOString();
  const nextStatus = input.errorMessage ? invoice.status : "sent";
  const saved = await getRepository().upsertInvoiceRecord(viewer.id, dealId, {
    ...invoice,
    status: nextStatus,
    sentAt: input.errorMessage ? invoice.sentAt : sentAt,
    lastSentThreadId: input.threadId,
    lastSentMessageId: input.messageId,
    lastSentAccountId: input.accountId,
    lastSentToEmail: input.toEmail
  });

  await getRepository().createInvoiceDeliveryRecord(viewer.id, dealId, {
    invoiceId: saved.id,
    provider: input.provider,
    threadId: input.threadId,
    messageId: input.messageId,
    accountId: input.accountId,
    toEmail: input.toEmail,
    subject: input.subject,
    status: input.errorMessage ? "failed" : "sent",
    errorMessage: input.errorMessage ?? null,
    sentAt
  });

  if (!input.errorMessage) {
    if (process.env.DATABASE_URL) {
      await updatePaymentForViewer(viewer, dealId, {
        amount: aggregate.paymentRecord?.amount ?? aggregate.terms?.paymentAmount ?? saved.subtotal,
        currency: saved.currency,
        invoiceDate: saved.invoiceDate,
        dueDate: saved.dueDate,
        paidDate: aggregate.paymentRecord?.paidDate ?? null,
        status: aggregate.paymentRecord?.paidDate ? "paid" : "awaiting_payment",
        notes: aggregate.paymentRecord?.notes ?? saved.notes,
        source: "invoice_send"
      });
    } else {
      await getRepository().updateDeal(viewer.id, dealId, {
        paymentStatus: aggregate.deal.paymentStatus === "paid" ? "paid" : "awaiting_payment"
      });
    }
  }

  await syncInvoiceReminderTouchpointsForViewer(viewer, dealId);
  return saved;
}

export async function cancelInvoiceReminderTouchpointsForViewer(viewer: Viewer, dealId: string) {
  const touchpoints = await getRepository().listInvoiceReminderTouchpoints(viewer.id, {
    dealId
  });

  await Promise.all(
    touchpoints
      .filter((touchpoint) => touchpoint.status === "pending")
      .map((touchpoint) =>
        getRepository().updateInvoiceReminderTouchpoint(touchpoint.id, {
          status: "cancelled"
        })
      )
  );
}

export async function syncInvoiceReminderTouchpointsForViewer(
  viewer: Viewer,
  dealId: string
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return [];
  }

  const sendAnchorDate = sendReminderAnchorDate(aggregate);
  if (sendAnchorDate) {
    return getRepository().upsertInvoiceReminderTouchpoints(
      viewer.id,
      dealId,
      TOUCHPOINT_OFFSETS.map((offsetDays) => ({
        anchorDate: sendAnchorDate,
        offsetDays,
        sendOn: startOfDayIso(addDays(sendAnchorDate, offsetDays)),
        status: "pending",
        notificationId: null
      }))
    );
  }

  const anchorDate = generationReminderAnchorDate(aggregate);
  if (!anchorDate) {
    await cancelInvoiceReminderTouchpointsForViewer(viewer, dealId);
    return [];
  }

  return getRepository().upsertInvoiceReminderTouchpoints(
    viewer.id,
    dealId,
    TOUCHPOINT_OFFSETS.map((offsetDays) => ({
      anchorDate,
      offsetDays,
      sendOn: startOfDayIso(addDays(anchorDate, offsetDays)),
      status: "pending",
      notificationId: null
    }))
  );
}

function invoiceReminderSeed(input: {
  userId: string;
  dealId: string;
  brandName: string;
  campaignName: string;
  reminderType: "generate" | "send";
  offsetDays: number;
  sendOn: string;
}) {
  const title =
    input.reminderType === "send"
      ? input.offsetDays === 0
        ? `${input.brandName} invoice is ready to send`
        : input.offsetDays === 1
          ? `${input.brandName} invoice has not been sent yet`
          : `${input.brandName} invoice send follow-up is due`
      : input.offsetDays === 0
        ? `${input.brandName} invoice is ready to generate`
        : input.offsetDays === 1
          ? `${input.brandName} invoice is still waiting`
          : `${input.brandName} invoice follow-up is due`;

  const description =
    input.reminderType === "send"
      ? input.offsetDays === 0
        ? `Your invoice for ${input.campaignName} is finalized. Send it from the linked inbox thread or export it now.`
        : input.offsetDays === 1
          ? `Your finalized invoice for ${input.campaignName} still has not been sent. Open the workspace invoice tab or linked inbox to send it.`
          : `It has been ${input.offsetDays} days since the invoice for ${input.campaignName} was finalized. Send or resend it if payment is still pending.`
      : input.offsetDays === 0
        ? `Today is the final posting milestone for ${input.campaignName}. Generate the workspace invoice now.`
        : input.offsetDays === 1
          ? `You still have not generated the invoice for ${input.campaignName}. Review the workspace invoice tab and send it when ready.`
          : `It has been ${input.offsetDays} days since the final posting milestone for ${input.campaignName}. Generate or attach the invoice if it is still outstanding.`;

  return {
    category: "payments" as const,
    eventType:
      (input.reminderType === "send"
        ? "invoice.send_prompt"
        : "invoice.generate_prompt") as "invoice.generate_prompt" | "invoice.send_prompt",
    entityType: "deal",
    entityId: input.dealId,
    dealId: input.dealId,
    title,
    description,
    href: `/app/p/${input.dealId}?tab=invoices`,
    dedupeKey: `invoice.${input.reminderType}_prompt:${input.dealId}:${input.offsetDays}`,
    createdAt: input.sendOn
  };
}

export async function syncAllInvoiceReminderTouchpoints() {
  if (!process.env.DATABASE_URL) {
    return 0;
  }

  const deals = await prisma.deal.findMany({
    where: {
      confirmedAt: { not: null }
    },
    include: {
      terms: true,
      documents: {
        select: {
          documentKind: true
        }
      }
    }
  });
  const invoiceRecords = deals.length
    ? await prisma.invoiceRecord.findMany({
        where: {
          dealId: { in: deals.map((deal) => deal.id) }
        },
        select: {
          dealId: true,
          draftSavedAt: true,
          finalizedAt: true,
          sentAt: true,
          status: true,
          pdfDocumentId: true,
          updatedAt: true
        }
      })
    : [];
  const invoiceRecordByDealId = new Map(
    invoiceRecords.map((record) => [record.dealId, record])
  );

  for (const deal of deals) {
    const invoiceRecord = invoiceRecordByDealId.get(deal.id);
    const generationAnchor = computeAnchorFromTerms(
      deal.terms
        ? {
            deliverables: Array.isArray(deal.terms.deliverables)
              ? (deal.terms.deliverables as unknown as DeliverableItem[])
              : [],
            campaignDateWindow:
              deal.terms.campaignDateWindow &&
              typeof deal.terms.campaignDateWindow === "object"
                ? (deal.terms.campaignDateWindow as unknown as NonNullable<
                    DealAggregate["terms"]
                  >["campaignDateWindow"])
                : null
          }
        : null
    );
    const sendAnchor =
      invoiceRecord?.status === "finalized" &&
      invoiceRecord.pdfDocumentId &&
      !invoiceRecord.sentAt
        ? startOfDayIso(
            invoiceRecord.finalizedAt ??
              invoiceRecord.draftSavedAt ??
              invoiceRecord.updatedAt
          )
        : null;

    if (!sendAnchor && !generationAnchor) {
      const existing = await getRepository().listInvoiceReminderTouchpoints(deal.userId, {
        dealId: deal.id
      });
      await Promise.all(
        existing
          .filter((touchpoint) => touchpoint.status === "pending")
          .map((touchpoint) =>
            getRepository().updateInvoiceReminderTouchpoint(touchpoint.id, {
              status: "cancelled"
            })
          )
      );
      continue;
    }

    await getRepository().upsertInvoiceReminderTouchpoints(
      deal.userId,
      deal.id,
      TOUCHPOINT_OFFSETS.map((offsetDays) => ({
        anchorDate: sendAnchor ?? generationAnchor!,
        offsetDays,
        sendOn: startOfDayIso(addDays(sendAnchor ?? generationAnchor!, offsetDays)),
        status: "pending",
        notificationId: null
      }))
    );
  }

  return deals.length;
}

export async function runInvoiceReminderSweep() {
  if (!process.env.DATABASE_URL) {
    return { processedDeals: 0, notified: 0 };
  }

  const processedDeals = await syncAllInvoiceReminderTouchpoints();
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const dueTouchpoints = await prisma.invoiceReminderTouchpoint.findMany({
    where: {
      status: "pending",
      sendOn: { lte: now }
    },
    include: {
      deal: {
        include: {
          documents: {
            select: {
              documentKind: true
            }
          }
        }
      }
    }
  });
  const invoiceRecords = dueTouchpoints.length
    ? await prisma.invoiceRecord.findMany({
        where: {
          dealId: { in: dueTouchpoints.map((touchpoint) => touchpoint.dealId) }
        },
        select: {
          dealId: true,
          draftSavedAt: true,
          finalizedAt: true,
          sentAt: true,
          status: true,
          pdfDocumentId: true,
          updatedAt: true
        }
      })
    : [];
  const invoiceRecordByDealId = new Map(
    invoiceRecords.map((record) => [record.dealId, record])
  );

  let notified = 0;

  for (const touchpoint of dueTouchpoints) {
    const invoiceRecord = invoiceRecordByDealId.get(touchpoint.dealId);
    const reminderType =
      invoiceRecord?.status === "finalized" && invoiceRecord.pdfDocumentId && !invoiceRecord.sentAt
        ? "send"
        : !invoiceRecord && !touchpoint.deal.documents.some((document) => document.documentKind === "invoice")
          ? "generate"
          : null;

    if (!reminderType) {
      await getRepository().updateInvoiceReminderTouchpoint(touchpoint.id, {
        status: "cancelled"
      });
      continue;
    }

    const notification = await emitNotificationSeedForUser(
      touchpoint.userId,
      invoiceReminderSeed({
        userId: touchpoint.userId,
        dealId: touchpoint.dealId,
        brandName: touchpoint.deal.brandName,
        campaignName: touchpoint.deal.campaignName,
        reminderType,
        offsetDays: touchpoint.offsetDays,
        sendOn: touchpoint.sendOn.toISOString()
      })
    );

    await getRepository().updateInvoiceReminderTouchpoint(touchpoint.id, {
      status: "sent",
      notificationId: notification?.id ?? null
    });
    notified += 1;
  }

  return { processedDeals, notified };
}
