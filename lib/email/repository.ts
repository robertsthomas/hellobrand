/**
 * This file reads and writes email-related records in Prisma.
 * It converts database rows into app records so the rest of the inbox code does not need to know about the table shape.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  ConnectedEmailAccountRecord,
  DealRecord,
  DealEmailLinkRecord,
  EmailActionItemRecord,
  EmailLinkRole,
  EmailDealCandidateMatchRecord,
  EmailDealCandidateMatchView,
  EmailDealEventRecord,
  EmailDealTermSuggestionRecord,
  EmailAttachmentRecord,
  EmailMessageRecord,
  EmailParticipant,
  EmailSyncStateRecord,
  EmailThreadDraftRecord,
  EmailThreadDetail,
  EmailThreadListItem,
  EmailThreadLinkView,
  EmailThreadNoteRecord,
  EmailThreadRecord,
  EmailThreadWorkflowState,
  BrandContactRecord
} from "@/lib/types";

function iso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toParticipants(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const participant = entry as Record<string, unknown>;

      const email = typeof participant.email === "string"
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

function toParticipant(value: unknown) {
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

function toAccountRecord(account: {
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
        ? Boolean(account.refreshTokenEncrypted && toStringArray(account.scopes).length > 0)
        : true,
    tokenExpiresAt: iso(account.tokenExpiresAt),
    lastSyncAt: iso(account.lastSyncAt),
    lastErrorCode: account.lastErrorCode,
    lastErrorMessage: account.lastErrorMessage,
    createdAt: iso(account.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(account.updatedAt) ?? new Date().toISOString()
  };
}

function toThreadRecord(thread: {
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

function toAttachmentRecord(attachment: {
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

function toMessageRecord(message: {
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

function toSyncStateRecord(state: {
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

function toLinkView(link: {
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

function toDraftRecord(draft: {
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

function toNoteRecord(note: {
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

function splitThreadLinks(links: EmailThreadLinkView[]) {
  const primaryLink = links.find((link) => link.role === "primary") ?? null;
  const referenceLinks = links.filter((link) => link.role !== "primary");
  return {
    primaryLink,
    referenceLinks
  };
}

function toCandidateMatchRecord(match: {
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

function toDealEventRecord(event: {
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

function toTermSuggestionRecord(suggestion: {
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

function toActionItemRecord(item: {
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

function toBrandContactRecord(contact: {
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

export async function listConnectedEmailAccounts(userId: string) {
  const accounts = await prisma.connectedEmailAccount.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }]
  });

  return accounts.map(toAccountRecord);
}

export async function getConnectedEmailAccount(accountId: string) {
  const account = await prisma.connectedEmailAccount.findUnique({
    where: { id: accountId }
  });

  return account ? toAccountRecord(account) : null;
}

export async function getEmailAttachmentForUser(userId: string, attachmentId: string) {
  const attachment = await prisma.emailAttachment.findFirst({
    where: {
      id: attachmentId,
      message: {
        thread: {
          account: {
            userId
          }
        }
      }
    },
    select: {
      id: true,
      messageId: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      storageKey: true,
      providerAttachmentId: true,
      message: {
        select: {
          providerMessageId: true,
          thread: {
            select: {
              id: true,
              account: true
            }
          }
        }
      }
    }
  });

  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    messageId: attachment.messageId,
    threadId: attachment.message.thread.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    storageKey: attachment.storageKey,
    providerAttachmentId: attachment.providerAttachmentId,
    providerMessageId: attachment.message.providerMessageId,
    account: toAccountRecord(attachment.message.thread.account)
  };
}

export async function saveOutboundEmailMessage(input: {
  userId: string;
  threadId: string;
  providerMessageId: string;
  internetMessageId: string | null;
  from: EmailParticipant | null;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  sentAt: string;
  attachments: Array<{
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string | null;
  }>;
}) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: input.threadId,
      account: {
        userId: input.userId
      }
    },
    include: {
      account: true
    }
  });

  if (!thread) {
    return null;
  }

  const existing = await prisma.emailMessage.findUnique({
    where: {
      threadId_providerMessageId: {
        threadId: input.threadId,
        providerMessageId: input.providerMessageId
      }
    },
    select: { id: true }
  });

  const message = await prisma.emailMessage.upsert({
    where: {
      threadId_providerMessageId: {
        threadId: input.threadId,
        providerMessageId: input.providerMessageId
      }
    },
    update: {
      internetMessageId: input.internetMessageId,
      fromJson: input.from ? toJsonValue(input.from) : Prisma.JsonNull,
      toJson: toJsonValue(input.to),
      ccJson: toJsonValue(input.cc),
      bccJson: toJsonValue(input.bcc),
      subject: input.subject,
      textBody: input.textBody,
      htmlBody: input.htmlBody,
      sentAt: new Date(input.sentAt),
      receivedAt: new Date(input.sentAt),
      direction: "outbound",
      hasAttachments: input.attachments.length > 0
    },
    create: {
      threadId: input.threadId,
      providerMessageId: input.providerMessageId,
      internetMessageId: input.internetMessageId,
      fromJson: input.from ? toJsonValue(input.from) : Prisma.JsonNull,
      toJson: toJsonValue(input.to),
      ccJson: toJsonValue(input.cc),
      bccJson: toJsonValue(input.bcc),
      subject: input.subject,
      textBody: input.textBody,
      htmlBody: input.htmlBody,
      sentAt: new Date(input.sentAt),
      receivedAt: new Date(input.sentAt),
      direction: "outbound",
      hasAttachments: input.attachments.length > 0
    }
  });

  await prisma.emailAttachment.deleteMany({
    where: { messageId: message.id }
  });

  if (input.attachments.length > 0) {
    await prisma.emailAttachment.createMany({
      data: input.attachments.map((attachment) => ({
        messageId: message.id,
        providerAttachmentId: attachment.providerAttachmentId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        storageKey: attachment.storageKey,
        extractedText: null
      }))
    });
  }

  await prisma.emailThread.update({
    where: { id: input.threadId },
    data: {
      subject: input.subject,
      snippet: input.textBody?.slice(0, 280) ?? null,
      lastMessageAt: new Date(input.sentAt),
      ...(existing
        ? {}
        : {
            messageCount: {
              increment: 1
            }
          })
    }
  });

  const saved = await prisma.emailMessage.findUniqueOrThrow({
    where: { id: message.id },
    include: {
      attachments: true
    }
  });

  return toMessageRecord(saved);
}

export async function getConnectedEmailAccountForUser(userId: string, accountId: string) {
  const account = await prisma.connectedEmailAccount.findFirst({
    where: { id: accountId, userId }
  });

  return account ? toAccountRecord(account) : null;
}

export async function findConnectedEmailAccountByProviderAddress(provider: string, emailAddress: string) {
  const account = await prisma.connectedEmailAccount.findFirst({
    where: {
      provider,
      emailAddress: emailAddress.trim().toLowerCase()
    }
  });

  return account ? toAccountRecord(account) : null;
}

export async function findConnectedEmailAccountBySubscriptionId(subscriptionId: string) {
  const syncState = await prisma.emailSyncState.findFirst({
    where: {
      providerSubscriptionId: subscriptionId
    },
    include: {
      account: true
    }
  });

  return syncState?.account ? toAccountRecord(syncState.account) : null;
}

export async function saveConnectedEmailAccount(input: {
  userId: string;
  provider: ConnectedEmailAccountRecord["provider"];
  providerAccountId: string;
  emailAddress: string;
  displayName: string | null;
  scopes: string[];
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: string | null;
  status: ConnectedEmailAccountRecord["status"];
}) {
  const existingByEmail = await prisma.connectedEmailAccount.findFirst({
    where: {
      userId: input.userId,
      provider: input.provider,
      emailAddress: input.emailAddress.toLowerCase()
    }
  });

  const saved = existingByEmail
    ? await prisma.connectedEmailAccount.update({
        where: { id: existingByEmail.id },
        data: {
          providerAccountId: input.providerAccountId,
          emailAddress: input.emailAddress.toLowerCase(),
          displayName: input.displayName,
          status: input.status,
          scopes: toJsonValue(input.scopes),
          accessTokenEncrypted: input.accessTokenEncrypted,
          refreshTokenEncrypted: input.refreshTokenEncrypted,
          tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null,
          lastErrorCode: null,
          lastErrorMessage: null
        }
      })
    : await prisma.connectedEmailAccount.upsert({
        where: {
          userId_provider_providerAccountId: {
            userId: input.userId,
            provider: input.provider,
            providerAccountId: input.providerAccountId
          }
        },
        update: {
          emailAddress: input.emailAddress.toLowerCase(),
          displayName: input.displayName,
          status: input.status,
          scopes: toJsonValue(input.scopes),
          accessTokenEncrypted: input.accessTokenEncrypted,
          refreshTokenEncrypted: input.refreshTokenEncrypted,
          tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null,
          lastErrorCode: null,
          lastErrorMessage: null
        },
        create: {
          userId: input.userId,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          emailAddress: input.emailAddress.toLowerCase(),
          displayName: input.displayName,
          status: input.status,
          scopes: toJsonValue(input.scopes),
          accessTokenEncrypted: input.accessTokenEncrypted,
          refreshTokenEncrypted: input.refreshTokenEncrypted,
          tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null
        }
      });

  return toAccountRecord(saved);
}

export async function updateConnectedEmailAccount(
  accountId: string,
  patch: Partial<
    Pick<
      ConnectedEmailAccountRecord,
      | "displayName"
      | "status"
      | "scopes"
      | "accessTokenEncrypted"
      | "refreshTokenEncrypted"
      | "tokenExpiresAt"
      | "lastSyncAt"
      | "lastErrorCode"
      | "lastErrorMessage"
    >
  >
) {
  const account = await prisma.connectedEmailAccount.update({
    where: { id: accountId },
    data: {
      displayName: patch.displayName,
      status: patch.status,
      scopes: patch.scopes ? toJsonValue(patch.scopes) : undefined,
      accessTokenEncrypted: patch.accessTokenEncrypted,
      refreshTokenEncrypted: patch.refreshTokenEncrypted,
      tokenExpiresAt:
        patch.tokenExpiresAt === undefined
          ? undefined
          : patch.tokenExpiresAt
            ? new Date(patch.tokenExpiresAt)
            : null,
      lastSyncAt:
        patch.lastSyncAt === undefined
          ? undefined
          : patch.lastSyncAt
            ? new Date(patch.lastSyncAt)
            : null,
      lastErrorCode: patch.lastErrorCode,
      lastErrorMessage: patch.lastErrorMessage
    }
  });

  return toAccountRecord(account);
}

export async function acquireConnectedEmailAccountSyncLease(
  accountId: string,
  staleBeforeIso: string
) {
  const result = await prisma.connectedEmailAccount.updateMany({
    where: {
      id: accountId,
      OR: [
        {
          status: {
            not: "syncing"
          }
        },
        {
          updatedAt: {
            lt: new Date(staleBeforeIso)
          }
        }
      ]
    },
    data: {
      status: "syncing"
    }
  });

  return result.count > 0;
}

export async function disconnectConnectedEmailAccount(userId: string, accountId: string) {
  const existing = await prisma.connectedEmailAccount.findFirst({
    where: {
      id: accountId,
      userId
    }
  });

  if (!existing) {
    return null;
  }

  const account = await prisma.connectedEmailAccount.update({
    where: { id: accountId },
    data: {
      status: "disconnected",
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null
    }
  });

  return toAccountRecord(account);
}

export async function getEmailSyncState(accountId: string) {
  const state = await prisma.emailSyncState.findUnique({
    where: { accountId }
  });

  return state ? toSyncStateRecord(state) : null;
}

export async function listExistingEmailMessageProviderIdsForAccount(
  accountId: string,
  providerMessageIds: string[]
) {
  if (providerMessageIds.length === 0) {
    return [];
  }

  const rows = await prisma.emailMessage.findMany({
    where: {
      providerMessageId: {
        in: providerMessageIds
      },
      thread: {
        accountId
      }
    },
    select: {
      providerMessageId: true
    }
  });

  return rows.map((row) => row.providerMessageId);
}

export async function upsertEmailSyncState(
  accountId: string,
  patch: Partial<
    Pick<
      EmailSyncStateRecord,
      | "providerCursor"
      | "providerSubscriptionId"
      | "subscriptionExpiresAt"
      | "lastHistoryId"
      | "lastSuccessfulSyncAt"
      | "lastErrorAt"
      | "lastErrorCode"
      | "lastErrorMessage"
    >
  >
) {
  const state = await prisma.emailSyncState.upsert({
    where: { accountId },
    update: {
      providerCursor: patch.providerCursor,
      providerSubscriptionId: patch.providerSubscriptionId,
      subscriptionExpiresAt:
        patch.subscriptionExpiresAt === undefined
          ? undefined
          : patch.subscriptionExpiresAt
            ? new Date(patch.subscriptionExpiresAt)
            : null,
      lastHistoryId: patch.lastHistoryId,
      lastSuccessfulSyncAt:
        patch.lastSuccessfulSyncAt === undefined
          ? undefined
          : patch.lastSuccessfulSyncAt
            ? new Date(patch.lastSuccessfulSyncAt)
            : null,
      lastErrorAt:
        patch.lastErrorAt === undefined
          ? undefined
          : patch.lastErrorAt
            ? new Date(patch.lastErrorAt)
            : null,
      lastErrorCode: patch.lastErrorCode,
      lastErrorMessage: patch.lastErrorMessage
    },
    create: {
      accountId,
      providerCursor: patch.providerCursor ?? null,
      providerSubscriptionId: patch.providerSubscriptionId ?? null,
      subscriptionExpiresAt: patch.subscriptionExpiresAt
        ? new Date(patch.subscriptionExpiresAt)
        : null,
      lastHistoryId: patch.lastHistoryId ?? null,
      lastSuccessfulSyncAt: patch.lastSuccessfulSyncAt
        ? new Date(patch.lastSuccessfulSyncAt)
        : null,
      lastErrorAt: patch.lastErrorAt ? new Date(patch.lastErrorAt) : null,
      lastErrorCode: patch.lastErrorCode ?? null,
      lastErrorMessage: patch.lastErrorMessage ?? null
    }
  });

  return toSyncStateRecord(state);
}

export async function saveSyncedEmailThread(
  accountId: string,
  provider: ConnectedEmailAccountRecord["provider"],
  payload: {
    providerThreadId: string;
    subject: string;
    snippet: string | null;
    participants: EmailParticipant[];
    lastMessageAt: string;
    isContractRelated: boolean;
    messages: Array<{
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
      direction: EmailMessageRecord["direction"];
      hasAttachments: boolean;
      attachments: Array<{
        providerAttachmentId: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    }>;
  }
) {
  const result = await prisma.$transaction(async (tx) => {
    const existingThread = await tx.emailThread.findUnique({
      where: {
        accountId_providerThreadId: {
          accountId,
          providerThreadId: payload.providerThreadId
        }
      },
      select: {
        id: true,
        workflowState: true,
        lastMessageAt: true,
        dealLinks: {
          select: {
            role: true
          }
        }
      }
    });
    const hasPrimaryLink = existingThread?.dealLinks.some((link) => link.role === "primary") ?? false;
    const latestInboundAt = payload.messages
      .filter((message) => message.direction === "inbound")
      .map((message) => message.receivedAt ?? message.sentAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
    const hasNewInboundActivity =
      !existingThread ||
      (latestInboundAt
        ? new Date(latestInboundAt).getTime() > existingThread.lastMessageAt.getTime()
        : false);
    const nextWorkflowState =
      hasNewInboundActivity && existingThread?.workflowState !== "closed"
        ? hasPrimaryLink
          ? "needs_review"
          : "unlinked"
        : existingThread?.workflowState ?? (hasPrimaryLink ? "needs_review" : "unlinked");

    const thread = await tx.emailThread.upsert({
      where: {
        accountId_providerThreadId: {
          accountId,
          providerThreadId: payload.providerThreadId
        }
      },
      update: {
        provider,
        subject: payload.subject,
        snippet: payload.snippet,
        participantsJson: toJsonValue(payload.participants),
        lastMessageAt: new Date(payload.lastMessageAt),
        messageCount: payload.messages.length,
        isContractRelated: payload.isContractRelated,
        workflowState: nextWorkflowState
      },
      create: {
        accountId,
        provider,
        providerThreadId: payload.providerThreadId,
        subject: payload.subject,
        snippet: payload.snippet,
        participantsJson: toJsonValue(payload.participants),
        lastMessageAt: new Date(payload.lastMessageAt),
        messageCount: payload.messages.length,
        isContractRelated: payload.isContractRelated,
        workflowState: nextWorkflowState
      }
    });

    for (const message of payload.messages) {
      const savedMessage = await tx.emailMessage.upsert({
        where: {
          threadId_providerMessageId: {
            threadId: thread.id,
            providerMessageId: message.providerMessageId
          }
        },
        update: {
          internetMessageId: message.internetMessageId,
          fromJson: message.from ? toJsonValue(message.from) : Prisma.JsonNull,
          toJson: toJsonValue(message.to),
          ccJson: toJsonValue(message.cc),
          bccJson: toJsonValue(message.bcc),
          subject: message.subject,
          textBody: message.textBody,
          htmlBody: message.htmlBody,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          direction: message.direction,
          hasAttachments: message.hasAttachments
        },
        create: {
          threadId: thread.id,
          providerMessageId: message.providerMessageId,
          internetMessageId: message.internetMessageId,
          fromJson: message.from ? toJsonValue(message.from) : Prisma.JsonNull,
          toJson: toJsonValue(message.to),
          ccJson: toJsonValue(message.cc),
          bccJson: toJsonValue(message.bcc),
          subject: message.subject,
          textBody: message.textBody,
          htmlBody: message.htmlBody,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          direction: message.direction,
          hasAttachments: message.hasAttachments
        }
      });

      await tx.emailAttachment.deleteMany({
        where: { messageId: savedMessage.id }
      });

      if (message.attachments.length > 0) {
        await tx.emailAttachment.createMany({
          data: message.attachments.map((attachment) => ({
            messageId: savedMessage.id,
            providerAttachmentId: attachment.providerAttachmentId,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            storageKey: null,
            extractedText: null
          }))
        });
      }
    }

    return tx.emailThread.findUniqueOrThrow({
      where: { id: thread.id }
    });
  }, { timeout: 30000 });

  return toThreadRecord(result);
}

export async function deleteSyncedEmailThread(
  accountId: string,
  providerThreadId: string
) {
  const existing = await prisma.emailThread.findUnique({
    where: {
      accountId_providerThreadId: {
        accountId,
        providerThreadId
      }
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    return null;
  }

  await prisma.emailThread.delete({
    where: {
      id: existing.id
    }
  });

  return existing.id;
}

export async function listEmailThreadsForUser(
  userId: string,
  filters?: {
    query?: string | null;
    provider?: string | null;
    accountId?: string | null;
    linkedDealId?: string | null;
    linkedOnly?: boolean;
    workflowState?: string | null;
    limit?: number;
  }
) {
  const recentEventThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await prisma.emailThread.findMany({
    where: {
      account: {
        userId,
        provider: filters?.provider ?? undefined,
        id: filters?.accountId ?? undefined
      },
      workflowState: filters?.workflowState ?? undefined,
      dealLinks: filters?.linkedOnly
        ? {
            some: {
              role: "primary",
              deal: {
                userId
              }
            }
          }
        : undefined
    },
    include: {
      account: true,
      dealLinks: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          deal: {
            select: {
              brandName: true,
              campaignName: true
            }
          }
        }
      },
      dealEvents: {
        where: {
          createdAt: {
            gte: recentEventThreshold
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          updatedAt: true
        },
        take: 12
      },
      termSuggestions: {
        where: {
          status: "pending"
        },
        select: {
          id: true,
          updatedAt: true
        }
      },
      actionItems: {
        where: {
          status: "pending"
        },
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          updatedAt: true
        },
        take: 20
      },
      drafts: {
        where: {
          userId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      },
      _count: {
        select: {
          notes: true
        }
      }
    },
    orderBy: {
      lastMessageAt: "desc"
    },
    take: Math.max(filters?.limit ?? 100, 1)
  });

  const query = filters?.query?.trim().toLowerCase() || null;

  return rows
    .map((row) => {
      const links = row.dealLinks.map(toLinkView);
      const { primaryLink, referenceLinks } = splitThreadLinks(links);

      return {
        thread: toThreadRecord(row),
        account: toAccountRecord(row.account),
        links,
        primaryLink,
        referenceLinks,
        importantEventCount: row.dealEvents.length + row.termSuggestions.length,
        latestImportantEventAt:
          [...row.dealEvents, ...row.termSuggestions]
            .map((event) => iso(event.updatedAt))
            .sort((left, right) => (right ?? "").localeCompare(left ?? ""))
            .find((value): value is string => Boolean(value)) ?? null,
        pendingTermSuggestionCount: row.termSuggestions.length,
        pendingActionItemCount: row.actionItems.length,
        latestPendingActionItemAt:
          row.actionItems
            .map((item) => iso(item.updatedAt))
            .find((value): value is string => Boolean(value)) ?? null,
        savedDraft: row.drafts[0] ? toDraftRecord(row.drafts[0]) : null,
        noteCount: row._count.notes
      };
    })
    .filter((row) => {
      if (filters?.linkedDealId && !row.links.some((link) => link.dealId === filters.linkedDealId)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        row.thread.subject,
        row.thread.snippet ?? "",
        ...row.thread.participants.flatMap((participant) => [participant.name ?? "", participant.email]),
        ...row.links.flatMap((link) => [link.brandName, link.campaignName, link.dealName]),
        row.account.emailAddress,
        row.account.displayName ?? ""
      ]
        .join("\n")
        .toLowerCase();

      return haystack.includes(query);
    });
}

export async function getEmailThreadDetailForUser(userId: string, threadId: string): Promise<EmailThreadDetail | null> {
  const row = await prisma.emailThread.findFirst({
    where: {
      id: threadId,
      account: {
        userId
      }
    },
    include: {
      account: true,
      messages: {
        include: {
          attachments: true
        },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }]
      },
      dealLinks: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          deal: {
            select: {
              brandName: true,
              campaignName: true
            }
          }
        }
      },
      dealEvents: {
        orderBy: { createdAt: "desc" },
        take: 12
      },
      termSuggestions: {
        where: {
          status: "pending"
        },
        orderBy: { createdAt: "desc" },
        take: 8
      },
      actionItems: {
        where: {
          status: "pending"
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 20
      },
      drafts: {
        where: {
          userId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      },
      notes: {
        where: {
          userId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 20
      },
      _count: {
        select: {
          notes: true
        }
      }
    }
  });

  if (!row) {
    return null;
  }

  const links = row.dealLinks.map(toLinkView);
  const { primaryLink, referenceLinks } = splitThreadLinks(links);

  return {
    thread: toThreadRecord(row),
    account: toAccountRecord(row.account),
    messages: row.messages.map(toMessageRecord),
    links,
    primaryLink,
    referenceLinks,
    importantEvents: row.dealEvents.map(toDealEventRecord),
    termSuggestions: row.termSuggestions.map(toTermSuggestionRecord),
    actionItems: row.actionItems.map(toActionItemRecord),
    promiseDiscrepancies: [],
    crossDealConflicts: [],
    savedDraft: row.drafts[0] ? toDraftRecord(row.drafts[0]) : null,
    notes: row.notes.map(toNoteRecord),
    noteCount: row._count.notes
  };
}

export async function listLinkedEmailThreadsForDeal(userId: string, dealId: string) {
  const rows = await prisma.dealEmailLink.findMany({
    where: {
      dealId,
      deal: {
        userId
      }
    },
    include: {
      thread: {
        include: {
          account: true,
          dealEvents: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
              }
            },
            orderBy: {
              updatedAt: "desc"
            },
            select: {
              id: true,
              updatedAt: true
            },
            take: 12
          },
          termSuggestions: {
            where: {
              status: "pending"
            },
            select: {
              id: true,
              updatedAt: true
            }
          },
          actionItems: {
            where: {
              status: "pending"
            },
            orderBy: {
              updatedAt: "desc"
            },
            select: {
              id: true,
              updatedAt: true
            },
            take: 20
          },
          dealLinks: {
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            include: {
              deal: {
                select: {
                  brandName: true,
                  campaignName: true
                }
              }
            }
          }
          ,
          drafts: {
            where: {
              userId
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 1
          },
          _count: {
            select: {
              notes: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return rows.map((row) => {
    const links = row.thread.dealLinks.map(toLinkView);
    const { primaryLink, referenceLinks } = splitThreadLinks(links);

    return {
      thread: toThreadRecord(row.thread),
      account: toAccountRecord(row.thread.account),
      links,
      primaryLink,
      referenceLinks,
      importantEventCount: row.thread.dealEvents.length + row.thread.termSuggestions.length,
      latestImportantEventAt:
        [...row.thread.dealEvents, ...row.thread.termSuggestions]
          .map((event) => iso(event.updatedAt))
          .sort((left, right) => (right ?? "").localeCompare(left ?? ""))
          .find((value): value is string => Boolean(value)) ?? null,
      pendingTermSuggestionCount: row.thread.termSuggestions.length,
      pendingActionItemCount: row.thread.actionItems.length,
      latestPendingActionItemAt:
        row.thread.actionItems
          .map((item) => iso(item.updatedAt))
          .find((value): value is string => Boolean(value)) ?? null,
      savedDraft: row.thread.drafts[0] ? toDraftRecord(row.thread.drafts[0]) : null,
      noteCount: row.thread._count.notes
    };
  }) satisfies EmailThreadListItem[];
}

export async function linkEmailThreadToDeal(
  userId: string,
  threadId: string,
  dealId: string,
  source: DealEmailLinkRecord["linkSource"] = "manual",
  role: DealEmailLinkRecord["role"] = "reference",
  confidence: number | null = null
) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: threadId,
      account: {
        userId
      }
    },
    select: { id: true }
  });
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      userId
    },
    select: { id: true }
  });

  if (!thread || !deal) {
    return null;
  }

  const link = await prisma.$transaction(async (tx) => {
    if (role === "primary") {
      await tx.dealEmailLink.updateMany({
        where: {
          threadId,
          role: "primary"
        },
        data: {
          role: "reference"
        }
      });
    }

    const nextLink = await tx.dealEmailLink.upsert({
      where: {
        dealId_threadId: {
          dealId,
          threadId
        }
      },
      update: {
        linkSource: source,
        role,
        confidence
      },
      create: {
        dealId,
        threadId,
        linkSource: source,
        role,
        confidence
      }
    });

    await tx.emailThread.update({
      where: { id: threadId },
      data: {
        workflowState: role === "primary" ? "needs_review" : undefined
      }
    });

    return nextLink;
  });

  return {
    id: link.id,
    dealId: link.dealId,
    threadId: link.threadId,
    linkSource: link.linkSource as DealEmailLinkRecord["linkSource"],
    role: link.role as DealEmailLinkRecord["role"],
    confidence: link.confidence,
    createdAt: iso(link.createdAt) ?? new Date().toISOString()
  } satisfies DealEmailLinkRecord;
}

export async function unlinkEmailThreadFromDeal(userId: string, threadId: string, dealId: string) {
  const existing = await prisma.dealEmailLink.findFirst({
    where: {
      dealId,
      threadId,
      deal: {
        userId
      },
      thread: {
        account: {
          userId
        }
      }
    },
    select: { id: true, role: true }
  });

  if (!existing) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.dealEmailLink.delete({
      where: { id: existing.id }
    });

    const hasPrimaryLink = await tx.dealEmailLink.findFirst({
      where: {
        threadId,
        role: "primary"
      },
      select: { id: true }
    });

    await tx.emailThread.update({
      where: { id: threadId },
      data: {
        workflowState: hasPrimaryLink ? undefined : "unlinked"
      }
    });
  });
  return true;
}

export async function saveEmailThreadDraftForUser(input: {
  userId: string;
  threadId: string;
  subject: string;
  body: string;
  status: EmailThreadDraftRecord["status"];
  source: EmailThreadDraftRecord["source"];
}) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: input.threadId,
      account: {
        userId: input.userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const workflowState: EmailThreadWorkflowState =
    input.status === "ready" ? "draft_ready" : "needs_reply";

  const saved = await prisma.$transaction(async (tx) => {
    const draft = await tx.emailThreadDraft.upsert({
      where: {
        userId_threadId: {
          userId: input.userId,
          threadId: input.threadId
        }
      },
      update: {
        subject: input.subject,
        body: input.body,
        status: input.status,
        source: input.source
      },
      create: {
        userId: input.userId,
        threadId: input.threadId,
        subject: input.subject,
        body: input.body,
        status: input.status,
        source: input.source
      }
    });

    await tx.emailThread.update({
      where: { id: input.threadId },
      data: {
        workflowState,
        draftUpdatedAt: new Date()
      }
    });

    return draft;
  });

  return toDraftRecord(saved);
}

export async function getEmailThreadDraftForUser(userId: string, threadId: string) {
  const draft = await prisma.emailThreadDraft.findFirst({
    where: {
      userId,
      threadId,
      thread: {
        account: {
          userId
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return draft ? toDraftRecord(draft) : null;
}

export async function deleteEmailThreadDraftForUser(userId: string, threadId: string) {
  const existing = await prisma.emailThreadDraft.findFirst({
    where: {
      userId,
      threadId,
      thread: {
        account: {
          userId
        }
      }
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    return false;
  }

  await prisma.emailThreadDraft.delete({
    where: {
      id: existing.id
    }
  });

  return true;
}

export async function listEmailThreadNotesForUser(userId: string, threadId: string) {
  const notes = await prisma.emailThreadNote.findMany({
    where: {
      userId,
      threadId,
      thread: {
        account: {
          userId
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  return notes.map(toNoteRecord);
}

export async function createEmailThreadNoteForUser(input: {
  userId: string;
  threadId: string;
  body: string;
}) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: input.threadId,
      account: {
        userId: input.userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const note = await prisma.emailThreadNote.create({
    data: {
      userId: input.userId,
      threadId: input.threadId,
      body: input.body
    }
  });

  return toNoteRecord(note);
}

export async function updateEmailThreadWorkflowForUser(input: {
  userId: string;
  threadId: string;
  workflowState: EmailThreadWorkflowState;
}) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: input.threadId,
      account: {
        userId: input.userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const saved = await prisma.emailThread.update({
    where: {
      id: input.threadId
    },
    data: {
      workflowState: input.workflowState
    }
  });

  return toThreadRecord(saved);
}

export async function saveEmailThreadSummary(userId: string, threadId: string, summary: string) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: threadId,
      account: {
        userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const saved = await prisma.emailThread.update({
    where: { id: threadId },
    data: {
      aiSummary: summary,
      aiSummaryUpdatedAt: new Date()
    }
  });

  return toThreadRecord(saved);
}

export async function listEmailCandidateMatchesForUser(
  userId: string,
  status: EmailDealCandidateMatchRecord["status"] = "suggested"
) {
  const rows = await prisma.emailDealCandidateMatch.findMany({
    where: {
      userId,
      status
    },
    include: {
      deal: true,
      thread: {
        include: {
          account: true,
          dealLinks: {
            include: {
              deal: {
                select: {
                  brandName: true,
                  campaignName: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }]
  });

  return rows.map((row) => ({
    candidate: toCandidateMatchRecord(row),
    deal: {
      id: row.deal.id,
      userId: row.deal.userId,
      brandName: row.deal.brandName,
      campaignName: row.deal.campaignName,
      status: row.deal.status as DealRecord["status"],
      paymentStatus: row.deal.paymentStatus as DealRecord["paymentStatus"],
      countersignStatus: row.deal.countersignStatus as DealRecord["countersignStatus"],
      summary: row.deal.summary,
      legalDisclaimer: row.deal.legalDisclaimer,
      nextDeliverableDate: iso(row.deal.nextDeliverableDate),
      analyzedAt: iso(row.deal.analyzedAt),
      confirmedAt: iso(row.deal.confirmedAt),
      createdAt: iso(row.deal.createdAt) ?? new Date().toISOString(),
      updatedAt: iso(row.deal.updatedAt) ?? new Date().toISOString(),
      statusBeforeArchive: row.deal.statusBeforeArchive ?? null
    },
    thread: toThreadRecord(row.thread),
    account: toAccountRecord(row.thread.account),
    links: row.thread.dealLinks.map(toLinkView)
  })) satisfies EmailDealCandidateMatchView[];
}

export async function upsertEmailCandidateMatch(input: {
  userId: string;
  dealId: string;
  threadId: string;
  status: EmailDealCandidateMatchRecord["status"];
  confidence: number;
  reasons: string[];
  evidence: Record<string, unknown>;
  reviewedAt?: string | null;
}) {
  const saved = await prisma.emailDealCandidateMatch.upsert({
    where: {
      dealId_threadId: {
        dealId: input.dealId,
        threadId: input.threadId
      }
    },
    update: {
      userId: input.userId,
      status: input.status,
      confidence: input.confidence,
      reasonsJson: toJsonValue(input.reasons),
      evidenceJson: toJsonValue(input.evidence),
      reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null
    },
    create: {
      userId: input.userId,
      dealId: input.dealId,
      threadId: input.threadId,
      status: input.status,
      confidence: input.confidence,
      reasonsJson: toJsonValue(input.reasons),
      evidenceJson: toJsonValue(input.evidence),
      reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null
    }
  });

  return toCandidateMatchRecord(saved);
}

export async function getEmailCandidateMatchForUser(userId: string, candidateId: string) {
  const row = await prisma.emailDealCandidateMatch.findFirst({
    where: {
      id: candidateId,
      userId
    }
  });

  return row ? toCandidateMatchRecord(row) : null;
}

export async function getEmailCandidateMatchForDealThread(
  userId: string,
  dealId: string,
  threadId: string
) {
  const row = await prisma.emailDealCandidateMatch.findFirst({
    where: {
      userId,
      dealId,
      threadId
    }
  });

  return row ? toCandidateMatchRecord(row) : null;
}

export async function updateEmailCandidateMatchStatus(
  userId: string,
  candidateId: string,
  status: EmailDealCandidateMatchRecord["status"]
) {
  const existing = await prisma.emailDealCandidateMatch.findFirst({
    where: {
      id: candidateId,
      userId
    },
    select: { id: true }
  });

  if (!existing) {
    return null;
  }

  const saved = await prisma.emailDealCandidateMatch.update({
    where: { id: candidateId },
    data: {
      status,
      reviewedAt: new Date()
    }
  });

  return toCandidateMatchRecord(saved);
}

export async function markEmailCandidateMatchForDealThread(
  userId: string,
  dealId: string,
  threadId: string,
  status: EmailDealCandidateMatchRecord["status"]
) {
  const existing = await prisma.emailDealCandidateMatch.findFirst({
    where: {
      userId,
      dealId,
      threadId
    },
    select: { id: true }
  });

  if (!existing) {
    return null;
  }

  const saved = await prisma.emailDealCandidateMatch.update({
    where: { id: existing.id },
    data: {
      status,
      reviewedAt: new Date()
    }
  });

  return toCandidateMatchRecord(saved);
}

export async function saveEmailDealEvent(input: {
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  category: EmailDealEventRecord["category"];
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const saved = await prisma.emailDealEvent.upsert({
    where: {
      dealId_messageId_category: {
        dealId: input.dealId,
        messageId: input.messageId,
        category: input.category
      }
    },
    update: {
      title: input.title,
      body: input.body,
      metadataJson: toJsonValue(input.metadata ?? {})
    },
    create: {
      userId: input.userId,
      dealId: input.dealId,
      threadId: input.threadId,
      messageId: input.messageId,
      category: input.category,
      title: input.title,
      body: input.body,
      metadataJson: toJsonValue(input.metadata ?? {})
    }
  });

  return toDealEventRecord(saved);
}

export async function replaceEmailDealEventsForMessage(input: {
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  events: Array<{
    category: EmailDealEventRecord["category"];
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }>;
}) {
  const categories = [...new Set(input.events.map((event) => event.category))];

  if (categories.length === 0) {
    await prisma.emailDealEvent.deleteMany({
      where: {
        userId: input.userId,
        dealId: input.dealId,
        threadId: input.threadId,
        messageId: input.messageId
      }
    });

    return [];
  }

  await prisma.emailDealEvent.deleteMany({
    where: {
      userId: input.userId,
      dealId: input.dealId,
      threadId: input.threadId,
      messageId: input.messageId,
      category: {
        notIn: categories
      }
    }
  });

  return Promise.all(
    input.events.map((event) =>
      saveEmailDealEvent({
        userId: input.userId,
        dealId: input.dealId,
        threadId: input.threadId,
        messageId: input.messageId,
        category: event.category,
        title: event.title,
        body: event.body,
        metadata: event.metadata
      })
    )
  );
}

export async function listEmailDealEventsForThread(userId: string, threadId: string) {
  const rows = await prisma.emailDealEvent.findMany({
    where: {
      userId,
      threadId
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map(toDealEventRecord);
}

export async function saveEmailDealTermSuggestion(input: {
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  status?: EmailDealTermSuggestionRecord["status"];
  title: string;
  summary: string;
  patch: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}) {
  const saved = await prisma.emailDealTermSuggestion.upsert({
    where: {
      dealId_messageId: {
        dealId: input.dealId,
        messageId: input.messageId
      }
    },
    update: {
      status: input.status ?? "pending",
      title: input.title,
      summary: input.summary,
      patchJson: toJsonValue(input.patch),
      evidenceJson: toJsonValue(input.evidence ?? {})
    },
    create: {
      userId: input.userId,
      dealId: input.dealId,
      threadId: input.threadId,
      messageId: input.messageId,
      status: input.status ?? "pending",
      title: input.title,
      summary: input.summary,
      patchJson: toJsonValue(input.patch),
      evidenceJson: toJsonValue(input.evidence ?? {})
    }
  });

  return toTermSuggestionRecord(saved);
}

export async function listEmailDealTermSuggestionsForThread(userId: string, threadId: string) {
  const rows = await prisma.emailDealTermSuggestion.findMany({
    where: {
      userId,
      threadId,
      status: "pending"
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map(toTermSuggestionRecord);
}

export async function updateEmailDealTermSuggestionStatus(
  userId: string,
  suggestionId: string,
  status: EmailDealTermSuggestionRecord["status"]
) {
  const existing = await prisma.emailDealTermSuggestion.findFirst({
    where: {
      id: suggestionId,
      userId
    },
    select: { id: true }
  });

  if (!existing) {
    return null;
  }

  const saved = await prisma.emailDealTermSuggestion.update({
    where: { id: suggestionId },
    data: { status }
  });

  return toTermSuggestionRecord(saved);
}

export async function listAccountsNeedingRenewal(beforeIso: string) {
  const rows = await prisma.connectedEmailAccount.findMany({
    where: {
      status: {
        in: ["connected", "syncing"]
      },
      refreshTokenEncrypted: { not: null },
      syncState: {
        subscriptionExpiresAt: {
          lte: new Date(beforeIso)
        }
      }
    }
  });

  return rows.map(toAccountRecord);
}

export async function saveEmailActionItem(input: {
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  action: string;
  dueDate: string | null;
  urgency: EmailActionItemRecord["urgency"];
  status?: EmailActionItemRecord["status"];
  sourceText: string | null;
}) {
  const saved = await prisma.emailActionItem.upsert({
    where: {
      dealId_messageId_action: {
        dealId: input.dealId,
        messageId: input.messageId,
        action: input.action
      }
    },
    update: {
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      urgency: input.urgency,
      sourceText: input.sourceText
    },
    create: {
      userId: input.userId,
      dealId: input.dealId,
      threadId: input.threadId,
      messageId: input.messageId,
      action: input.action,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      urgency: input.urgency,
      status: input.status ?? "pending",
      sourceText: input.sourceText
    }
  });

  return toActionItemRecord(saved);
}

export async function listEmailActionItemsForDeal(userId: string, dealId: string, status?: string) {
  const rows = await prisma.emailActionItem.findMany({
    where: {
      userId,
      dealId,
      status: status ?? "pending"
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
  });

  return rows.map(toActionItemRecord);
}

export async function listEmailActionItemsForUser(userId: string, status?: string) {
  const rows = await prisma.emailActionItem.findMany({
    where: {
      userId,
      status: status ?? "pending"
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 50
  });

  return rows.map(toActionItemRecord);
}

export async function updateEmailActionItemStatus(
  userId: string,
  actionItemId: string,
  status: EmailActionItemRecord["status"]
) {
  const existing = await prisma.emailActionItem.findFirst({
    where: { id: actionItemId, userId },
    select: { id: true }
  });

  if (!existing) {
    return null;
  }

  const saved = await prisma.emailActionItem.update({
    where: { id: actionItemId },
    data: { status }
  });

  return toActionItemRecord(saved);
}

export async function upsertBrandContact(input: {
  userId: string;
  dealId: string;
  name: string;
  email: string;
  organization: string | null;
  inferredRole: string | null;
  lastSeenAt: string | null;
}) {
  const saved = await prisma.brandContact.upsert({
    where: {
      userId_dealId_email: {
        userId: input.userId,
        dealId: input.dealId,
        email: input.email.toLowerCase()
      }
    },
    update: {
      name: input.name,
      organization: input.organization,
      inferredRole: input.inferredRole,
      lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : null,
      messageCount: { increment: 1 }
    },
    create: {
      userId: input.userId,
      dealId: input.dealId,
      name: input.name,
      email: input.email.toLowerCase(),
      organization: input.organization,
      inferredRole: input.inferredRole,
      lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : null,
      messageCount: 1
    }
  });

  return toBrandContactRecord(saved);
}

export async function listBrandContactsForDeal(userId: string, dealId: string) {
  const rows = await prisma.brandContact.findMany({
    where: { userId, dealId },
    orderBy: [{ messageCount: "desc" }, { lastSeenAt: "desc" }]
  });

  return rows.map(toBrandContactRecord);
}

export async function saveEmailRiskFlag(input: {
  dealId: string;
  category: string;
  title: string;
  detail: string;
  severity: string;
  suggestedAction: string | null;
  evidence: string[];
  sourceType: string;
  sourceMessageId: string | null;
}) {
  const saved = await prisma.riskFlag.create({
    data: {
      dealId: input.dealId,
      category: input.category,
      title: input.title,
      detail: input.detail,
      severity: input.severity,
      suggestedAction: input.suggestedAction,
      evidence: toJsonValue(input.evidence),
      sourceType: input.sourceType,
      sourceMessageId: input.sourceMessageId
    }
  });

  return saved;
}

export async function listUpcomingActionItemDeadlines(beforeIso: string) {
  const rows = await prisma.emailActionItem.findMany({
    where: {
      status: "pending",
      dueDate: {
        lte: new Date(beforeIso),
        not: null
      }
    },
    orderBy: { dueDate: "asc" },
    take: 100
  });

  return rows.map(toActionItemRecord);
}
