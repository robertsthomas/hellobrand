/**
 * This file handles inbox connection URLs, OAuth callbacks, and provider webhooks.
 * It keeps the provider-specific auth and webhook entry points separate from thread viewing and sync internals.
 */
import { resolveEmailAppBaseUrl, yahooScopes, hasProviderConfig } from "@/lib/email/config";
import { encryptSecret } from "@/lib/email/crypto";
import { parseOAuthState } from "@/lib/email/oauth-state";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleProfile
} from "@/lib/email/providers/gmail";
import {
  buildOutlookAuthUrl,
  exchangeOutlookCode,
  getOutlookProfile
} from "@/lib/email/providers/outlook";
import {
  buildYahooAuthUrl,
  exchangeYahooCode,
  getYahooProfile,
  verifyYahooMailboxAccess
} from "@/lib/email/providers/yahoo";
import {
  findConnectedEmailAccountByProviderAddress,
  findConnectedEmailAccountBySubscriptionId,
  getEmailSyncState,
  listExistingEmailMessageProviderIdsForAccount,
  saveConnectedEmailAccount,
  upsertEmailSyncState
} from "@/lib/email/repository";
import {
  assertEmailConnectionsAccess,
  compareHistoryIds,
  isRecentIso,
  OUTLOOK_WEBHOOK_DEDUPE_WINDOW_MS,
  redirectTarget,
  tokenExpiresAt
} from "@/lib/email/service-shared";
import { enqueueEmailEvent } from "@/lib/email/service-sync";
import type { Viewer } from "@/lib/types";

export async function createGoogleConnectUrlForViewer(viewer: Viewer) {
  await assertEmailConnectionsAccess(viewer);
  if (!hasProviderConfig("gmail")) {
    throw new Error("Google email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  return buildGoogleAuthUrl(createOAuthState(viewer.id, "gmail"));
}

export async function createGoogleConnectUrlForViewerWithReturnBaseUrl(
  viewer: Viewer,
  returnBaseUrl: string | null | undefined
) {
  await assertEmailConnectionsAccess(viewer);
  if (!hasProviderConfig("gmail")) {
    throw new Error("Google email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  return buildGoogleAuthUrl(
    createOAuthState(viewer.id, "gmail", {
      returnBaseUrl: resolveEmailAppBaseUrl(returnBaseUrl)
    })
  );
}

export async function createOutlookConnectUrlForViewer(viewer: Viewer) {
  await assertEmailConnectionsAccess(viewer);
  if (!hasProviderConfig("outlook")) {
    throw new Error("Outlook email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  return buildOutlookAuthUrl(createOAuthState(viewer.id, "outlook"));
}

export async function createOutlookConnectUrlForViewerWithReturnBaseUrl(
  viewer: Viewer,
  returnBaseUrl: string | null | undefined
) {
  await assertEmailConnectionsAccess(viewer);
  if (!hasProviderConfig("outlook")) {
    throw new Error("Outlook email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  return buildOutlookAuthUrl(
    createOAuthState(viewer.id, "outlook", {
      returnBaseUrl: resolveEmailAppBaseUrl(returnBaseUrl)
    })
  );
}

export async function createYahooConnectUrlForViewer(viewer: Viewer) {
  await assertEmailConnectionsAccess(viewer);
  if (!hasProviderConfig("yahoo")) {
    throw new Error("Yahoo email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  const state = createOAuthState(viewer.id, "yahoo");
  return buildYahooAuthUrl(state, parseOAuthState(state).nonce);
}

export async function createYahooConnectUrlForViewerWithReturnBaseUrl(
  viewer: Viewer,
  returnBaseUrl: string | null | undefined
) {
  await assertEmailConnectionsAccess(viewer);
  if (!hasProviderConfig("yahoo")) {
    throw new Error("Yahoo email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  const state = createOAuthState(viewer.id, "yahoo", {
    returnBaseUrl: resolveEmailAppBaseUrl(returnBaseUrl)
  });
  return buildYahooAuthUrl(state, parseOAuthState(state).nonce);
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

  return `${resolveEmailAppBaseUrl(state.returnBaseUrl)}${redirectTarget("/app/settings", {
    email_status: "connected",
    email_provider: "gmail"
  })}`;
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

  return `${resolveEmailAppBaseUrl(state.returnBaseUrl)}${redirectTarget("/app/settings", {
    email_status: "connected",
    email_provider: "outlook"
  })}`;
}

export async function handleYahooCallbackForViewer(
  viewer: Viewer,
  input: { code: string; state: string }
) {
  const state = parseOAuthState(input.state);
  if (state.userId !== viewer.id || state.provider !== "yahoo") {
    throw new Error("Yahoo OAuth state did not match the current session.");
  }

  const tokens = await exchangeYahooCode(input.code);
  if (!tokens.refresh_token) {
    throw new Error("Yahoo token exchange did not return a refresh token.");
  }

  const profile = await getYahooProfile(tokens.access_token);
  const grantedScopes = (tokens.scope ?? "").split(/[ ,]+/).filter(Boolean);
  await verifyYahooMailboxAccess(profile.emailAddress, tokens.access_token);
  const account = await saveConnectedEmailAccount({
    userId: viewer.id,
    provider: "yahoo",
    providerAccountId: profile.providerAccountId,
    emailAddress: profile.emailAddress,
    displayName: profile.displayName,
    scopes: grantedScopes.length > 0 ? grantedScopes : yahooScopes,
    accessTokenEncrypted: encryptSecret(tokens.access_token),
    refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
    tokenExpiresAt: tokenExpiresAt(tokens.expires_in),
    status: "syncing"
  });

  await upsertEmailSyncState(account.id, {
    providerCursor: null,
    providerSubscriptionId: null,
    subscriptionExpiresAt: new Date().toISOString(),
    lastHistoryId: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null
  });
  await enqueueEmailEvent("email/account.initial_sync.requested", {
    accountId: account.id,
    recentLimit: 100
  });

  return `${resolveEmailAppBaseUrl(state.returnBaseUrl)}${redirectTarget("/app/settings", {
    email_status: "connected",
    email_provider: "yahoo"
  })}`;
}

export async function handleGmailWebhookNotification(payload: {
  emailAddress: string;
  historyId: string;
}) {
  const account = await findConnectedEmailAccountByProviderAddress("gmail", payload.emailAddress);
  if (!account) {
    return false;
  }

  const syncState = await getEmailSyncState(account.id);
  if (
    syncState?.lastHistoryId &&
    compareHistoryIds(payload.historyId, syncState.lastHistoryId) <= 0
  ) {
    return true;
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
    const syncState = await getEmailSyncState(accountId);
    const uniqueMessageIds = [...new Set(messageIds)];
    let pendingMessageIds = uniqueMessageIds;

    if (isRecentIso(syncState?.lastSuccessfulSyncAt, OUTLOOK_WEBHOOK_DEDUPE_WINDOW_MS)) {
      const existingMessageIds = new Set(
        await listExistingEmailMessageProviderIdsForAccount(accountId, uniqueMessageIds)
      );
      pendingMessageIds = uniqueMessageIds.filter((messageId) => !existingMessageIds.has(messageId));
    }

    if (pendingMessageIds.length === 0) {
      continue;
    }

    await enqueueEmailEvent("email/account.incremental_sync.requested", {
      accountId,
      outlookMessageIds: pendingMessageIds
    });
  }

  return grouped.size;
}
