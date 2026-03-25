import { inngest } from "@/lib/inngest/client";
import { getViewerById } from "@/lib/auth";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { startServerDebug } from "@/lib/server-debug";
import type {
  ConnectedEmailAccountRecord,
  DealTermsRecord,
  DealAggregate,
  EmailDealCandidateMatchGroup,
  EmailDealCandidateMatchRecord,
  EmailThreadDetail,
  EmailThreadListItem,
  NegotiationStance,
  PendingExtractionData,
  Viewer
} from "@/lib/types";
import { decryptSecret, encryptSecret } from "@/lib/email/crypto";
import { generateEmailReplyDraft, generateEmailThreadSummary } from "@/lib/email/ai";
import { detectImportantEmailEvents, buildEmailTermSuggestion, detectPromiseDiscrepancies, scoreThreadAgainstDeal } from "@/lib/email/smart-inbox";
import { extractActionItemsFromMessage } from "@/lib/email/action-items";
import { checkCrossDealConflicts } from "@/lib/email/conflict-bridge";
import { buildGoogleAuthUrl, exchangeGoogleCode, fetchGmailThreadsByIds, getGoogleProfile, listGmailHistoryThreadIds, listRecentGmailThreads, refreshGoogleAccessToken, registerGmailWatch } from "@/lib/email/providers/gmail";
import { buildOutlookAuthUrl, createOutlookSubscription, exchangeOutlookCode, fetchOutlookMessage, fetchOutlookThreadsByConversationIds, getOutlookProfile, listRecentOutlookThreads, refreshOutlookAccessToken, renewOutlookSubscription } from "@/lib/email/providers/outlook";
import { buildYahooAuthUrl, exchangeYahooCode, getYahooProfile, refreshYahooAccessToken } from "@/lib/email/providers/yahoo";
import { parseOAuthState } from "@/lib/email/oauth-state";
import { hasProviderConfig, resolveEmailAppBaseUrl } from "@/lib/email/config";
import {
  assertViewerHasFeature
} from "@/lib/billing/entitlements";
import { listDealAggregatesForViewer, mergeTerms } from "@/lib/deals";
import { coalesceExtractions, hasMeaningfulChanges } from "@/lib/pending-changes";
import {
  clearEmailResyncRequiredNotification,
  emitEmailResyncRequiredNotification
} from "@/lib/notification-service";
import {
  disconnectConnectedEmailAccount,
  findConnectedEmailAccountByProviderAddress,
  findConnectedEmailAccountBySubscriptionId,
  acquireConnectedEmailAccountSyncLease,
  getConnectedEmailAccount,
  getEmailCandidateMatchForUser,
  getEmailCandidateMatchForDealThread,
  getConnectedEmailAccountForUser,
  getEmailSyncState,
  getEmailThreadDetailForUser,
  linkEmailThreadToDeal,
  listEmailCandidateMatchesForUser,
  listAccountsNeedingRenewal,
  listConnectedEmailAccounts,
  listEmailThreadsForUser,
  listLinkedEmailThreadsForDeal,
  markEmailCandidateMatchForDealThread,
  saveConnectedEmailAccount,
  saveEmailActionItem,
  saveEmailDealEvent,
  saveEmailDealTermSuggestion,
  saveEmailRiskFlag,
  saveEmailThreadSummary,
  saveSyncedEmailThread,
  upsertBrandContact,
  unlinkEmailThreadFromDeal,
  updateConnectedEmailAccount,
  updateEmailCandidateMatchStatus,
  upsertEmailCandidateMatch,
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

function isGmailResyncRequiredError(error: unknown) {
  return error instanceof Error && error.message === "GMAIL_RESYNC_REQUIRED";
}

async function assertPremiumInboxAccess(viewer: Viewer) {
  await assertViewerHasFeature(viewer, "premium_inbox");
}

async function assertEmailConnectionsAccess(viewer: Viewer) {
  await assertViewerHasFeature(viewer, "email_connections");
}

function groupCandidateMatches(
  matches: Awaited<ReturnType<typeof listEmailCandidateMatchesForUser>>
) {
  const grouped = new Map<string, EmailDealCandidateMatchGroup>();

  for (const match of matches) {
    const existing = grouped.get(match.deal.id);
    if (existing) {
      existing.matches.push(match);
      continue;
    }

    grouped.set(match.deal.id, {
      deal: match.deal,
      matches: [match]
    });
  }

  return [...grouped.values()].sort((left, right) => {
    const leftScore = left.matches[0]?.candidate.confidence ?? 0;
    const rightScore = right.matches[0]?.candidate.confidence ?? 0;
    return rightScore - leftScore;
  });
}

function emptyTermsPatch(
  aggregate: DealAggregate
): Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction"> {
  return {
    brandName: aggregate.terms?.brandName ?? aggregate.deal.brandName,
    agencyName: aggregate.terms?.agencyName ?? null,
    creatorName: aggregate.terms?.creatorName ?? null,
    campaignName: aggregate.terms?.campaignName ?? aggregate.deal.campaignName,
    paymentAmount: aggregate.terms?.paymentAmount ?? null,
    currency: aggregate.terms?.currency ?? null,
    paymentTerms: aggregate.terms?.paymentTerms ?? null,
    paymentStructure: aggregate.terms?.paymentStructure ?? null,
    netTermsDays: aggregate.terms?.netTermsDays ?? null,
    paymentTrigger: aggregate.terms?.paymentTrigger ?? null,
    deliverables: aggregate.terms?.deliverables ?? [],
    usageRights: aggregate.terms?.usageRights ?? null,
    usageRightsOrganicAllowed: aggregate.terms?.usageRightsOrganicAllowed ?? null,
    usageRightsPaidAllowed: aggregate.terms?.usageRightsPaidAllowed ?? null,
    whitelistingAllowed: aggregate.terms?.whitelistingAllowed ?? null,
    usageDuration: aggregate.terms?.usageDuration ?? null,
    usageTerritory: aggregate.terms?.usageTerritory ?? null,
    usageChannels: aggregate.terms?.usageChannels ?? [],
    exclusivity: aggregate.terms?.exclusivity ?? null,
    exclusivityApplies: aggregate.terms?.exclusivityApplies ?? null,
    exclusivityCategory: aggregate.terms?.exclusivityCategory ?? null,
    exclusivityDuration: aggregate.terms?.exclusivityDuration ?? null,
    exclusivityRestrictions: aggregate.terms?.exclusivityRestrictions ?? null,
    brandCategory: aggregate.terms?.brandCategory ?? null,
    competitorCategories: aggregate.terms?.competitorCategories ?? [],
    restrictedCategories: aggregate.terms?.restrictedCategories ?? [],
    campaignDateWindow: aggregate.terms?.campaignDateWindow ?? null,
    disclosureObligations: aggregate.terms?.disclosureObligations ?? [],
    revisions: aggregate.terms?.revisions ?? null,
    revisionRounds: aggregate.terms?.revisionRounds ?? null,
    termination: aggregate.terms?.termination ?? null,
    terminationAllowed: aggregate.terms?.terminationAllowed ?? null,
    terminationNotice: aggregate.terms?.terminationNotice ?? null,
    terminationConditions: aggregate.terms?.terminationConditions ?? null,
    governingLaw: aggregate.terms?.governingLaw ?? null,
    notes: aggregate.terms?.notes ?? null,
    manuallyEditedFields: aggregate.terms?.manuallyEditedFields ?? [],
    briefData: aggregate.terms?.briefData ?? null
  };
}

async function queueSmartInboxExpansion(accountIds: string[], recentLimit = 100) {
  for (const accountId of accountIds) {
    await enqueueEmailEvent("email/account.initial_sync.requested", {
      accountId,
      recentLimit
    });
  }
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
    await syncEmailAccount(String(data.accountId), {
      mode: "initial",
      recentLimit:
        typeof data.recentLimit === "number" ? data.recentLimit : undefined
    });
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
      : account.provider === "outlook"
        ? await refreshOutlookAccessToken(refreshToken)
        : await refreshYahooAccessToken(refreshToken);

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

async function refreshEmailDealSuggestionsForViewer(
  viewer: Viewer,
  options?: {
    threadIds?: string[];
    limit?: number;
  }
) {
  const [threads, aggregates] = await Promise.all([
    listEmailThreadsForUser(viewer.id, {
      limit: options?.limit ?? 250
    }),
    listDealAggregatesForViewer(viewer)
  ]);

  const threadIds = new Set(options?.threadIds ?? []);
  const scopedThreads =
    threadIds.size > 0 ? threads.filter((thread) => threadIds.has(thread.thread.id)) : threads;

  for (const thread of scopedThreads) {
    for (const aggregate of aggregates) {
      if (thread.links.some((link) => link.dealId === aggregate.deal.id)) {
        continue;
      }

      const match = scoreThreadAgainstDeal(thread, aggregate);
      if (!match) {
        continue;
      }

      const existing = await getEmailCandidateMatchForDealThread(
        viewer.id,
        aggregate.deal.id,
        thread.thread.id
      );
      if (existing?.status === "rejected") {
        continue;
      }

      await upsertEmailCandidateMatch({
        userId: viewer.id,
        dealId: aggregate.deal.id,
        threadId: thread.thread.id,
        status: "suggested",
        confidence: match.confidence,
        reasons: match.reasons,
        evidence: match.evidence
      });
    }
  }
}

async function applyEmailTermSuggestionToDeal(
  viewer: Viewer,
  dealId: string,
  patch: Partial<PendingExtractionData>
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const currentTermsBase = aggregate.terms ?? emptyTermsPatch(aggregate);
  const currentTermsRecord: DealTermsRecord = aggregate.terms ?? {
    id: `email-${dealId}`,
    dealId,
    ...currentTermsBase,
    pendingExtraction: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const existingPending = (aggregate.terms?.pendingExtraction as PendingExtractionData | null) ??
    currentTermsBase;
  const mergedPending = coalesceExtractions(
    existingPending,
    patch,
    (base, next) => {
      const merged = mergeTerms(
        {
          ...base,
          pendingExtraction: null
        },
        {
          ...next,
          pendingExtraction: null
        },
        {
          manuallyEditedFields: currentTermsBase.manuallyEditedFields ?? []
        }
      );
      const { pendingExtraction: _pendingExtraction, ...rest } = merged;
      return rest as PendingExtractionData;
    }
  );

  if (!hasMeaningfulChanges(currentTermsRecord, mergedPending)) {
    return null;
  }

  await getRepository().upsertTerms(dealId, {
    ...currentTermsBase,
    pendingExtraction: mergedPending
  });
  return mergedPending;
}

async function processLinkedThreadUpdates(
  viewer: Viewer,
  threadIds: string[]
) {
  const allAggregates = await listDealAggregatesForViewer(viewer);

  for (const threadId of threadIds) {
    const thread = await getEmailThreadDetailForUser(viewer.id, threadId);
    if (!thread || thread.links.length === 0) {
      continue;
    }

    for (const link of thread.links) {
      const aggregate = allAggregates.find((a) => a.deal.id === link.dealId);
      if (!aggregate) {
        continue;
      }

      for (const message of thread.messages) {
        // 1. Existing: detect important events
        const events = detectImportantEmailEvents(message);
        for (const event of events) {
          await saveEmailDealEvent({
            userId: viewer.id,
            dealId: link.dealId,
            threadId: thread.thread.id,
            messageId: message.id,
            category: event.category,
            title: event.title,
            body: event.body,
            metadata: event.metadata
          });
        }

        // 2. Existing: extract and apply term suggestions
        const suggestion = buildEmailTermSuggestion(aggregate, thread, message);
        if (suggestion) {
          const pendingPatch = await applyEmailTermSuggestionToDeal(
            viewer,
            link.dealId,
            suggestion.patch
          );
          if (pendingPatch) {
            await saveEmailDealTermSuggestion({
              userId: viewer.id,
              dealId: link.dealId,
              threadId: thread.thread.id,
              messageId: message.id,
              title: suggestion.title,
              summary: suggestion.summary,
              patch: suggestion.patch,
              evidence: suggestion.evidence
            });
          }
        }

        // 3. NEW: extract action items (Deal Pulse)
        const actionItems = await extractActionItemsFromMessage(message, aggregate);
        for (const item of actionItems) {
          await saveEmailActionItem({
            userId: viewer.id,
            dealId: link.dealId,
            threadId: thread.thread.id,
            messageId: message.id,
            action: item.action,
            dueDate: item.dueDate,
            urgency: item.urgency,
            sourceText: item.sourceText
          });
        }

        // 4. NEW: detect promise discrepancies (Promise Tracker)
        const discrepancies = detectPromiseDiscrepancies(aggregate, message);
        for (const discrepancy of discrepancies) {
          await saveEmailRiskFlag({
            dealId: link.dealId,
            category: discrepancy.field === "paymentAmount" ? "payment_terms"
              : discrepancy.field === "exclusivity" ? "exclusivity"
              : discrepancy.field === "deliverables" ? "deliverables"
              : discrepancy.field === "usageDuration" ? "usage_rights"
              : "other",
            title: `Email contradicts contract: ${discrepancy.field}`,
            detail: `Email claims "${discrepancy.emailClaim}" but contract says "${discrepancy.contractValue}".`,
            severity: discrepancy.severity,
            suggestedAction: "Review the email thread and compare with your signed contract terms.",
            evidence: [discrepancy.sourceText],
            sourceType: "email",
            sourceMessageId: discrepancy.messageId
          });
        }

        // 5. NEW: build brand contact intelligence
        if (message.direction === "inbound" && message.from?.email) {
          await upsertBrandContact({
            userId: viewer.id,
            dealId: link.dealId,
            name: message.from.name ?? message.from.email,
            email: message.from.email,
            organization: aggregate.deal.brandName,
            inferredRole: inferContactRole(message),
            lastSeenAt: message.receivedAt ?? message.sentAt
          });
        }
      }

      // 6. NEW: check cross-deal conflicts after processing all messages
      const latestMessage = thread.messages[thread.messages.length - 1];
      if (latestMessage) {
        checkCrossDealConflicts(aggregate, allAggregates, latestMessage);
      }
    }
  }
}

function inferContactRole(message: { subject: string; textBody: string | null }): string | null {
  const text = `${message.subject} ${message.textBody ?? ""}`.toLowerCase();

  if (/\b(contract|agreement|legal|terms|clause|amendment)\b/.test(text)) {
    return "contracts";
  }
  if (/\b(invoice|payment|billing|finance|net\s*\d+|remit)\b/.test(text)) {
    return "finance";
  }
  if (/\b(creative|brief|draft|concept|review|approval|content)\b/.test(text)) {
    return "creative";
  }
  if (/\b(campaign|manager|coordinator|partnership|talent)\b/.test(text)) {
    return "partnerships";
  }

  return null;
}

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
      const threads = await listRecentGmailThreads(accessToken, account.emailAddress, recentLimit);

      for (const thread of threads) {
        const saved = await saveSyncedEmailThread(account.id, "gmail", thread);
        threadIds.push(saved.id);
      }
    } else {
      let history;
      try {
        history = await listGmailHistoryThreadIds(
          accessToken,
          gmailHistoryId ?? syncState.lastHistoryId
        );
      } catch (error) {
        const isStaleHistory =
          error instanceof Error &&
          error.message.includes("Gmail request failed (404)") &&
          (error.message.includes("Requested entity was not found") ||
            error.message.includes('"reason":"notFound"') ||
            error.message.includes('"reason": "notFound"'));
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
          const saved = await saveSyncedEmailThread(account.id, "gmail", thread);
          threadIds.push(saved.id);
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
    const tokens = await ensureActiveTokens(account);
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
      const conversationIds = [...new Set(messagePayloads.map((message) => message.conversationId).filter(Boolean))];
      threads = await fetchOutlookThreadsByConversationIds(
        accessToken,
        account.emailAddress,
        conversationIds
      );
    }

    const savedThreadIds: string[] = [];
    for (const thread of threads) {
      const saved = await saveSyncedEmailThread(account.id, "outlook", thread);
      savedThreadIds.push(saved.id);
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

    if (account.provider === "yahoo") {
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
  if (!detail || detail.links.length === 0) {
    return detail;
  }

  // Enrich with promise discrepancies and cross-deal conflicts
  const allAggregates = await listDealAggregatesForViewer(viewer);

  for (const link of detail.links) {
    const aggregate = allAggregates.find((a) => a.deal.id === link.dealId);
    if (!aggregate) {
      continue;
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
  }

  return detail;
}

export async function listLinkedEmailThreadsForViewerDeal(viewer: Viewer, dealId: string) {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  return listLinkedEmailThreadsForDeal(viewer.id, dealId);
}

export async function linkThreadToDealForViewer(viewer: Viewer, threadId: string, dealId: string) {
  await assertPremiumInboxAccess(viewer);
  const link = await linkEmailThreadToDeal(viewer.id, threadId, dealId, "manual");
  if (link) {
    await markEmailCandidateMatchForDealThread(viewer.id, dealId, threadId, "confirmed");
    await processLinkedThreadUpdates(viewer, [threadId]);
  }
  return link;
}

export async function unlinkThreadFromDealForViewer(viewer: Viewer, threadId: string, dealId: string) {
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

export async function discoverDealEmailCandidatesForViewer(viewer: Viewer) {
  await assertPremiumInboxAccess(viewer);
  await refreshEmailDealSuggestionsForViewer(viewer, { limit: 250 });
  const accounts = await listConnectedEmailAccounts(viewer.id);
  await queueSmartInboxExpansion(accounts.map((account) => account.id), 100);
  return listDealEmailCandidatesForViewer(viewer);
}

export async function reviewDealEmailCandidatesForViewer(
  viewer: Viewer,
  input: {
    confirmIds?: string[];
    rejectIds?: string[];
  }
) {
  await assertPremiumInboxAccess(viewer);
  const confirmed: EmailDealCandidateMatchRecord[] = [];
  const rejected: EmailDealCandidateMatchRecord[] = [];

  for (const candidateId of input.confirmIds ?? []) {
    const candidate = await getEmailCandidateMatchForUser(viewer.id, candidateId);
    if (!candidate) {
      continue;
    }

    const link = await linkEmailThreadToDeal(
      viewer.id,
      candidate.threadId,
      candidate.dealId,
      "ai_suggested",
      candidate.confidence
    );
    if (!link) {
      continue;
    }

    const saved = await updateEmailCandidateMatchStatus(viewer.id, candidateId, "confirmed");
    if (saved) {
      confirmed.push(saved);
      await processLinkedThreadUpdates(viewer, [saved.threadId]);
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
    rejected
  };
}

export async function disconnectEmailAccountForViewer(viewer: Viewer, accountId: string) {
  await assertEmailConnectionsAccess(viewer);
  return disconnectConnectedEmailAccount(viewer.id, accountId);
}

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

export async function createYahooConnectUrlForViewerWithReturnBaseUrl(
  viewer: Viewer,
  returnBaseUrl: string | null | undefined
) {
  await assertEmailConnectionsAccess(viewer);
  if (!hasProviderConfig("yahoo")) {
    throw new Error("Yahoo email is not configured.");
  }

  const { createOAuthState } = await import("@/lib/email/oauth-state");
  return buildYahooAuthUrl(
    createOAuthState(viewer.id, "yahoo", {
      returnBaseUrl: resolveEmailAppBaseUrl(returnBaseUrl)
    })
  );
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
  const profile = await getYahooProfile(tokens.access_token);
  await saveConnectedEmailAccount({
    userId: viewer.id,
    provider: "yahoo",
    providerAccountId: profile.providerAccountId,
    emailAddress: profile.emailAddress,
    displayName: profile.displayName,
    scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    accessTokenEncrypted: encryptSecret(tokens.access_token),
    refreshTokenEncrypted: encryptSecret(tokens.refresh_token ?? null),
    tokenExpiresAt: tokenExpiresAt(tokens.expires_in),
    status: "connected"
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
  await assertPremiumInboxAccess(viewer);
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
  explicitDealId?: string | null,
  stance?: NegotiationStance | null,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null
) {
  await assertPremiumInboxAccess(viewer);
  const detail = await getEmailThreadDetailForUser(viewer.id, threadId);
  if (!detail) {
    return null;
  }

  const [deal, profile] = await Promise.all([
    loadLinkedDealAggregate(viewer, detail, explicitDealId),
    getProfileForViewer(viewer)
  ]);

  return generateEmailReplyDraft(
    detail,
    deal as DealAggregate | null,
    profile,
    stance ?? null,
    instructions ?? null,
    currentDraft ?? null
  );
}
