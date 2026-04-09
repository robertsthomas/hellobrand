import { inngest } from "@/lib/inngest/client";
import { getViewerById } from "@/lib/auth";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { startServerDebug } from "@/lib/server-debug";
import { readStoredBytes, storeUploadedBytes } from "@/lib/storage";
import type {
  ConnectedEmailAccountRecord,
  DealTermsRecord,
  DealAggregate,
  EmailDealCandidateMatchGroup,
  EmailDealCandidateMatchRecord,
  EmailLinkRole,
  EmailThreadDetail,
  EmailThreadDraftRecord,
  EmailThreadListItem,
  EmailThreadWorkflowState,
  NegotiationStance,
  PendingExtractionData,
  Viewer
} from "@/lib/types";
import { decryptSecret, encryptSecret } from "@/lib/email/crypto";
import { generateEmailReplyDraft, generateEmailThreadSummary, streamEmailReplyDraft } from "@/lib/email/ai";
import { detectImportantEmailEvents, buildEmailTermSuggestion, detectPromiseDiscrepancies, scoreThreadAgainstDeal } from "@/lib/email/smart-inbox";
import { extractActionItemsFromMessage } from "@/lib/email/action-items";
import { checkCrossDealConflicts } from "@/lib/email/conflict-bridge";
import { buildGoogleAuthUrl, exchangeGoogleCode, fetchGmailAttachment, fetchGmailThreadsByIds, getGoogleProfile, listGmailHistoryThreadIds, listRecentGmailThreads, refreshGoogleAccessToken, registerGmailWatch, sendGmailThreadReply } from "@/lib/email/providers/gmail";
import { buildOutlookAuthUrl, createOutlookSubscription, exchangeOutlookCode, fetchOutlookAttachment, fetchOutlookMessage, fetchOutlookThreadsByConversationIds, getOutlookProfile, listRecentOutlookThreads, refreshOutlookAccessToken, renewOutlookSubscription, sendOutlookThreadReply } from "@/lib/email/providers/outlook";
import { buildYahooAuthUrl, exchangeYahooCode, fetchYahooAttachment, getYahooProfile, listRecentYahooThreads, listYahooThreadsSinceCursor, refreshYahooAccessToken, sendYahooThreadReply, verifyYahooMailboxAccess } from "@/lib/email/providers/yahoo";
import type { ProviderThreadPayload } from "@/lib/email/providers/types";
import { parseOAuthState } from "@/lib/email/oauth-state";
import { hasProviderConfig, resolveEmailAppBaseUrl, yahooScopes } from "@/lib/email/config";
import {
  assertViewerHasFeature
} from "@/lib/billing/entitlements";
import { markInvoiceSentForViewer } from "@/lib/invoices";
import {
  enqueueDocumentProcessing,
  listDealAggregatesForViewer,
  mergeTerms,
  processDocumentById
} from "@/lib/deals";
import { coalesceExtractions, hasMeaningfulChanges } from "@/lib/pending-changes";
import {
  clearEmailResyncRequiredNotification,
  emitEmailResyncRequiredNotification
} from "@/lib/notification-service";
import {
  createEmailThreadNoteForUser,
  deleteEmailThreadDraftForUser,
  disconnectConnectedEmailAccount,
  deleteSyncedEmailThread,
  findConnectedEmailAccountByProviderAddress,
  findConnectedEmailAccountBySubscriptionId,
  acquireConnectedEmailAccountSyncLease,
  getConnectedEmailAccount,
  getEmailAttachmentForUser,
  getEmailCandidateMatchForUser,
  getEmailCandidateMatchForDealThread,
  getConnectedEmailAccountForUser,
  getEmailThreadDraftForUser,
  getEmailSyncState,
  getEmailThreadDetailForUser,
  linkEmailThreadToDeal,
  listEmailCandidateMatchesForUser,
  listEmailThreadNotesForUser,
  listExistingEmailMessageProviderIdsForAccount,
  listAccountsNeedingRenewal,
  listConnectedEmailAccounts,
  listEmailThreadsForUser,
  listLinkedEmailThreadsForDeal,
  markEmailCandidateMatchForDealThread,
  replaceEmailDealEventsForMessage,
  saveConnectedEmailAccount,
  saveEmailActionItem,
  saveEmailDealTermSuggestion,
  saveEmailRiskFlag,
  saveEmailThreadDraftForUser,
  saveOutboundEmailMessage,
  saveEmailThreadSummary,
  saveSyncedEmailThread,
  upsertBrandContact,
  unlinkEmailThreadFromDeal,
  updateConnectedEmailAccount,
  updateEmailCandidateMatchStatus,
  updateEmailThreadWorkflowForUser,
  upsertEmailCandidateMatch,
  upsertEmailSyncState
} from "@/lib/email/repository";

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

const YAHOO_POLL_INTERVAL_MS = 15 * 60 * 1000;
const EMAIL_DISCOVERY_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const EMAIL_DISCOVERY_INITIAL_THREAD_LIMIT = 25;
const OUTLOOK_WEBHOOK_DEDUPE_WINDOW_MS = 2 * 60 * 1000;
const EMAIL_INCREMENTAL_SYNC_BATCH_WINDOW = "5s";
const EMAIL_INCREMENTAL_SYNC_BATCH_MAX_SIZE = 5;
const DEFAULT_TRANSACTIONAL_MAILBOX_SENDER = "onboarding@resend.dev";
const HELLOBRAND_TRANSACTIONAL_MARKERS = [
  "you're receiving this because you have email notifications enabled in hellobrand",
  "your workspace has been analyzed and is ready for review",
  "workspace is ready for review",
  "workspace could not be processed",
  "inbox needs to reconnect",
  "thanks for joining the hellobrand waitlist"
];

function redirectTarget(pathname: string, searchParams?: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
}

function normalizeMailboxAddress(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] ?? trimmed).trim();
}

function stripHtmlTags(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTransactionalMailboxSenders() {
  return new Set(
    [
      process.env.RESEND_FROM_EMAIL,
      DEFAULT_TRANSACTIONAL_MAILBOX_SENDER
    ]
      .map((value) => normalizeMailboxAddress(value))
      .filter((value): value is string => Boolean(value))
  );
}

function isHelloBrandTransactionalThread(
  accountEmail: string,
  payload: ProviderThreadPayload
) {
  const normalizedAccountEmail = normalizeMailboxAddress(accountEmail);
  const knownSenders = getTransactionalMailboxSenders();

  if (!normalizedAccountEmail || knownSenders.size === 0) {
    return false;
  }

  const hasKnownSender = payload.messages.some((message) => {
    const senderEmail = normalizeMailboxAddress(message.from?.email);
    return Boolean(senderEmail && knownSenders.has(senderEmail));
  });

  if (!hasKnownSender) {
    return false;
  }

  const sentToConnectedInbox = payload.messages.some((message) =>
    [message.to, message.cc, message.bcc]
      .flat()
      .some((participant) => normalizeMailboxAddress(participant.email) === normalizedAccountEmail)
  );

  if (!sentToConnectedInbox) {
    return false;
  }

  const corpus = [
    payload.subject,
    payload.snippet ?? "",
    ...payload.messages.flatMap((message) => [
      message.subject,
      message.textBody ?? "",
      stripHtmlTags(message.htmlBody)
    ])
  ]
    .join("\n")
    .toLowerCase();

  return HELLOBRAND_TRANSACTIONAL_MARKERS.some((marker) => corpus.includes(marker));
}

async function saveNonTransactionalSyncedThread(
  account: ConnectedEmailAccountRecord,
  provider: ConnectedEmailAccountRecord["provider"],
  payload: ProviderThreadPayload
) {
  if (isHelloBrandTransactionalThread(account.emailAddress, payload)) {
    await deleteSyncedEmailThread(account.id, payload.providerThreadId);
    return null;
  }

  return saveSyncedEmailThread(account.id, provider, payload);
}

function textBodyToHtml(value: string) {
  return value
    .split("\n")
    .map((line) =>
      line.trim().length > 0
        ? `<div>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
        : "<div><br/></div>"
    )
    .join("");
}

function latestReplyTarget(detail: EmailThreadDetail) {
  const latestInbound = [...detail.messages]
    .reverse()
    .find((message) => message.direction === "inbound" && message.from?.email);
  const anchor = latestInbound ?? detail.messages[detail.messages.length - 1] ?? null;

  return {
    anchor,
    to:
      latestInbound?.from
        ? [latestInbound.from]
        : anchor?.to?.length
          ? anchor.to
          : [],
    cc: latestInbound?.cc ?? anchor?.cc ?? [],
    bcc: [] as EmailThreadDetail["messages"][number]["bcc"]
  };
}

function primaryThreadLink(detail: Pick<EmailThreadDetail, "primaryLink" | "links">) {
  return detail.primaryLink ?? detail.links.find((link) => link.role === "primary") ?? null;
}

function primaryThreadDealId(
  detail: Pick<EmailThreadDetail, "primaryLink" | "links">,
  explicitDealId?: string | null
) {
  return explicitDealId?.trim() || primaryThreadLink(detail)?.dealId || null;
}

function tokenExpiresAt(expiresIn: number | undefined) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function isRecentIso(value: string | null | undefined, withinMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < withinMs;
}

function isGmailResyncRequiredError(error: unknown) {
  return error instanceof Error && error.message === "GMAIL_RESYNC_REQUIRED";
}

function compareHistoryIds(left: string, right: string) {
  try {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);

    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue > rightValue ? 1 : -1;
  } catch {
    if (left === right) {
      return 0;
    }

    if (left.length !== right.length) {
      return left.length > right.length ? 1 : -1;
    }

    return left > right ? 1 : -1;
  }
}

export type IncrementalEmailSyncRequest = {
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

async function ensureActiveEmailCredentials(account: ConnectedEmailAccountRecord) {
  const accessToken = decryptSecret(account.accessTokenEncrypted);
  const refreshToken = decryptSecret(account.refreshTokenEncrypted);

  if (account.provider === "yahoo" && account.scopes.length === 0) {
    await updateConnectedEmailAccount(account.id, {
      status: "reconnect_required",
      lastErrorCode: "legacy_yahoo_app_password",
      lastErrorMessage: "Reconnect Yahoo with Yahoo OAuth."
    });
    throw new Error("Reconnect required.");
  }

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
      lastErrorCode:
        account.provider === "yahoo" ? "missing_yahoo_refresh_token" : "missing_refresh_token",
      lastErrorMessage:
        account.provider === "yahoo"
          ? "Reconnect Yahoo with Yahoo OAuth."
          : "Reconnect required."
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
  const threadsForScoring =
    threadIds.size > 0
      ? (
          await Promise.all(
            scopedThreads.map(async (thread) => {
              const detail = await getEmailThreadDetailForUser(viewer.id, thread.thread.id);
              return detail ?? thread;
            })
          )
        )
      : scopedThreads;

  for (const thread of threadsForScoring) {
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
        await replaceEmailDealEventsForMessage({
          userId: viewer.id,
          dealId: link.dealId,
          threadId: thread.thread.id,
          messageId: message.id,
          events
        });

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
    const tokens = await ensureActiveEmailCredentials(account);
    const accessToken = tokens.accessToken;

    if (!accessToken) {
      throw new Error("Missing Google access token.");
    }

    const syncState = await getEmailSyncState(account.id);
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
      const conversationIds = [...new Set(messagePayloads.map((message) => message.conversationId).filter(Boolean))];
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
    const yahooAccessToken = credentials.accessToken;

    if (!yahooAccessToken) {
      throw new Error("Missing Yahoo access token.");
    }

    const syncState = await getEmailSyncState(account.id);
    const result =
      mode === "initial" || !syncState?.providerCursor
        ? await listRecentYahooThreads(account.emailAddress, yahooAccessToken, recentLimit)
        : await listYahooThreadsSinceCursor(
            account.emailAddress,
            yahooAccessToken,
            syncState.providerCursor,
            Math.max(250, recentLimit)
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

  // Enrich with promise discrepancies and cross-deal conflicts
  const allAggregates = await listDealAggregatesForViewer(viewer);
  const aggregate = allAggregates.find((a) => a.deal.id === primaryLink.dealId);
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
            : await readStoredBytes(document.storagePath)
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
            bytes
          }))
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
              bytes
            }))
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
              bytes
            }))
          });

  const sentAt = new Date().toISOString();
  const savedMessage = await saveOutboundEmailMessage({
    userId: viewer.id,
    threadId: detail.thread.id,
    providerMessageId: sendResult.providerMessageId,
    internetMessageId: sendResult.internetMessageId,
    from: {
      name: account.displayName ?? viewer.displayName,
      email: account.emailAddress
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
      storageKey: document.storagePath
    }))
  });

  if (linkedDealId && attachmentDocuments.some(({ document }) => document.documentKind === "invoice")) {
    await markInvoiceSentForViewer(viewer, linkedDealId, {
      threadId: detail.thread.id,
      messageId: savedMessage?.id ?? null,
      accountId: account.id,
      provider: account.provider,
      toEmail: sendResult.to[0]?.email ?? to[0]?.email ?? null,
      subject: normalizedSubject
    });
  }

  await deleteEmailThreadDraftForUser(viewer.id, detail.thread.id);
  await updateEmailThreadWorkflowForUser({
    userId: viewer.id,
    threadId: detail.thread.id,
    workflowState: "waiting_on_them"
  });

  return {
    threadId: detail.thread.id,
    messageId: savedMessage?.id ?? null
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
      bytes
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
    bytes: payload.bytes
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
    source: input.source
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
    body: body.trim()
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
    workflowState
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
    folder: dealId
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
    processingStartedAt: null
  });

  const queue = await enqueueDocumentProcessing(document.id);
  if (queue.mode === "local") {
    void processDocumentById(document.id, queue.runId).catch(() => undefined);
  }

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
  const accounts = await listConnectedEmailAccounts(viewer.id);

  await Promise.allSettled(
    accounts.map(async (account) => {
      const syncState = await getEmailSyncState(account.id);
      if (isRecentIso(syncState?.lastSuccessfulSyncAt, EMAIL_DISCOVERY_SYNC_COOLDOWN_MS)) {
        return null;
      }

      return syncEmailAccount(account.id, {
        mode: "incremental",
        recentLimit: EMAIL_DISCOVERY_INITIAL_THREAD_LIMIT
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
      ...(input.primaryCandidateId ? [input.primaryCandidateId] : [])
    ])
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
      : threadCandidates[0]?.id ?? null;

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

async function loadLinkedDealAggregate(
  viewer: Viewer,
  thread: EmailThreadDetail,
  explicitDealId?: string | null
) {
  const candidateDealId = primaryThreadDealId(thread, explicitDealId);
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

  const [deal, profile, notes] = await Promise.all([
    loadLinkedDealAggregate(viewer, detail, explicitDealId),
    getProfileForViewer(viewer),
    listEmailThreadNotesForUser(viewer.id, threadId)
  ]);

  return generateEmailReplyDraft(
    detail,
    deal as DealAggregate | null,
    profile,
    stance ?? null,
    instructions ?? null,
    currentDraft ?? null,
    notes
  );
}

export async function streamDraftReplyForViewer(
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

  const [deal, profile, notes] = await Promise.all([
    loadLinkedDealAggregate(viewer, detail, explicitDealId),
    getProfileForViewer(viewer),
    listEmailThreadNotesForUser(viewer.id, threadId)
  ]);

  return streamEmailReplyDraft({
    viewer,
    thread: detail,
    partnership: deal as DealAggregate | null,
    profile,
    stance: stance ?? null,
    instructions: instructions ?? null,
    currentDraft: currentDraft ?? null,
    notes
  });
}
