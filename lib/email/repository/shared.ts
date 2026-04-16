/**
 * This file holds the shared Prisma-to-record mapping helpers for the email repository modules.
 * It keeps row-shape conversion in one place so the account, thread, and candidate files can stay focused on queries.
 */
import { Prisma } from "@prisma/client";

import type {
  BrandContactRecord,
  ConnectedEmailAccountRecord,
  EmailActionItemRecord,
  EmailAttachmentRecord,
  EmailDealCandidateMatchRecord,
  EmailDealEventRecord,
  EmailDealTermSuggestionRecord,
  EmailLinkRole,
  EmailMessageRecord,
  EmailParticipant,
  EmailSyncStateRecord,
  EmailThreadDraftRecord,
  EmailThreadLinkView,
  EmailThreadNoteRecord,
  EmailThreadRecord,
  EmailThreadWorkflowState
} from "@/lib/types";

export function iso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function toParticipants(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const participant = entry as Record<string, unknown>;
      const email =
        typeof participant.email === "string"
          ? participant.email.trim().toLowerCase()
          : "";

      if (!email) {
        return null;
      }

      return {
        name:
          typeof participant.name === "string"
            ? participant.name.trim() || null
            : null,
        email
      } satisfies EmailParticipant;
    })
    .filter((entry): entry is EmailParticipant => Boolean(entry));
}

export function toParticipant(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const participant = value as Record<string, unknown>;
  const email =
    typeof participant.email === "string"
      ? participant.email.trim().toLowerCase()
      : "";

  if (!email) {
    return null;
  }

  return {
    name:
      typeof participant.name === "string"
        ? participant.name.trim() || null
        : null,
    email
  } satisfies EmailParticipant;
}

export function toAccountRecord(account: {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  emailAddress: string;
  displayName: string | null;
  status: string;
  scopes: unknown;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  lastSyncAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ConnectedEmailAccountRecord {
  return {
    id: account.id,
    userId: account.userId,
    provider: account.provider as ConnectedEmailAccountRecord["provider"],
    providerAccountId: account.providerAccountId,
    emailAddress: account.emailAddress,
    displayName: account.displayName,
    status: account.status as ConnectedEmailAccountRecord["status"],
    scopes: toStringArray(account.scopes),
    accessTokenEncrypted: account.accessTokenEncrypted,
    refreshTokenEncrypted: account.refreshTokenEncrypted,
    mailAuthConfigured:
      account.provider === "yahoo"
        ? Boolean(
            account.refreshTokenEncrypted &&
              (toStringArray(account.scopes).includes("app_password") ||
                toStringArray(account.scopes).length > 0)
          )
        : true,
    tokenExpiresAt: iso(account.tokenExpiresAt),
    lastSyncAt: iso(account.lastSyncAt),
    lastErrorCode: account.lastErrorCode,
    lastErrorMessage: account.lastErrorMessage,
    createdAt: iso(account.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(account.updatedAt) ?? new Date().toISOString()
  };
}

export function toThreadRecord(thread: {
  id: string;
  accountId: string;
  provider: string;
  providerThreadId: string;
  subject: string;
  snippet: string | null;
  participantsJson: unknown;
  lastMessageAt: Date;
  messageCount: number;
  isContractRelated: boolean;
  aiSummary: string | null;
  aiSummaryUpdatedAt: Date | null;
  workflowState: string;
  draftUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailThreadRecord {
  return {
    id: thread.id,
    accountId: thread.accountId,
    provider: thread.provider as EmailThreadRecord["provider"],
    providerThreadId: thread.providerThreadId,
    subject: thread.subject,
    snippet: thread.snippet,
    participants: toParticipants(thread.participantsJson),
    lastMessageAt: iso(thread.lastMessageAt) ?? new Date().toISOString(),
    messageCount: thread.messageCount,
    isContractRelated: thread.isContractRelated,
    aiSummary: thread.aiSummary,
    aiSummaryUpdatedAt: iso(thread.aiSummaryUpdatedAt),
    workflowState: thread.workflowState as EmailThreadWorkflowState,
    draftUpdatedAt: iso(thread.draftUpdatedAt),
    createdAt: iso(thread.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(thread.updatedAt) ?? new Date().toISOString()
  };
}

export function toAttachmentRecord(attachment: {
  id: string;
  messageId: string;
  providerAttachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string | null;
  extractedText: string | null;
  createdAt: Date;
}): EmailAttachmentRecord {
  return {
    id: attachment.id,
    messageId: attachment.messageId,
    providerAttachmentId: attachment.providerAttachmentId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    storageKey: attachment.storageKey,
    extractedText: attachment.extractedText,
    createdAt: iso(attachment.createdAt) ?? new Date().toISOString()
  };
}

export function toMessageRecord(message: {
  id: string;
  threadId: string;
  providerMessageId: string;
  internetMessageId: string | null;
  fromJson: unknown;
  toJson: unknown;
  ccJson: unknown;
  bccJson: unknown;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  sentAt: Date | null;
  receivedAt: Date | null;
  direction: string;
  hasAttachments: boolean;
  rawStorageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Array<{
    id: string;
    messageId: string;
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string | null;
    extractedText: string | null;
    createdAt: Date;
  }>;
}): EmailMessageRecord {
  return {
    id: message.id,
    threadId: message.threadId,
    providerMessageId: message.providerMessageId,
    internetMessageId: message.internetMessageId,
    from: toParticipant(message.fromJson),
    to: toParticipants(message.toJson),
    cc: toParticipants(message.ccJson),
    bcc: toParticipants(message.bccJson),
    subject: message.subject,
    textBody: message.textBody,
    htmlBody: message.htmlBody,
    sentAt: iso(message.sentAt),
    receivedAt: iso(message.receivedAt),
    direction: message.direction as EmailMessageRecord["direction"],
    hasAttachments: message.hasAttachments,
    rawStorageKey: message.rawStorageKey,
    createdAt: iso(message.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(message.updatedAt) ?? new Date().toISOString(),
    attachments: (message.attachments ?? []).map(toAttachmentRecord)
  };
}

export function toSyncStateRecord(state: {
  id: string;
  accountId: string;
  providerCursor: string | null;
  providerSubscriptionId: string | null;
  subscriptionExpiresAt: Date | null;
  lastHistoryId: string | null;
  lastSuccessfulSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailSyncStateRecord {
  return {
    id: state.id,
    accountId: state.accountId,
    providerCursor: state.providerCursor,
    providerSubscriptionId: state.providerSubscriptionId,
    subscriptionExpiresAt: iso(state.subscriptionExpiresAt),
    lastHistoryId: state.lastHistoryId,
    lastSuccessfulSyncAt: iso(state.lastSuccessfulSyncAt),
    lastErrorAt: iso(state.lastErrorAt),
    lastErrorCode: state.lastErrorCode,
    lastErrorMessage: state.lastErrorMessage,
    createdAt: iso(state.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(state.updatedAt) ?? new Date().toISOString()
  };
}

export function toLinkView(link: {
  id: string;
  dealId: string;
  threadId: string;
  linkSource: string;
  role: string;
  confidence: number | null;
  createdAt: Date;
  deal: {
    brandName: string;
    campaignName: string;
  };
}): EmailThreadLinkView {
  return {
    id: link.id,
    dealId: link.dealId,
    threadId: link.threadId,
    dealName: link.deal.campaignName,
    brandName: link.deal.brandName,
    campaignName: link.deal.campaignName,
    linkSource: link.linkSource as EmailThreadLinkView["linkSource"],
    role: link.role as EmailLinkRole,
    confidence: link.confidence,
    createdAt: iso(link.createdAt) ?? new Date().toISOString()
  };
}

export function toDraftRecord(draft: {
  id: string;
  userId: string;
  threadId: string;
  subject: string;
  body: string;
  status: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}): EmailThreadDraftRecord {
  return {
    id: draft.id,
    userId: draft.userId,
    threadId: draft.threadId,
    subject: draft.subject,
    body: draft.body,
    status: draft.status as EmailThreadDraftRecord["status"],
    source: draft.source as EmailThreadDraftRecord["source"],
    createdAt: iso(draft.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(draft.updatedAt) ?? new Date().toISOString()
  };
}

export function toNoteRecord(note: {
  id: string;
  userId: string;
  threadId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}): EmailThreadNoteRecord {
  return {
    id: note.id,
    userId: note.userId,
    threadId: note.threadId,
    body: note.body,
    createdAt: iso(note.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(note.updatedAt) ?? new Date().toISOString()
  };
}

export function splitThreadLinks(links: EmailThreadLinkView[]) {
  const primaryLink = links.find((link) => link.role === "primary") ?? null;
  const referenceLinks = links.filter((link) => link.role !== "primary");
  return {
    primaryLink,
    referenceLinks
  };
}

export function toCandidateMatchRecord(match: {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  status: string;
  confidence: number;
  reasonsJson: unknown;
  evidenceJson: unknown;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailDealCandidateMatchRecord {
  return {
    id: match.id,
    userId: match.userId,
    dealId: match.dealId,
    threadId: match.threadId,
    status: match.status as EmailDealCandidateMatchRecord["status"],
    confidence: match.confidence,
    reasons: Array.isArray(match.reasonsJson)
      ? match.reasonsJson.filter((entry): entry is string => typeof entry === "string")
      : [],
    evidence:
      match.evidenceJson && typeof match.evidenceJson === "object"
        ? (match.evidenceJson as Record<string, unknown>)
        : {},
    reviewedAt: iso(match.reviewedAt),
    createdAt: iso(match.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(match.updatedAt) ?? new Date().toISOString()
  };
}

export function toDealEventRecord(event: {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  category: string;
  title: string;
  body: string;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): EmailDealEventRecord {
  return {
    id: event.id,
    userId: event.userId,
    dealId: event.dealId,
    threadId: event.threadId,
    messageId: event.messageId,
    category: event.category as EmailDealEventRecord["category"],
    title: event.title,
    body: event.body,
    metadata:
      event.metadataJson && typeof event.metadataJson === "object"
        ? (event.metadataJson as Record<string, unknown>)
        : {},
    createdAt: iso(event.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(event.updatedAt) ?? new Date().toISOString()
  };
}

export function toTermSuggestionRecord(suggestion: {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  status: string;
  title: string;
  summary: string;
  patchJson: unknown;
  evidenceJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): EmailDealTermSuggestionRecord {
  return {
    id: suggestion.id,
    userId: suggestion.userId,
    dealId: suggestion.dealId,
    threadId: suggestion.threadId,
    messageId: suggestion.messageId,
    status: suggestion.status as EmailDealTermSuggestionRecord["status"],
    title: suggestion.title,
    summary: suggestion.summary,
    patch:
      suggestion.patchJson && typeof suggestion.patchJson === "object"
        ? (suggestion.patchJson as Record<string, unknown>)
        : {},
    evidence:
      suggestion.evidenceJson && typeof suggestion.evidenceJson === "object"
        ? (suggestion.evidenceJson as Record<string, unknown>)
        : {},
    createdAt: iso(suggestion.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(suggestion.updatedAt) ?? new Date().toISOString()
  };
}

export function toActionItemRecord(item: {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  action: string;
  dueDate: Date | null;
  urgency: string;
  status: string;
  sourceText: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailActionItemRecord {
  return {
    id: item.id,
    userId: item.userId,
    dealId: item.dealId,
    threadId: item.threadId,
    messageId: item.messageId,
    action: item.action,
    dueDate: iso(item.dueDate),
    urgency: item.urgency as EmailActionItemRecord["urgency"],
    status: item.status as EmailActionItemRecord["status"],
    sourceText: item.sourceText,
    createdAt: iso(item.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(item.updatedAt) ?? new Date().toISOString()
  };
}

export function toBrandContactRecord(contact: {
  id: string;
  userId: string;
  dealId: string;
  name: string;
  email: string;
  organization: string | null;
  inferredRole: string | null;
  lastSeenAt: Date | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}): BrandContactRecord {
  return {
    id: contact.id,
    userId: contact.userId,
    dealId: contact.dealId,
    name: contact.name,
    email: contact.email,
    organization: contact.organization,
    inferredRole: contact.inferredRole,
    lastSeenAt: iso(contact.lastSeenAt),
    messageCount: contact.messageCount,
    createdAt: iso(contact.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(contact.updatedAt) ?? new Date().toISOString()
  };
}
