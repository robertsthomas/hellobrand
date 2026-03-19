import { inngest } from "@/lib/inngest/client";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { startServerDebug } from "@/lib/server-debug";
import type { ConnectedEmailAccountRecord, DealAggregate, EmailThreadDetail, EmailThreadListItem, Viewer } from "@/lib/types";
import { decryptSecret, encryptSecret } from "@/lib/email/crypto";
import { generateEmailReplyDraft, generateEmailThreadSummary } from "@/lib/email/ai";
import { buildGoogleAuthUrl, exchangeGoogleCode, fetchGmailThreadsByIds, getGoogleProfile, listGmailHistoryThreadIds, listRecentGmailThreads, refreshGoogleAccessToken, registerGmailWatch } from "@/lib/email/providers/gmail";
import { buildOutlookAuthUrl, createOutlookSubscription, exchangeOutlookCode, fetchOutlookMessage, fetchOutlookThreadsByConversationIds, getOutlookProfile, listRecentOutlookThreads, refreshOutlookAccessToken, renewOutlookSubscription } from "@/lib/email/providers/outlook";
import { parseOAuthState } from "@/lib/email/oauth-state";
import { hasProviderConfig } from "@/lib/email/config";
import {
  disconnectConnectedEmailAccount,
  findConnectedEmailAccountByProviderAddress,
  findConnectedEmailAccountBySubscriptionId,
  getConnectedEmailAccount,
  getConnectedEmailAccountForUser,
  getEmailSyncState,
  getEmailThreadDetailForUser,
  linkEmailThreadToDeal,
  listAccountsNeedingRenewal,
  listConnectedEmailAccounts,
  listEmailThreadsForUser,
  listLinkedEmailThreadsForDeal,
  saveConnectedEmailAccount,
  saveEmailThreadSummary,
  saveSyncedEmailThread,
  unlinkEmailThreadFromDeal,
  updateConnectedEmailAccount,
  upsertEmailSyncState
} from "@/lib/email/repository";

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

function redirectTarget(pathname: string, searchParams?: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
}

function tokenExpiresAt(expiresIn: number | undefined) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function enqueueEmailEvent(name: string, data: Record<string, unknown>) {
  if (hasInngestEventKey()) {
    try {
      await inngest.send({ name, data });
      return { mode: "inngest" as const };
    } catch {
      // fall through to local
    }
  }

  if (name === "email/account.initial_sync.requested") {
    await syncEmailAccount(String(data.accountId), { mode: "initial" });
  } else if (name === "email/account.incremental_sync.requested") {
    await syncEmailAccount(String(data.accountId), {
      mode: "incremental",
      gmailHistoryId:
        typeof data.gmailHistoryId === "string" ? data.gmailHistoryId : null,
      outlookMessageIds: Array.isArray(data.outlookMessageIds)
        ? data.outlookMessageIds.filter((entry): entry is string => typeof entry === "string")
        : []
    });
  }

  return { mode: "local" as const };
}

async function ensureActiveTokens(account: ConnectedEmailAccountRecord) {
  const accessToken = decryptSecret(account.accessTokenEncrypted);
  const refreshToken = decryptSecret(account.refreshTokenEncrypted);
  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
  const needsRefresh =
    !accessToken ||
    !expiresAt ||
    expiresAt <= Date.now() + 60 * 1000;

  if (!needsRefresh) {
    return { accessToken, refreshToken };
  }

  if (!refreshToken) {
    await updateConnectedEmailAccount(account.id, {
      status: "reconnect_required",
      lastErrorCode: "missing_refresh_token",
      lastErrorMessage: "Reconnect required."
    });
    throw new Error("Reconnect required.");
  }

  const refreshed =
    account.provider === "gmail"
      ? await refreshGoogleAccessToken(refreshToken)
      : await refreshOutlookAccessToken(refreshToken);

  const nextAccessToken = refreshed.access_token;
  const nextRefreshToken =
    "refresh_token" in refreshed && typeof refreshed.refresh_token === "string"
      ? refreshed.refresh_token
      : refreshToken;
  const updated = await updateConnectedEmailAccount(account.id, {
    accessTokenEncrypted: encryptSecret(nextAccessToken),
    refreshTokenEncrypted: encryptSecret(nextRefreshToken),
    tokenExpiresAt: tokenExpiresAt(refreshed.expires_in),
    status: "connected",
    lastErrorCode: null,
    lastErrorMessage: null
  });

  return {
    accessToken: decryptSecret(updated.accessTokenEncrypted),
    refreshToken: decryptSecret(updated.refreshTokenEncrypted)
  };
}

async function syncGmailAccount(
  account: ConnectedEmailAccountRecord,
  mode: "initial" | "incremental",
  gmailHistoryId?: string | null
) {
  const debug = startServerDebug("email_gmail_sync", {
    accountId: account.id,
    mode
  });

  try {
    const tokens = await ensureActiveTokens(account);
    const accessToken = tokens.accessToken;

    if (!accessToken) {
      throw new Error("Missing Google access token.");
    }

    const profile = await getGoogleProfile(accessToken);
    const syncState = await getEmailSyncState(account.id);
    let threadIds: string[] = [];
    let lastHistoryId = syncState?.lastHistoryId ?? profile.historyId;

    if (mode === "initial" || !syncState?.lastHistoryId) {
      const threads = await listRecentGmailThreads(accessToken, account.emailAddress, 20);

      for (const thread of threads) {
        await saveSyncedEmailThread(account.id, "gmail", thread);
      }
    } else {
      const history = await listGmailHistoryThreadIds(
        accessToken,
        gmailHistoryId ?? syncState.lastHistoryId
      );
      threadIds = history.threadIds;
      lastHistoryId = history.historyId;

      if (threadIds.length > 0) {
        const threads = await fetchGmailThreadsByIds(accessToken, account.emailAddress, threadIds);
        for (const thread of threads) {
          await saveSyncedEmailThread(account.id, "gmail", thread);
        }
      }
    }

    const watch = await registerGmailWatch(accessToken);

    await updateConnectedEmailAccount(account.id, {
      status: "connected",
      lastSyncAt: new Date().toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null
    });
    await upsertEmailSyncState(account.id, {
      lastHistoryId: watch?.historyId ?? lastHistoryId,
      providerSubscriptionId: null,
      subscriptionExpiresAt: watch?.expiration ? new Date(Number(watch.expiration)).toISOString() : syncState?.subscriptionExpiresAt ?? null,
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null
    });

    debug.complete({
      threadCount: threadIds.length
    });
  } catch (error) {
    await updateConnectedEmailAccount(account.id, {
      status: String(error).toLowerCase().includes("reconnect") ? "reconnect_required" : "error",
      lastErrorCode: "gmail_sync_failed",
      lastErrorMessage: error instanceof Error ? error.message : "Gmail sync failed."
    });
    await upsertEmailSyncState(account.id, {
      lastErrorAt: new Date().toISOString(),
      lastErrorCode: "gmail_sync_failed",
      lastErrorMessage: error instanceof Error ? error.message : "Gmail sync failed."
    });
    debug.fail(error);
    throw error;
  }
}

async function syncOutlookAccount(
  account: ConnectedEmailAccountRecord,
  mode: "initial" | "incremental",
  outlookMessageIds?: string[]
) {
  const debug = startServerDebug("email_outlook_sync", {
    accountId: account.id,
    mode
  });

  try {
    const tokens = await ensureActiveTokens(account);
    const accessToken = tokens.accessToken;

    if (!accessToken) {
      throw new Error("Missing Outlook access token.");
    }

    let threads;
    if (mode === "initial" || !outlookMessageIds || outlookMessageIds.length === 0) {
      threads = await listRecentOutlookThreads(accessToken, account.emailAddress, 20);
    } else {
      const messagePayloads = await Promise.all(
        outlookMessageIds.map((messageId) => fetchOutlookMessage(accessToken, messageId))
      );
      const conversationIds = [...new Set(messagePayloads.map((message) => message.conversationId).filter(Boolean))];
      threads = await fetchOutlookThreadsByConversationIds(
        accessToken,
        account.emailAddress,
        conversationIds
      );
    }

    for (const thread of threads) {
      await saveSyncedEmailThread(account.id, "outlook", thread);
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

export async function syncEmailAccount(
  accountId: string,
  options?: {
    mode?: "initial" | "incremental";
    gmailHistoryId?: string | null;
    outlookMessageIds?: string[];
  }
) {
  const account = await getConnectedEmailAccount(accountId);
  if (!account || account.status === "disconnected") {
    return null;
  }

  await updateConnectedEmailAccount(account.id, {
    status: "syncing"
  });

  const mode = options?.mode ?? "initial";
  if (account.provider === "gmail") {
    await syncGmailAccount(account, mode, options?.gmailHistoryId ?? null);
  } else {
    await syncOutlookAccount(account, mode, options?.outlookMessageIds ?? []);
  }

  return getConnectedEmailAccount(account.id);
}

export async function renewExpiringEmailSubscriptions() {
  const accounts = await listAccountsNeedingRenewal(
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  );

  for (const account of accounts) {
    const tokens = await ensureActiveTokens(account);
    const accessToken = tokens.accessToken;
    if (!accessToken) {
      continue;
    }

    if (account.provider === "gmail") {
      const watch = await registerGmailWatch(accessToken);
      await upsertEmailSyncState(account.id, {
        subscriptionExpiresAt: watch?.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
        lastHistoryId: watch?.historyId ?? undefined
      });
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

export async function listEmailAccountsForViewer(viewer: Viewer) {
  return listConnectedEmailAccounts(viewer.id);
}

export async function listInboxThreadsForViewer(
  viewer: Viewer,
  filters?: {
    query?: string | null;
    provider?: string | null;
    accountId?: string | null;
    linkedDealId?: string | null;
    limit?: number;
  }
) {
  return listEmailThreadsForUser(viewer.id, filters);
}

export async function getEmailThreadForViewer(viewer: Viewer, threadId: string) {
  return getEmailThreadDetailForUser(viewer.id, threadId);
}

export async function listLinkedEmailThreadsForViewerDeal(viewer: Viewer, dealId: string) {
  return listLinkedEmailThreadsForDeal(viewer.id, dealId);
}

export async function linkThreadToDealForViewer(viewer: Viewer, threadId: string, dealId: string) {
  return linkEmailThreadToDeal(viewer.id, threadId, dealId);
}

export async function unlinkThreadFromDealForViewer(viewer: Viewer, threadId: string, dealId: string) {
  return unlinkEmailThreadFromDeal(viewer.id, threadId, dealId);
}

export async function disconnectEmailAccountForViewer(viewer: Viewer, accountId: string) {
  return disconnectConnectedEmailAccount(viewer.id, accountId);
}

export async function createGoogleConnectUrlForViewer(viewer: Viewer) {
  if (!hasProviderConfig("gmail")) {
    throw new Error("Google email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  return buildGoogleAuthUrl(createOAuthState(viewer.id, "gmail"));
}

export async function createOutlookConnectUrlForViewer(viewer: Viewer) {
  if (!hasProviderConfig("outlook")) {
    throw new Error("Outlook email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  return buildOutlookAuthUrl(createOAuthState(viewer.id, "outlook"));
}

export async function handleGoogleCallbackForViewer(
  viewer: Viewer,
  input: { code: string; state: string }
) {
  const state = parseOAuthState(input.state);
  if (state.userId !== viewer.id || state.provider !== "gmail") {
    throw new Error("Google OAuth state did not match the current session.");
  }

  const tokens = await exchangeGoogleCode(input.code);
  const profile = await getGoogleProfile(tokens.access_token);
  const account = await saveConnectedEmailAccount({
    userId: viewer.id,
    provider: "gmail",
    providerAccountId: profile.providerAccountId,
    emailAddress: profile.emailAddress,
    displayName: profile.displayName,
    scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    accessTokenEncrypted: encryptSecret(tokens.access_token),
    refreshTokenEncrypted: encryptSecret(tokens.refresh_token ?? null),
    tokenExpiresAt: tokenExpiresAt(tokens.expires_in),
    status: "connected"
  });

  await upsertEmailSyncState(account.id, {
    lastHistoryId: profile.historyId
  });
  await enqueueEmailEvent("email/account.initial_sync.requested", {
    accountId: account.id
  });

  return redirectTarget("/app/settings", {
    email_status: "connected",
    email_provider: "gmail"
  });
}

export async function handleOutlookCallbackForViewer(
  viewer: Viewer,
  input: { code: string; state: string }
) {
  const state = parseOAuthState(input.state);
  if (state.userId !== viewer.id || state.provider !== "outlook") {
    throw new Error("Outlook OAuth state did not match the current session.");
  }

  const tokens = await exchangeOutlookCode(input.code);
  const profile = await getOutlookProfile(tokens.access_token);
  const account = await saveConnectedEmailAccount({
    userId: viewer.id,
    provider: "outlook",
    providerAccountId: profile.providerAccountId,
    emailAddress: profile.emailAddress,
    displayName: profile.displayName,
    scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    accessTokenEncrypted: encryptSecret(tokens.access_token),
    refreshTokenEncrypted: encryptSecret(tokens.refresh_token ?? null),
    tokenExpiresAt: tokenExpiresAt(tokens.expires_in),
    status: "connected"
  });

  await enqueueEmailEvent("email/account.initial_sync.requested", {
    accountId: account.id
  });

  return redirectTarget("/app/settings", {
    email_status: "connected",
    email_provider: "outlook"
  });
}

export async function handleGmailWebhookNotification(payload: {
  emailAddress: string;
  historyId: string;
}) {
  const account = await findConnectedEmailAccountByProviderAddress("gmail", payload.emailAddress);
  if (!account) {
    return false;
  }

  await enqueueEmailEvent("email/account.incremental_sync.requested", {
    accountId: account.id,
    gmailHistoryId: payload.historyId
  });
  return true;
}

export async function handleOutlookWebhookNotifications(
  notifications: Array<{
    subscriptionId?: string;
    resource?: string;
    resourceData?: { id?: string };
  }>
) {
  const grouped = new Map<string, string[]>();

  for (const notification of notifications) {
    if (!notification.subscriptionId) {
      continue;
    }

    const account = await findConnectedEmailAccountBySubscriptionId(notification.subscriptionId);
    if (!account) {
      continue;
    }

    const messageId =
      notification.resourceData?.id ||
      notification.resource?.split("/").pop() ||
      null;

    if (!messageId) {
      continue;
    }

    const existing = grouped.get(account.id) ?? [];
    existing.push(messageId);
    grouped.set(account.id, existing);
  }

  for (const [accountId, messageIds] of grouped.entries()) {
    await enqueueEmailEvent("email/account.incremental_sync.requested", {
      accountId,
      outlookMessageIds: [...new Set(messageIds)]
    });
  }

  return grouped.size;
}

async function loadLinkedDealAggregate(
  viewer: Viewer,
  thread: EmailThreadDetail,
  explicitDealId?: string | null
) {
  const candidateDealId = explicitDealId ?? thread.links[0]?.dealId ?? null;
  if (!candidateDealId) {
    return null;
  }

  return getRepository().getDealAggregate(viewer.id, candidateDealId);
}

export async function summarizeEmailThreadForViewer(viewer: Viewer, threadId: string) {
  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  if (!detail) {
    return null;
  }

  const summary = await generateEmailThreadSummary(detail);
  await saveEmailThreadSummary(viewer.id, threadId, summary);
  return summary;
}

export async function draftReplyForViewer(
  viewer: Viewer,
  threadId: string,
  explicitDealId?: string | null
) {
  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  if (!detail) {
    return null;
  }

  const [deal, profile] = await Promise.all([
    loadLinkedDealAggregate(viewer, detail, explicitDealId),
    getProfileForViewer(viewer)
  ]);

  return generateEmailReplyDraft(detail, deal as DealAggregate | null, profile);
}
