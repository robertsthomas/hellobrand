/**
 * Domain orchestration for Documenso eSignature.
 * Creates envelopes from deal data, handles webhook events, and tracks signing status.
 */
import { prisma } from "@/lib/prisma";
import { createEnvelope, distributeEnvelope, getEnvelope } from "./client";
import type { DocumensoCreatePayload, DocumensoWebhookPayload } from "./types";

interface CreateSigningRequestInput {
  dealId: string;
  userId: string;
  pdfBuffer: Buffer;
  filename: string;
  title: string;
  recipients: { email: string; name: string; role: "SIGNER" | "APPROVER" | "CC" | "VIEWER" }[];
  redirectUrl?: string;
}

export async function createSigningRequest(input: CreateSigningRequestInput) {
  const { dealId, pdfBuffer, filename, title, recipients, redirectUrl } = input;

  const payload: DocumensoCreatePayload = {
    type: "DOCUMENT",
    title,
    externalId: dealId,
    recipients: recipients.map((r, _idx) => ({
      email: r.email,
      name: r.name,
      role: r.role,
      fields: [
        {
          identifier: 0,
          type: "SIGNATURE" as const,
          page: 1,
          positionX: 10,
          positionY: 80,
          width: 30,
          height: 5,
        },
        {
          identifier: 0,
          type: "DATE" as const,
          page: 1,
          positionX: 50,
          positionY: 80,
          width: 20,
          height: 3,
        },
      ],
    })),
    meta: {
      subject: `Please sign: ${title}`,
      message: `Please review and sign "${title}".`,
      ...(redirectUrl ? { redirectUrl } : {}),
    },
  };

  const envelope = await createEnvelope(payload, pdfBuffer, filename);

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      esignEnvelopeId: envelope.id,
      esignStatus: "DRAFT",
      esignUpdatedAt: new Date(),
    },
  });

  return envelope;
}

export async function sendSigningRequest(
  dealId: string,
  envelopeId: string,
  meta?: { subject?: string; message?: string }
) {
  const result = await distributeEnvelope(envelopeId, meta);

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      esignStatus: "PENDING",
      esignUpdatedAt: new Date(),
    },
  });

  return result;
}

export async function createAndSendSigningRequest(input: CreateSigningRequestInput) {
  const envelope = await createSigningRequest(input);
  return sendSigningRequest(input.dealId, envelope.id);
}

export async function handleDocumensoWebhook(body: DocumensoWebhookPayload) {
  const { event, payload } = body;
  const dealId = payload.externalId;
  if (!dealId) {
    return;
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId },
    select: { id: true, esignEnvelopeId: true },
  });
  if (!deal) {
    return;
  }

  switch (event) {
    case "DOCUMENT_SENT":
      await prisma.deal.update({
        where: { id: dealId },
        data: { esignStatus: "PENDING", esignUpdatedAt: new Date() },
      });
      break;

    case "DOCUMENT_SIGNED":
    case "DOCUMENT_RECIPIENT_COMPLETED":
      await prisma.deal.update({
        where: { id: dealId },
        data: { esignStatus: "PENDING", esignUpdatedAt: new Date() },
      });
      break;

    case "DOCUMENT_COMPLETED":
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          esignStatus: "COMPLETED",
          esignUpdatedAt: new Date(),
          countersignStatus: "signed",
        },
      });
      break;

    case "DOCUMENT_REJECTED":
      await prisma.deal.update({
        where: { id: dealId },
        data: { esignStatus: "REJECTED", esignUpdatedAt: new Date() },
      });
      break;

    case "DOCUMENT_CANCELLED":
      await prisma.deal.update({
        where: { id: dealId },
        data: { esignStatus: "DRAFT", esignUpdatedAt: new Date() },
      });
      break;
  }
}

export async function getSigningStatus(dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId },
    select: { esignEnvelopeId: true, esignStatus: true },
  });

  if (!deal?.esignEnvelopeId) {
    return null;
  }

  const envelope = await getEnvelope(deal.esignEnvelopeId);
  return {
    envelopeId: deal.esignEnvelopeId,
    status: envelope.status,
    recipients: envelope.recipients,
  };
}
