/**
 * This file handles connected inbox accounts and sync-state storage.
 * It keeps account lifecycle queries separate from thread content and candidate matching logic.
 */
import { prisma } from "@/lib/prisma";
import type { ConnectedEmailAccountRecord, EmailParticipant, EmailSyncStateRecord } from "@/lib/types";

import { iso, toAccountRecord, toJsonValue, toMessageRecord, toSyncStateRecord } from "./shared";
import { Prisma } from "@prisma/client";

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
