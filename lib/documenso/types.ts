/**
 * TypeScript types for the Documenso eSignature API.
 * Covers envelope, recipient, field, and webhook event shapes.
 */

export type DocumensoEnvelopeStatus = "DRAFT" | "PENDING" | "COMPLETED" | "REJECTED";
export type DocumensoRecipientRole = "SIGNER" | "APPROVER" | "CC" | "VIEWER";
export type DocumensoSigningStatus = "NOT_SIGNED" | "SIGNED" | "REJECTED";
export type DocumensoReadStatus = "NOT_OPENED" | "OPENED";
export type DocumensoSendStatus = "NOT_SENT" | "SENT";
export type DocumensoFieldType =
  | "SIGNATURE"
  | "INITIALS"
  | "NAME"
  | "EMAIL"
  | "DATE"
  | "TEXT"
  | "NUMBER"
  | "CHECKBOX"
  | "RADIO"
  | "DROPDOWN";

export interface DocumensoRecipient {
  id: number;
  email: string;
  name: string;
  role: DocumensoRecipientRole;
  signingStatus: DocumensoSigningStatus;
  readStatus: DocumensoReadStatus;
  sendStatus: DocumensoSendStatus;
  signingOrder?: number;
  token?: string;
  signedAt?: string | null;
  rejectionReason?: string | null;
}

export interface DocumensoField {
  id?: string;
  type: DocumensoFieldType;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  recipientId?: number;
  identifier?: number;
}

export interface DocumensoEnvelope {
  id: string;
  type: "DOCUMENT" | "TEMPLATE";
  status: DocumensoEnvelopeStatus;
  title: string;
  source: string;
  externalId?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  recipients: DocumensoRecipient[];
  fields?: DocumensoField[];
  documentMeta?: {
    subject?: string;
    message?: string;
    redirectUrl?: string;
    signingOrder?: string;
  };
}

export interface DocumensoListResponse {
  data: DocumensoEnvelope[];
  count: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
}

export interface DocumensoCreatePayload {
  type: "DOCUMENT";
  title: string;
  externalId?: string;
  recipients: {
    email: string;
    name: string;
    role: DocumensoRecipientRole;
    fields?: {
      identifier: number;
      type: DocumensoFieldType;
      page: number;
      positionX: number;
      positionY: number;
      width: number;
      height: number;
    }[];
  }[];
  meta?: {
    subject?: string;
    message?: string;
    redirectUrl?: string;
  };
}

export type DocumensoWebhookEvent =
  | "DOCUMENT_CREATED"
  | "DOCUMENT_SENT"
  | "DOCUMENT_OPENED"
  | "DOCUMENT_SIGNED"
  | "DOCUMENT_RECIPIENT_COMPLETED"
  | "DOCUMENT_COMPLETED"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_CANCELLED";

export interface DocumensoWebhookPayload {
  event: DocumensoWebhookEvent;
  payload: {
    id: number;
    externalId?: string | null;
    title: string;
    status: DocumensoEnvelopeStatus;
    completedAt?: string | null;
    recipients: DocumensoRecipient[];
  };
  createdAt: string;
  webhookEndpoint: string;
}
