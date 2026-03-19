import type { EmailDirection, EmailParticipant } from "@/lib/types";

export type ProviderAttachmentPayload = {
  providerAttachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type ProviderMessagePayload = {
  providerMessageId: string;
  internetMessageId: string | null;
  from: EmailParticipant | null;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  direction: EmailDirection;
  hasAttachments: boolean;
  attachments: ProviderAttachmentPayload[];
};

export type ProviderThreadPayload = {
  providerThreadId: string;
  subject: string;
  snippet: string | null;
  participants: EmailParticipant[];
  lastMessageAt: string;
  isContractRelated: boolean;
  messages: ProviderMessagePayload[];
};
