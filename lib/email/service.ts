/**
 * This file is the main entry point for viewer-facing inbox actions.
 * It keeps the app's public email service API stable while the sync, OAuth, and AI workflows live in smaller modules nearby.
 */
import { readStoredBytes, storeUploadedBytes } from "@/lib/storage";
import type {
  EmailDealCandidateMatchRecord,
  EmailLinkRole,
  EmailThreadDraftRecord,
  EmailThreadWorkflowState,
  Viewer,
} from "@/lib/types";
import { checkCrossDealConflicts } from "@/lib/email/conflict-bridge";
import { detectPromiseDiscrepancies } from "@/lib/email/smart-inbox";
import { fetchGmailAttachment, sendGmailThreadReply } from "@/lib/email/providers/gmail";
import { fetchOutlookAttachment, sendOutlookThreadReply } from "@/lib/email/providers/outlook";
import { fetchYahooAttachment, sendYahooThreadReply } from "@/lib/email/providers/yahoo";
import { getRepository } from "@/lib/repository";
import {
  createEmailThreadNoteForUser,
  deleteEmailThreadDraftForUser,
  disconnectConnectedEmailAccount,
  getEmailAttachmentForUser,
  getEmailCandidateMatchForUser,
  getEmailSyncState,
  getEmailThreadDetailForUser,
  getEmailThreadDraftForUser,
  linkEmailThreadToDeal,
  listConnectedEmailAccounts,
  listEmailCandidateMatchesForUser,
  listEmailThreadNotesForUser,
  listLinkedEmailThreadsForDeal,
  listEmailThreadsForUser,
  markEmailCandidateMatchForDealThread,
  saveEmailThreadDraftForUser,
  saveOutboundEmailMessage,
  unlinkEmailThreadFromDeal,
  updateEmailCandidateMatchStatus,
  updateEmailThreadWorkflowForUser,
} from "@/lib/email/repository";
import {
  assertEmailConnectionsAccess,
  assertPremiumInboxAccess,
  EMAIL_DISCOVERY_INITIAL_THREAD_LIMIT,
  EMAIL_DISCOVERY_SYNC_COOLDOWN_MS,
  ensureActiveEmailCredentials,
  groupCandidateMatches,
  isRecentIso,
  latestReplyTarget,
  primaryThreadDealId,
  primaryThreadLink,
  processLinkedThreadUpdates,
  refreshEmailDealSuggestionsForViewer,
  textBodyToHtml,
} from "@/lib/email/service-shared";
export type { IncrementalEmailSyncRequest } from "./service-sync";

export {
  coalesceIncrementalEmailSyncRequests,
  getIncrementalEmailSyncBatchConfig,
} from "./service-sync";

export async function runIncrementalEmailSync(
  ...args: Parameters<typeof import("./service-sync").runIncrementalEmailSync>
) {
  const module = await import("./service-sync");
  return module.runIncrementalEmailSync(...args);
}

export async function syncEmailAccount(
  ...args: Parameters<typeof import("./service-sync").syncEmailAccount>
) {
  const module = await import("./service-sync");
  return module.syncEmailAccount(...args);
}

export async function renewExpiringEmailSubscriptions() {
  const module = await import("./service-sync");
  return module.renewExpiringEmailSubscriptions();
}

export async function createGoogleConnectUrlForViewer(
  ...args: Parameters<typeof import("./service-connect").createGoogleConnectUrlForViewer>
) {
  const module = await import("./service-connect");
  return module.createGoogleConnectUrlForViewer(...args);
}

export async function createGoogleConnectUrlForViewerWithReturnBaseUrl(
  ...args: Parameters<
    typeof import("./service-connect").createGoogleConnectUrlForViewerWithReturnBaseUrl
  >
) {
  const module = await import("./service-connect");
  return module.createGoogleConnectUrlForViewerWithReturnBaseUrl(...args);
}

export async function createOutlookConnectUrlForViewer(
  ...args: Parameters<typeof import("./service-connect").createOutlookConnectUrlForViewer>
) {
  const module = await import("./service-connect");
  return module.createOutlookConnectUrlForViewer(...args);
}

export async function createOutlookConnectUrlForViewerWithReturnBaseUrl(
  ...args: Parameters<
    typeof import("./service-connect").createOutlookConnectUrlForViewerWithReturnBaseUrl
  >
) {
  const module = await import("./service-connect");
  return module.createOutlookConnectUrlForViewerWithReturnBaseUrl(...args);
}

export async function createYahooConnectUrlForViewer(
  ...args: Parameters<typeof import("./service-connect").createYahooConnectUrlForViewer>
) {
  const module = await import("./service-connect");
  return module.createYahooConnectUrlForViewer(...args);
}

export async function createYahooConnectUrlForViewerWithReturnBaseUrl(
  ...args: Parameters<
    typeof import("./service-connect").createYahooConnectUrlForViewerWithReturnBaseUrl
  >
) {
  const module = await import("./service-connect");
  return module.createYahooConnectUrlForViewerWithReturnBaseUrl(...args);
}

export async function handleGoogleCallbackForViewer(
  ...args: Parameters<typeof import("./service-connect").handleGoogleCallbackForViewer>
) {
  const module = await import("./service-connect");
  return module.handleGoogleCallbackForViewer(...args);
}

export async function handleOutlookCallbackForViewer(
  ...args: Parameters<typeof import("./service-connect").handleOutlookCallbackForViewer>
) {
  const module = await import("./service-connect");
  return module.handleOutlookCallbackForViewer(...args);
}

export async function handleYahooCallbackForViewer(
  ...args: Parameters<typeof import("./service-connect").handleYahooCallbackForViewer>
) {
  const module = await import("./service-connect");
  return module.handleYahooCallbackForViewer(...args);
}

export async function handleGmailWebhookNotification(
  ...args: Parameters<typeof import("./service-connect").handleGmailWebhookNotification>
) {
  const module = await import("./service-connect");
  return module.handleGmailWebhookNotification(...args);
}

export async function handleOutlookWebhookNotifications(
  ...args: Parameters<typeof import("./service-connect").handleOutlookWebhookNotifications>
) {
  const module = await import("./service-connect");
  return module.handleOutlookWebhookNotifications(...args);
}

export async function summarizeEmailThreadForViewer(
  ...args: Parameters<typeof import("./service-ai").summarizeEmailThreadForViewer>
) {
  const module = await import("./service-ai");
  return module.summarizeEmailThreadForViewer(...args);
}

export async function draftReplyForViewer(
  ...args: Parameters<typeof import("./service-ai").draftReplyForViewer>
) {
  const module = await import("./service-ai");
  return module.draftReplyForViewer(...args);
}

export async function streamDraftReplyForViewer(
  ...args: Parameters<typeof import("./service-ai").streamDraftReplyForViewer>
) {
  const module = await import("./service-ai");
  return module.streamDraftReplyForViewer(...args);
}

export async function listEmailAccountsForViewer(viewer: Viewer) {
  await assertEmailConnectionsAccess(viewer);
  if (!process.env.DATABASE_URL) {
    return [];
  }

  return listConnectedEmailAccounts(viewer.id);
}

export async function listInboxThreadsForViewer(
  viewer: Viewer,
  filters?: {
    query?: string | null;
    provider?: string | null;
    accountId?: string | null;
    linkedDealId?: string | null;
    linkedOnly?: boolean;
    workflowState?: EmailThreadWorkflowState | null;
    limit?: number;
  }
) {
  await assertPremiumInboxAccess(viewer);
  if (!process.env.DATABASE_URL) {
    return [];
  }

  return listEmailThreadsForUser(viewer.id, filters);
}

export async function getEmailThreadForViewer(viewer: Viewer, threadId: string) {
  await assertPremiumInboxAccess(viewer);
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  const primaryLink = detail ? primaryThreadLink(detail) : null;
  if (!detail || !primaryLink) {
    return detail;
  }

  const { listDealAggregatesForViewer } = await import("@/lib/deals");
  const allAggregates = await listDealAggregatesForViewer(viewer);
  const aggregate = allAggregates.find((item) => item.deal.id === primaryLink.dealId);
  if (!aggregate) {
    return detail;
  }

  for (const message of detail.messages) {
    const discrepancies = detectPromiseDiscrepancies(aggregate, message);
    detail.promiseDiscrepancies.push(...discrepancies);
  }

  const latestMessage = detail.messages[detail.messages.length - 1];
  if (latestMessage) {
    const conflicts = checkCrossDealConflicts(aggregate, allAggregates, latestMessage);
    detail.crossDealConflicts.push(...conflicts);
  }

  return detail;
}

export async function sendEmailThreadReplyForViewer(
  viewer: Viewer,
  threadId: string,
  input: {
    dealId?: string | null;
    subject: string;
    body: string;
    attachmentDocumentIds?: string[];
  }
) {
  await assertPremiumInboxAccess(viewer);
  if (!process.env.DATABASE_URL) {
    throw new Error("Connected inbox sending is unavailable without a database.");
  }

  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  if (!detail) {
    throw new Error("Email thread not found.");
  }

  const { anchor, to, cc, bcc } = latestReplyTarget(detail);
  if (to.length === 0) {
    throw new Error("Could not determine who to reply to in this thread.");
  }

  const account = detail.account;
  const credentials = await ensureActiveEmailCredentials(account);
  const accessToken = credentials.accessToken ?? "";
  const normalizedSubject = input.subject.trim() || detail.thread.subject;
  const normalizedBody = input.body.trim();

  if (!normalizedBody) {
    throw new Error("Reply body is required.");
  }

  const linkedDealId = primaryThreadDealId(detail, input.dealId ?? null);

  const attachmentDocuments = await Promise.all(
    (input.attachmentDocumentIds ?? []).map(async (documentId) => {
      const document = await getRepository().getDocument(documentId);
      if (!document || document.userId !== viewer.id) {
        throw new Error("Attachment document not found.");
      }

      if (linkedDealId && document.dealId !== linkedDealId) {
        throw new Error("Attachment document must belong to the linked workspace.");
      }

      return {
        document,
        bytes:
          document.sourceType === "pasted_text"
            ? Buffer.from(document.normalizedText ?? document.rawText ?? "", "utf8")
            : await readStoredBytes(document.storagePath),
      };
    })
  );

  const sendResult =
    account.provider === "gmail"
      ? await sendGmailThreadReply(accessToken, {
          threadId: detail.thread.providerThreadId,
          subject: normalizedSubject,
          body: normalizedBody,
          to,
          cc,
          bcc,
          inReplyTo: anchor?.internetMessageId ?? null,
          references: detail.messages
            .map((message) => message.internetMessageId)
            .filter((value): value is string => Boolean(value))
            .slice(-8),
          attachments: attachmentDocuments.map(({ document, bytes }) => ({
            filename: document.fileName,
            mimeType: document.mimeType,
            bytes,
          })),
        })
      : account.provider === "outlook"
        ? await sendOutlookThreadReply(accessToken, {
            replyToMessageId:
              anchor?.providerMessageId ??
              detail.messages[detail.messages.length - 1]?.providerMessageId ??
              (() => {
                throw new Error("Could not determine which Outlook message to reply to.");
              })(),
            threadId: detail.thread.providerThreadId,
            subject: normalizedSubject,
            body: normalizedBody,
            to,
            cc,
            bcc,
            attachments: attachmentDocuments.map(({ document, bytes }) => ({
              filename: document.fileName,
              mimeType: document.mimeType,
              bytes,
            })),
          })
        : await sendYahooThreadReply(account.emailAddress, accessToken, {
            threadId: detail.thread.providerThreadId,
            subject: normalizedSubject,
            body: normalizedBody,
            to,
            cc,
            bcc,
            inReplyTo: anchor?.internetMessageId ?? null,
            references: detail.messages
              .map((message) => message.internetMessageId)
              .filter((value): value is string => Boolean(value))
              .slice(-8),
            attachments: attachmentDocuments.map(({ document, bytes }) => ({
              filename: document.fileName,
              mimeType: document.mimeType,
              bytes,
            })),
          });

  const sentAt = new Date().toISOString();
  const savedMessage = await saveOutboundEmailMessage({
    userId: viewer.id,
    threadId: detail.thread.id,
    providerMessageId: sendResult.providerMessageId,
    internetMessageId: sendResult.internetMessageId,
    from: {
      name: account.displayName ?? viewer.displayName,
      email: account.emailAddress,
    },
    to: sendResult.to,
    cc: sendResult.cc,
    bcc: sendResult.bcc,
    subject: normalizedSubject,
    textBody: normalizedBody,
    htmlBody: textBodyToHtml(normalizedBody),
    sentAt,
    attachments: attachmentDocuments.map(({ document, bytes }) => ({
      providerAttachmentId: document.id,
      filename: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: bytes.length,
      storageKey: document.storagePath,
    })),
  });

  if (
    linkedDealId &&
    attachmentDocuments.some(({ document }) => document.documentKind === "invoice")
  ) {
    const { markInvoiceSentForViewer } = await import("@/lib/invoices");
    await markInvoiceSentForViewer(viewer, linkedDealId, {
      threadId: detail.thread.id,
      messageId: savedMessage?.id ?? null,
      accountId: account.id,
      provider: account.provider,
      toEmail: sendResult.to[0]?.email ?? to[0]?.email ?? null,
      subject: normalizedSubject,
    });
  }

  await deleteEmailThreadDraftForUser(viewer.id, detail.thread.id);
  await updateEmailThreadWorkflowForUser({
    userId: viewer.id,
    threadId: detail.thread.id,
    workflowState: "waiting_on_them",
  });

  return {
    threadId: detail.thread.id,
    messageId: savedMessage?.id ?? null,
  };
}

export async function getEmailAttachmentForViewer(viewer: Viewer, attachmentId: string) {
  await assertPremiumInboxAccess(viewer);
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const attachment = await getEmailAttachmentForUser(viewer.id, attachmentId);
  if (!attachment) {
    return null;
  }

  if (attachment.storageKey) {
    const bytes = await readStoredBytes(attachment.storageKey);
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType || "application/octet-stream",
      sizeBytes: attachment.sizeBytes || bytes.length,
      bytes,
    };
  }

  const credentials = await ensureActiveEmailCredentials(attachment.account);
  const accessToken = credentials.accessToken;

  if (
    !accessToken &&
    (attachment.account.provider === "gmail" ||
      attachment.account.provider === "outlook" ||
      attachment.account.provider === "yahoo")
  ) {
    throw new Error("Could not access the connected inbox.");
  }

  const providerAccessToken = accessToken ?? "";

  const payload =
    attachment.account.provider === "gmail"
      ? await fetchGmailAttachment(
          providerAccessToken,
          attachment.providerMessageId,
          attachment.providerAttachmentId
        )
      : attachment.account.provider === "outlook"
        ? await fetchOutlookAttachment(
            providerAccessToken,
            attachment.providerMessageId,
            attachment.providerAttachmentId
          )
        : attachment.account.provider === "yahoo"
          ? await fetchYahooAttachment(
              attachment.account.emailAddress,
              providerAccessToken,
              attachment.providerMessageId,
              attachment.providerAttachmentId
            )
          : null;

  if (!payload) {
    throw new Error("Attachment preview is not supported for this provider.");
  }

  return {
    filename: attachment.filename,
    mimeType: attachment.mimeType || "application/octet-stream",
    sizeBytes: payload.sizeBytes || attachment.sizeBytes,
    bytes: payload.bytes,
  };
}

export async function getSavedEmailThreadDraftForViewer(viewer: Viewer, threadId: string) {
  await assertPremiumInboxAccess(viewer);
  return getEmailThreadDraftForUser(viewer.id, threadId);
}

export async function saveEmailThreadDraftForViewer(
  viewer: Viewer,
  threadId: string,
  input: {
    subject: string;
    body: string;
    status: EmailThreadDraftRecord["status"];
    source: EmailThreadDraftRecord["source"];
  }
) {
  await assertPremiumInboxAccess(viewer);
  return saveEmailThreadDraftForUser({
    userId: viewer.id,
    threadId,
    subject: input.subject.trim(),
    body: input.body.trim(),
    status: input.status,
    source: input.source,
  });
}

export async function listEmailThreadNotesForViewer(viewer: Viewer, threadId: string) {
  await assertPremiumInboxAccess(viewer);
  return listEmailThreadNotesForUser(viewer.id, threadId);
}

export async function createEmailThreadNoteForViewer(
  viewer: Viewer,
  threadId: string,
  body: string
) {
  await assertPremiumInboxAccess(viewer);
  return createEmailThreadNoteForUser({
    userId: viewer.id,
    threadId,
    body: body.trim(),
  });
}

export async function updateEmailThreadWorkflowForViewer(
  viewer: Viewer,
  threadId: string,
  workflowState: EmailThreadWorkflowState
) {
  await assertPremiumInboxAccess(viewer);
  return updateEmailThreadWorkflowForUser({
    userId: viewer.id,
    threadId,
    workflowState,
  });
}

export async function importEmailAttachmentToWorkspaceForViewer(
  viewer: Viewer,
  attachmentId: string,
  dealId: string
) {
  await assertPremiumInboxAccess(viewer);
  if (!process.env.DATABASE_URL) {
    throw new Error("Connected inbox imports are unavailable without a database.");
  }

  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Workspace not found.");
  }

  const attachment = await getEmailAttachmentForViewer(viewer, attachmentId);
  const attachmentRecord = await getEmailAttachmentForUser(viewer.id, attachmentId);
  if (!attachment || !attachmentRecord) {
    throw new Error("Attachment not found.");
  }

  const attachmentBytes = Buffer.from(attachment.bytes);
  const { storagePath } = await storeUploadedBytes({
    fileName: attachment.filename,
    bytes: attachmentBytes,
    contentType: attachment.mimeType || "application/octet-stream",
    folder: dealId,
  });

  const document = await getRepository().createDocument({
    dealId,
    userId: viewer.id,
    fileName: attachment.filename,
    mimeType: attachment.mimeType || "application/octet-stream",
    storagePath,
    fileSizeBytes: attachmentBytes.length,
    checksumSha256: null,
    processingStatus: "pending",
    rawText: null,
    normalizedText: null,
    documentKind: "unknown",
    classificationConfidence: null,
    sourceType: "email_attachment",
    errorMessage: null,
    processingRunId: null,
    processingRunStateJson: null,
    processingStartedAt: null,
  });

  const { enqueueDocumentProcessing } = await import("@/lib/deals");
  await enqueueDocumentProcessing(document.id);

  return document;
}

export async function listLinkedEmailThreadsForViewerDeal(viewer: Viewer, dealId: string) {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  return listLinkedEmailThreadsForDeal(viewer.id, dealId);
}

export async function linkThreadToDealForViewer(
  viewer: Viewer,
  threadId: string,
  dealId: string,
  role: EmailLinkRole = "primary"
) {
  await assertPremiumInboxAccess(viewer);
  const link = await linkEmailThreadToDeal(viewer.id, threadId, dealId, "manual", role);
  if (link) {
    await markEmailCandidateMatchForDealThread(viewer.id, dealId, threadId, "confirmed");
    if (role === "primary") {
      await processLinkedThreadUpdates(viewer, [threadId]);
    }
  }
  return link;
}

export async function unlinkThreadFromDealForViewer(
  viewer: Viewer,
  threadId: string,
  dealId: string
) {
  await assertPremiumInboxAccess(viewer);
  const unlinked = await unlinkEmailThreadFromDeal(viewer.id, threadId, dealId);
  if (unlinked) {
    await markEmailCandidateMatchForDealThread(viewer.id, dealId, threadId, "rejected");
  }
  return unlinked;
}

export async function listDealEmailCandidatesForViewer(viewer: Viewer) {
  await assertPremiumInboxAccess(viewer);
  const matches = await listEmailCandidateMatchesForUser(viewer.id, "suggested");
  return groupCandidateMatches(matches);
}

export async function syncConnectedInboxAccountsForViewer(
  viewer: Viewer,
  options?: { force?: boolean }
) {
  await assertPremiumInboxAccess(viewer);
  const accounts = await listConnectedEmailAccounts(viewer.id);

  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      if (!options?.force) {
        const syncState = await getEmailSyncState(account.id);
        if (isRecentIso(syncState?.lastSuccessfulSyncAt, EMAIL_DISCOVERY_SYNC_COOLDOWN_MS)) {
          return { accountId: account.id, status: "skipped" as const };
        }
      }

      const syncModule = await import("./service-sync");
      await syncModule.syncEmailAccount(account.id, {
        mode: "incremental",
        recentLimit: EMAIL_DISCOVERY_INITIAL_THREAD_LIMIT,
      });
      return { accountId: account.id, status: "synced" as const };
    })
  );

  type SyncResult = { accountId: string; status: "skipped" | "synced" };
  const synced = results.filter(
    (r): r is PromiseFulfilledResult<SyncResult> => r.status === "fulfilled"
  );

  return {
    accountsProcessed: synced.length,
    accountsSkipped: synced.filter((r) => r.value.status === "skipped").length,
  };
}

export async function discoverDealEmailCandidatesForViewer(viewer: Viewer) {
  await assertPremiumInboxAccess(viewer);
  const accounts = await listConnectedEmailAccounts(viewer.id);

  await Promise.allSettled(
    accounts.map(async (account) => {
      const syncState = await getEmailSyncState(account.id);
      if (isRecentIso(syncState?.lastSuccessfulSyncAt, EMAIL_DISCOVERY_SYNC_COOLDOWN_MS)) {
        return null;
      }

      const syncModule = await import("./service-sync");
      return syncModule.syncEmailAccount(account.id, {
        mode: "incremental",
        recentLimit: EMAIL_DISCOVERY_INITIAL_THREAD_LIMIT,
      });
    })
  );

  await refreshEmailDealSuggestionsForViewer(viewer, { limit: 250 });
  return listDealEmailCandidatesForViewer(viewer);
}

export async function reviewDealEmailCandidatesForViewer(
  viewer: Viewer,
  input: {
    primaryCandidateId?: string | null;
    referenceIds?: string[];
    confirmIds?: string[];
    rejectIds?: string[];
  }
) {
  await assertPremiumInboxAccess(viewer);
  const confirmed: EmailDealCandidateMatchRecord[] = [];
  const rejected: EmailDealCandidateMatchRecord[] = [];

  const uniqueConfirmIds = [
    ...new Set([
      ...(input.confirmIds ?? []),
      ...(input.referenceIds ?? []),
      ...(input.primaryCandidateId ? [input.primaryCandidateId] : []),
    ]),
  ];
  const candidates = (
    await Promise.all(
      uniqueConfirmIds.map((candidateId) => getEmailCandidateMatchForUser(viewer.id, candidateId))
    )
  ).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const candidatesByThread = new Map<string, typeof candidates>();

  for (const candidate of candidates) {
    const existing = candidatesByThread.get(candidate.threadId) ?? [];
    existing.push(candidate);
    candidatesByThread.set(candidate.threadId, existing);
  }

  for (const threadCandidates of candidatesByThread.values()) {
    const preferredPrimaryCandidateId = threadCandidates.some(
      (candidate) => candidate.id === input.primaryCandidateId
    )
      ? input.primaryCandidateId
      : (threadCandidates[0]?.id ?? null);

    for (const candidate of threadCandidates) {
      const role: EmailLinkRole =
        candidate.id === preferredPrimaryCandidateId ? "primary" : "reference";
      const link = await linkEmailThreadToDeal(
        viewer.id,
        candidate.threadId,
        candidate.dealId,
        "ai_suggested",
        role,
        candidate.confidence
      );
      if (!link) {
        continue;
      }

      const saved = await updateEmailCandidateMatchStatus(viewer.id, candidate.id, "confirmed");
      if (saved) {
        confirmed.push(saved);
        if (role === "primary") {
          await processLinkedThreadUpdates(viewer, [saved.threadId]);
        }
      }
    }
  }

  for (const candidateId of input.rejectIds ?? []) {
    const saved = await updateEmailCandidateMatchStatus(viewer.id, candidateId, "rejected");
    if (saved) {
      rejected.push(saved);
    }
  }

  return {
    confirmed,
    rejected,
  };
}

export async function disconnectEmailAccountForViewer(viewer: Viewer, accountId: string) {
  await assertEmailConnectionsAccess(viewer);
  return disconnectConnectedEmailAccount(viewer.id, accountId);
}
