/**
 * This file runs connected inbox sync and subscription renewal.
 * It keeps provider polling, incremental batching, and webhook-triggered sync orchestration out of the viewer-facing email service code.
 */
import { inngest } from "@/lib/inngest/client";
import { getViewerById } from "@/lib/auth";
import { startServerDebug } from "@/lib/server-debug";
import type { ConnectedEmailAccountRecord } from "@/lib/types";
import {
  fetchGmailThreadsByIds,
  getGoogleProfile,
  listGmailHistoryThreadIds,
  listRecentGmailThreads,
  registerGmailWatch
} from "@/lib/email/providers/gmail";
import {
  createOutlookSubscription,
  fetchOutlookMessage,
  fetchOutlookThreadsByConversationIds,
  listRecentOutlookThreads,
  renewOutlookSubscription
} from "@/lib/email/providers/outlook";
import {
  isYahooAppPasswordAccount,
  listRecentYahooThreads,
  listYahooThreadsSinceCursor
} from "@/lib/email/providers/yahoo";
import {
  acquireConnectedEmailAccountSyncLease,
  getConnectedEmailAccount,
  getEmailSyncState,
  listAccountsNeedingRenewal,
  listExistingEmailMessageProviderIdsForAccount,
  updateConnectedEmailAccount,
  upsertEmailSyncState
} from "@/lib/email/repository";
import {
  compareHistoryIds,
  EMAIL_INCREMENTAL_SYNC_BATCH_MAX_SIZE,
  EMAIL_INCREMENTAL_SYNC_BATCH_WINDOW,
  ensureActiveEmailCredentials,
  getEmailSyncState as getSharedEmailSyncState,
  isGmailResyncRequiredError,
  processLinkedThreadUpdates,
  refreshEmailDealSuggestionsForViewer,
  saveNonTransactionalSyncedThread,
  YAHOO_POLL_INTERVAL_MS,
  clearEmailResyncRequiredNotification,
  emitEmailResyncRequiredNotification
} from "@/lib/email/service-shared";

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

type IncrementalEmailSyncRequest = {
  accountId: string;
  gmailHistoryId?: string | null;
  outlookMessageIds?: string[];
};

export function coalesceIncrementalEmailSyncRequests(
  requests: IncrementalEmailSyncRequest[]
) {
  const accountId = String(requests[0]?.accountId ?? "");
  const filtered = requests.filter((request) => String(request.accountId) === accountId);

  let gmailHistoryId: string | null = null;
  for (const request of filtered) {
    const candidate =
      typeof request.gmailHistoryId === "string" && request.gmailHistoryId.trim().length > 0
        ? request.gmailHistoryId.trim()
        : null;

    if (!candidate) {
      continue;
    }

    if (!gmailHistoryId || compareHistoryIds(candidate, gmailHistoryId) > 0) {
      gmailHistoryId = candidate;
    }
  }

  const outlookMessageIds = [
    ...new Set(
      filtered.flatMap((request) =>
        Array.isArray(request.outlookMessageIds)
          ? request.outlookMessageIds.filter(
              (messageId): messageId is string =>
                typeof messageId === "string" && messageId.trim().length > 0
            )
          : []
      )
    )
  ];

  return {
    accountId,
    gmailHistoryId,
    outlookMessageIds,
    batchSize: filtered.length
  };
}

export function getIncrementalEmailSyncBatchConfig(): {
  maxSize: number;
  timeout: typeof EMAIL_INCREMENTAL_SYNC_BATCH_WINDOW;
} {
  return {
    maxSize: EMAIL_INCREMENTAL_SYNC_BATCH_MAX_SIZE,
    timeout: EMAIL_INCREMENTAL_SYNC_BATCH_WINDOW
  };
}

export async function runIncrementalEmailSync(
  requests: IncrementalEmailSyncRequest[]
) {
  const merged = coalesceIncrementalEmailSyncRequests(requests);
  if (!merged.accountId) {
    throw new Error("Missing accountId.");
  }

  const account = await getConnectedEmailAccount(merged.accountId);
  if (!account || account.status === "disconnected") {
    return {
      ok: true,
      accountId: merged.accountId,
      status: "skipped" as const,
      reason: "account_unavailable" as const,
      batchSize: merged.batchSize
    };
  }

  const syncState = await getEmailSyncState(account.id);

  if (
    account.provider === "gmail" &&
    merged.gmailHistoryId &&
    syncState?.lastHistoryId &&
    compareHistoryIds(merged.gmailHistoryId, syncState.lastHistoryId) <= 0
  ) {
    return {
      ok: true,
      accountId: account.id,
      status: "skipped" as const,
      reason: "stale_history_id" as const,
      batchSize: merged.batchSize
    };
  }

  let outlookMessageIds = merged.outlookMessageIds;
  if (account.provider === "outlook" && outlookMessageIds.length > 0) {
    const existingMessageIds = new Set(
      await listExistingEmailMessageProviderIdsForAccount(account.id, outlookMessageIds)
    );
    outlookMessageIds = outlookMessageIds.filter(
      (messageId) => !existingMessageIds.has(messageId)
    );

    if (outlookMessageIds.length === 0) {
      return {
        ok: true,
        accountId: account.id,
        status: "skipped" as const,
        reason: "known_message_ids" as const,
        batchSize: merged.batchSize
      };
    }
  }

  const syncedAccount = await syncEmailAccount(account.id, {
    mode: "incremental",
    gmailHistoryId: merged.gmailHistoryId,
    outlookMessageIds
  });

  if (syncedAccount?.status === "syncing") {
    return {
      ok: true,
      accountId: account.id,
      status: "skipped" as const,
      reason: "sync_in_progress" as const,
      batchSize: merged.batchSize
    };
  }

  return {
    ok: true,
    accountId: account.id,
    status: "synced" as const,
    batchSize: merged.batchSize,
    gmailHistoryId: merged.gmailHistoryId,
    outlookMessageCount: outlookMessageIds.length
  };
}

export async function enqueueEmailEvent(name: string, data: Record<string, unknown>) {
  if (!hasInngestEventKey()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Inngest email processing is required but INNGEST_EVENT_KEY is not configured for ${name}.`);
    }

    if (name === "email/account.initial_sync.requested") {
      await syncEmailAccount(String(data.accountId), {
        mode: "initial",
        recentLimit:
          typeof data.recentLimit === "number" ? data.recentLimit : undefined
      });
    } else if (name === "email/account.incremental_sync.requested") {
      await runIncrementalEmailSync([
        {
          accountId: String(data.accountId),
          gmailHistoryId:
            typeof data.gmailHistoryId === "string" ? data.gmailHistoryId : null,
          outlookMessageIds: Array.isArray(data.outlookMessageIds)
            ? data.outlookMessageIds.filter(
                (entry): entry is string => typeof entry === "string"
              )
            : []
        }
      ]);
    }

    return { mode: "local" as const };
  }

  if (hasInngestEventKey()) {
    const accountId = String(data.accountId ?? "");
    const gmailHistoryId =
      typeof data.gmailHistoryId === "string" ? data.gmailHistoryId.trim() : "";
    const outlookMessageIds = Array.isArray(data.outlookMessageIds)
      ? data.outlookMessageIds
          .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          .sort()
      : [];
    const eventIdParts = [name, accountId];

    if (gmailHistoryId) {
      eventIdParts.push(gmailHistoryId);
    }

    if (outlookMessageIds.length > 0) {
      eventIdParts.push(outlookMessageIds.join(","));
    }

    await inngest.send({
      id: eventIdParts.filter(Boolean).join(":"),
      name,
      data
    });

    return { mode: "inngest" as const };
  }
}

// fallow-ignore-next-line complexity
async function syncGmailAccount(
  account: ConnectedEmailAccountRecord,
  mode: "initial" | "incremental",
  gmailHistoryId?: string | null,
  recentLimit = 20
) {
  const debug = startServerDebug("email_gmail_sync", {
    accountId: account.id,
    mode
  });

  try {
    const tokens = await ensureActiveEmailCredentials(account);
    const accessToken = tokens.accessToken;

    if (!accessToken) {
      throw new Error("Missing Google access token.");
    }

    const syncState = await getSharedEmailSyncState(account.id);
    let threadIds: string[] = [];
    let lastHistoryId = syncState?.lastHistoryId ?? null;
    let subscriptionExpiresAt = syncState?.subscriptionExpiresAt ?? null;

    if (
      mode === "incremental" &&
      syncState?.lastHistoryId &&
      gmailHistoryId &&
      compareHistoryIds(gmailHistoryId, syncState.lastHistoryId) <= 0
    ) {
      debug.complete({
        threadCount: 0,
        skipped: "stale_history_id"
      });
      return;
    }

    if (mode === "initial" || !syncState?.lastHistoryId) {
      const profile = await getGoogleProfile(accessToken);
      lastHistoryId = lastHistoryId ?? profile.historyId;

      const threads = await listRecentGmailThreads(accessToken, account.emailAddress, recentLimit);

      for (const thread of threads) {
        const saved = await saveNonTransactionalSyncedThread(account, "gmail", thread);
        if (saved) {
          threadIds.push(saved.id);
        }
      }
    } else {
      let history;
      try {
        history = await listGmailHistoryThreadIds(
          accessToken,
          syncState.lastHistoryId
        );
      } catch (error) {
        const isStaleHistory =
          error instanceof Error &&
          error.message.includes("Gmail request failed (404)") &&
          (error.message.includes("Requested entity was not found") ||
            error.message.includes("\"reason\":\"notFound\"") ||
            error.message.includes("\"reason\": \"notFound\""));
        if (isStaleHistory) {
          throw new Error("GMAIL_RESYNC_REQUIRED");
        }
        throw error;
      }
      threadIds = history.threadIds;
      lastHistoryId = history.historyId;

      if (threadIds.length > 0) {
        const threads = await fetchGmailThreadsByIds(accessToken, account.emailAddress, threadIds);
        threadIds = [];
        for (const thread of threads) {
          const saved = await saveNonTransactionalSyncedThread(account, "gmail", thread);
          if (saved) {
            threadIds.push(saved.id);
          }
        }
      }
    }

    if (mode === "initial" || !syncState?.subscriptionExpiresAt) {
      const watch = await registerGmailWatch(accessToken);
      subscriptionExpiresAt = watch?.expiration
        ? new Date(Number(watch.expiration)).toISOString()
        : subscriptionExpiresAt;
    }

    await updateConnectedEmailAccount(account.id, {
      status: "connected",
      lastSyncAt: new Date().toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null
    });
    await upsertEmailSyncState(account.id, {
      lastHistoryId: lastHistoryId ?? undefined,
      providerSubscriptionId: null,
      subscriptionExpiresAt,
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null
    });
    await clearEmailResyncRequiredNotification(account.userId, account.id);

    const viewer = await getViewerById(account.userId);
    if (viewer && threadIds.length > 0) {
      await refreshEmailDealSuggestionsForViewer(viewer, {
        threadIds
      });
      await processLinkedThreadUpdates(viewer, threadIds);
    }

    debug.complete({
      threadCount: threadIds.length
    });
  } catch (error) {
    const requiresResync = isGmailResyncRequiredError(error);
    if (requiresResync) {
      await emitEmailResyncRequiredNotification({
        userId: account.userId,
        accountId: account.id,
        provider: "gmail",
        emailAddress: account.emailAddress
      });
    }

    await updateConnectedEmailAccount(account.id, {
      status: String(error).toLowerCase().includes("reconnect") ? "reconnect_required" : "error",
      lastErrorCode: requiresResync ? "gmail_resync_required" : "gmail_sync_failed",
      lastErrorMessage: requiresResync
        ? "Gmail inbox history expired and needs a fresh resync. Reconnect this inbox to start over."
        : error instanceof Error
          ? error.message
          : "Gmail sync failed."
    });
    await upsertEmailSyncState(account.id, {
      lastErrorAt: new Date().toISOString(),
      lastErrorCode: requiresResync ? "gmail_resync_required" : "gmail_sync_failed",
      lastErrorMessage: requiresResync
        ? "Gmail inbox history expired and needs a fresh resync. Reconnect this inbox to start over."
        : error instanceof Error
          ? error.message
          : "Gmail sync failed."
    });
    debug.fail(error);
    throw error;
  }
}

// fallow-ignore-next-line complexity
async function syncOutlookAccount(
  account: ConnectedEmailAccountRecord,
  mode: "initial" | "incremental",
  outlookMessageIds?: string[],
  recentLimit = 20
) {
  const debug = startServerDebug("email_outlook_sync", {
    accountId: account.id,
    mode
  });

  try {
    const tokens = await ensureActiveEmailCredentials(account);
    const accessToken = tokens.accessToken;

    if (!accessToken) {
      throw new Error("Missing Outlook access token.");
    }

    let threads;
    if (mode === "initial" || !outlookMessageIds || outlookMessageIds.length === 0) {
      threads = await listRecentOutlookThreads(accessToken, account.emailAddress, recentLimit);
    } else {
      const messagePayloads = await Promise.all(
        outlookMessageIds.map((messageId) => fetchOutlookMessage(accessToken, messageId))
      );
      const conversationIds = [
        ...new Set(
          messagePayloads.map((message) => message.conversationId).filter(Boolean)
        )
      ];
      threads = await fetchOutlookThreadsByConversationIds(
        accessToken,
        account.emailAddress,
        conversationIds
      );
    }

    const savedThreadIds: string[] = [];
    for (const thread of threads) {
      const saved = await saveNonTransactionalSyncedThread(account, "outlook", thread);
      if (saved) {
        savedThreadIds.push(saved.id);
      }
    }

    const subscription = await createOutlookSubscription(accessToken);

    await updateConnectedEmailAccount(account.id, {
      status: "connected",
      lastSyncAt: new Date().toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null
    });
    await upsertEmailSyncState(account.id, {
      providerSubscriptionId: subscription.id,
      subscriptionExpiresAt: subscription.expirationDateTime,
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null
    });

    const viewer = await getViewerById(account.userId);
    if (viewer && savedThreadIds.length > 0) {
      await refreshEmailDealSuggestionsForViewer(viewer, {
        threadIds: savedThreadIds
      });
      await processLinkedThreadUpdates(viewer, savedThreadIds);
    }

    debug.complete({
      threadCount: threads.length
    });
  } catch (error) {
    await updateConnectedEmailAccount(account.id, {
      status: String(error).toLowerCase().includes("reconnect") ? "reconnect_required" : "error",
      lastErrorCode: "outlook_sync_failed",
      lastErrorMessage: error instanceof Error ? error.message : "Outlook sync failed."
    });
    await upsertEmailSyncState(account.id, {
      lastErrorAt: new Date().toISOString(),
      lastErrorCode: "outlook_sync_failed",
      lastErrorMessage: error instanceof Error ? error.message : "Outlook sync failed."
    });
    debug.fail(error);
    throw error;
  }
}

// fallow-ignore-next-line complexity
async function syncYahooAccount(
  account: ConnectedEmailAccountRecord,
  mode: "initial" | "incremental",
  recentLimit = 100
) {
  const debug = startServerDebug("email_yahoo_sync", {
    accountId: account.id,
    mode
  });

  try {
    const credentials = await ensureActiveEmailCredentials(account);
    const appPassword = isYahooAppPasswordAccount(account.scopes);
    const yahooCredential = appPassword
      ? credentials.mailPassword
      : credentials.accessToken;

    if (!yahooCredential) {
      throw new Error(appPassword ? "Missing Yahoo app password." : "Missing Yahoo access token.");
    }

    const syncState = await getSharedEmailSyncState(account.id);
    const result =
      mode === "initial" || !syncState?.providerCursor
        ? await listRecentYahooThreads(account.emailAddress, yahooCredential, recentLimit, appPassword)
        : await listYahooThreadsSinceCursor(
            account.emailAddress,
            yahooCredential,
            syncState.providerCursor,
            Math.max(250, recentLimit),
            appPassword
          );

    const savedThreadIds: string[] = [];
    for (const thread of result.threads) {
      const saved = await saveNonTransactionalSyncedThread(account, "yahoo", thread);
      if (saved) {
        savedThreadIds.push(saved.id);
      }
    }

    await updateConnectedEmailAccount(account.id, {
      status: "connected",
      lastSyncAt: new Date().toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null
    });
    await upsertEmailSyncState(account.id, {
      providerCursor: result.cursor,
      providerSubscriptionId: null,
      subscriptionExpiresAt: new Date(Date.now() + YAHOO_POLL_INTERVAL_MS).toISOString(),
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null
    });

    const viewer = await getViewerById(account.userId);
    if (viewer && savedThreadIds.length > 0) {
      await refreshEmailDealSuggestionsForViewer(viewer, {
        threadIds: savedThreadIds
      });
      await processLinkedThreadUpdates(viewer, savedThreadIds);
    }

    debug.complete({
      threadCount: savedThreadIds.length
    });
  } catch (error) {
    await updateConnectedEmailAccount(account.id, {
      status: String(error).toLowerCase().includes("reconnect") ? "reconnect_required" : "error",
      lastErrorCode: "yahoo_sync_failed",
      lastErrorMessage: error instanceof Error ? error.message : "Yahoo sync failed."
    });
    await upsertEmailSyncState(account.id, {
      lastErrorAt: new Date().toISOString(),
      lastErrorCode: "yahoo_sync_failed",
      lastErrorMessage: error instanceof Error ? error.message : "Yahoo sync failed."
    });
    debug.fail(error);
    throw error;
  }
}

export async function syncEmailAccount(
  accountId: string,
  options?: {
    mode?: "initial" | "incremental";
    gmailHistoryId?: string | null;
    outlookMessageIds?: string[];
    recentLimit?: number;
  }
) {
  const account = await getConnectedEmailAccount(accountId);
  if (!account || account.status === "disconnected") {
    return null;
  }

  const acquired = await acquireConnectedEmailAccountSyncLease(
    account.id,
    new Date(Date.now() - 15 * 60 * 1000).toISOString()
  );
  if (!acquired) {
    return getConnectedEmailAccount(account.id);
  }

  const mode = options?.mode ?? "initial";
  if (account.provider === "gmail") {
    await syncGmailAccount(
      account,
      mode,
      options?.gmailHistoryId ?? null,
      options?.recentLimit ?? 20
    );
  } else if (account.provider === "outlook") {
    await syncOutlookAccount(
      account,
      mode,
      options?.outlookMessageIds ?? [],
      options?.recentLimit ?? 20
    );
  } else if (account.provider === "yahoo") {
    await syncYahooAccount(
      account,
      mode,
      options?.recentLimit ?? 100
    );
  } else {
    return getConnectedEmailAccount(account.id);
  }

  return getConnectedEmailAccount(account.id);
}

export async function renewExpiringEmailSubscriptions() {
  const accounts = await listAccountsNeedingRenewal(
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );

  for (const account of accounts) {
    if (account.provider === "gmail") {
      const tokens = await ensureActiveEmailCredentials(account);
      const accessToken = tokens.accessToken;
      if (!accessToken) {
        continue;
      }

      const watch = await registerGmailWatch(accessToken);
      await upsertEmailSyncState(account.id, {
        subscriptionExpiresAt: watch?.expiration
          ? new Date(Number(watch.expiration)).toISOString()
          : null
      });
      continue;
    }

    if (account.provider === "yahoo") {
      await syncEmailAccount(account.id, {
        mode: "incremental",
        recentLimit: 100
      });
      continue;
    }

    const tokens = await ensureActiveEmailCredentials(account);
    const accessToken = tokens.accessToken;
    if (!accessToken) {
      continue;
    }

    const state = await getEmailSyncState(account.id);
    if (!state?.providerSubscriptionId) {
      continue;
    }

    const renewed = await renewOutlookSubscription(accessToken, state.providerSubscriptionId);
    await upsertEmailSyncState(account.id, {
      providerSubscriptionId: renewed.id,
      subscriptionExpiresAt: renewed.expirationDateTime
    });
  }

  return accounts.length;
}
