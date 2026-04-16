/**
 * This file holds the shared helpers behind the email service modules.
 * It keeps access checks, thread-scoring logic, credential refresh, and linked-deal updates in one place so the smaller service files can stay focused.
 */
import { getRepository } from "@/lib/repository";
import type {
  ConnectedEmailAccountRecord,
  DealAggregate,
  DealTermsRecord,
  EmailDealCandidateMatchGroup,
  EmailThreadDetail,
  PendingExtractionData,
  Viewer,
} from "@/lib/types";
import { decryptSecret, encryptSecret } from "@/lib/email/crypto";
import {
  buildEmailTermSuggestion,
  detectImportantEmailEvents,
  detectPromiseDiscrepancies,
  scoreThreadAgainstDeal,
} from "@/lib/email/smart-inbox";
import { smartInboxEnabled } from "@/flags";
import { extractActionItemsFromMessage } from "@/lib/email/action-items";
import { checkCrossDealConflicts } from "@/lib/email/conflict-bridge";
import { refreshGoogleAccessToken } from "@/lib/email/providers/gmail";
import { refreshOutlookAccessToken } from "@/lib/email/providers/outlook";
import { isYahooAppPasswordAccount, refreshYahooAccessToken } from "@/lib/email/providers/yahoo";
import type { ProviderThreadPayload } from "@/lib/email/providers/types";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { coalesceExtractions, hasMeaningfulChanges } from "@/lib/pending-changes";
import {
  clearEmailResyncRequiredNotification,
  emitEmailResyncRequiredNotification,
} from "@/lib/notification-service";
import {
  createEmailThreadNoteForUser,
  deleteSyncedEmailThread,
  getConnectedEmailAccount,
  getEmailCandidateMatchForDealThread,
  getEmailSyncState,
  getEmailThreadDetailForUser,
  listEmailCandidateMatchesForUser,
  listEmailThreadsForUser,
  replaceEmailDealEventsForMessage,
  saveConnectedEmailAccount,
  saveEmailActionItem,
  saveEmailDealTermSuggestion,
  saveEmailRiskFlag,
  saveSyncedEmailThread,
  upsertBrandContact,
  updateConnectedEmailAccount,
  upsertEmailCandidateMatch,
} from "@/lib/email/repository";

const DEFAULT_TRANSACTIONAL_MAILBOX_SENDER = "onboarding@resend.dev";
const HELLOBRAND_TRANSACTIONAL_MARKERS = [
  "you're receiving this because you have email notifications enabled in hellobrand",
  "your workspace has been analyzed and is ready for review",
  "workspace is ready for review",
  "workspace could not be processed",
  "inbox needs to reconnect",
  "thanks for joining the hellobrand waitlist",
];

export const YAHOO_POLL_INTERVAL_MS = 15 * 60 * 1000;
export const EMAIL_DISCOVERY_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
export const EMAIL_DISCOVERY_INITIAL_THREAD_LIMIT = 25;
export const OUTLOOK_WEBHOOK_DEDUPE_WINDOW_MS = 2 * 60 * 1000;
export const EMAIL_INCREMENTAL_SYNC_BATCH_WINDOW = "5s";
export const EMAIL_INCREMENTAL_SYNC_BATCH_MAX_SIZE = 5;

export function redirectTarget(
  pathname: string,
  searchParams?: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
}

export function normalizeMailboxAddress(value: string | null | undefined) {
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
    [process.env.RESEND_FROM_EMAIL, DEFAULT_TRANSACTIONAL_MAILBOX_SENDER]
      .map((value) => normalizeMailboxAddress(value))
      .filter((value): value is string => Boolean(value))
  );
}

function isHelloBrandTransactionalThread(accountEmail: string, payload: ProviderThreadPayload) {
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
      stripHtmlTags(message.htmlBody),
    ]),
  ]
    .join("\n")
    .toLowerCase();

  return HELLOBRAND_TRANSACTIONAL_MARKERS.some((marker) => corpus.includes(marker));
}

export async function saveNonTransactionalSyncedThread(
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

export function textBodyToHtml(value: string) {
  return value
    .split("\n")
    .map((line) =>
      line.trim().length > 0
        ? `<div>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
        : "<div><br/></div>"
    )
    .join("");
}

export function latestReplyTarget(detail: EmailThreadDetail) {
  const latestInbound = [...detail.messages]
    .reverse()
    .find((message) => message.direction === "inbound" && message.from?.email);
  const anchor = latestInbound ?? detail.messages[detail.messages.length - 1] ?? null;

  return {
    anchor,
    to: latestInbound?.from ? [latestInbound.from] : anchor?.to?.length ? anchor.to : [],
    cc: latestInbound?.cc ?? anchor?.cc ?? [],
    bcc: [] as EmailThreadDetail["messages"][number]["bcc"],
  };
}

export function primaryThreadLink(detail: Pick<EmailThreadDetail, "primaryLink" | "links">) {
  return detail.primaryLink ?? detail.links.find((link) => link.role === "primary") ?? null;
}

export function primaryThreadDealId(
  detail: Pick<EmailThreadDetail, "primaryLink" | "links">,
  explicitDealId?: string | null
) {
  return explicitDealId?.trim() || primaryThreadLink(detail)?.dealId || null;
}

export function tokenExpiresAt(expiresIn: number | undefined) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

export function isRecentIso(value: string | null | undefined, withinMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < withinMs;
}

export function isGmailResyncRequiredError(error: unknown) {
  return error instanceof Error && error.message === "GMAIL_RESYNC_REQUIRED";
}

export function compareHistoryIds(left: string, right: string) {
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

export async function assertPremiumInboxAccess(viewer: Viewer) {
  await assertViewerHasFeature(viewer, "premium_inbox");
}

export async function assertEmailConnectionsAccess(viewer: Viewer) {
  await assertViewerHasFeature(viewer, "email_connections");
}

export function groupCandidateMatches(
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
      matches: [match],
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
    briefData: aggregate.terms?.briefData ?? null,
  };
}

export async function ensureActiveEmailCredentials(account: ConnectedEmailAccountRecord) {
  const accessToken = decryptSecret(account.accessTokenEncrypted);
  const refreshToken = decryptSecret(account.refreshTokenEncrypted);

  if (account.provider === "yahoo" && isYahooAppPasswordAccount(account.scopes)) {
    if (!refreshToken) {
      await updateConnectedEmailAccount(account.id, {
        status: "reconnect_required",
        lastErrorCode: "missing_yahoo_app_password",
        lastErrorMessage: "Reconnect Yahoo with a fresh app password.",
      });
      throw new Error("Reconnect required.");
    }

    return {
      accessToken: null as string | null,
      refreshToken,
      mailPassword: refreshToken,
    };
  }

  if (account.provider === "yahoo" && account.scopes.length === 0) {
    await updateConnectedEmailAccount(account.id, {
      status: "reconnect_required",
      lastErrorCode: "legacy_yahoo_app_password",
      lastErrorMessage: "Reconnect Yahoo with Yahoo OAuth.",
    });
    throw new Error("Reconnect required.");
  }

  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
  const needsRefresh = !accessToken || !expiresAt || expiresAt <= Date.now() + 60 * 1000;

  if (!needsRefresh) {
    return { accessToken, refreshToken };
  }

  if (!refreshToken) {
    await updateConnectedEmailAccount(account.id, {
      status: "reconnect_required",
      lastErrorCode:
        account.provider === "yahoo" ? "missing_yahoo_refresh_token" : "missing_refresh_token",
      lastErrorMessage:
        account.provider === "yahoo" ? "Reconnect Yahoo with Yahoo OAuth." : "Reconnect required.",
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
    lastErrorMessage: null,
  });

  return {
    accessToken: decryptSecret(updated.accessTokenEncrypted),
    refreshToken: decryptSecret(updated.refreshTokenEncrypted),
  };
}

export async function refreshEmailDealSuggestionsForViewer(
  viewer: Viewer,
  options?: {
    threadIds?: string[];
    limit?: number;
  }
) {
  const [threads, aggregates] = await Promise.all([
    listEmailThreadsForUser(viewer.id, {
      limit: options?.limit ?? 250,
    }),
    import("@/lib/cached-data").then(({ getCachedDealAggregates }) =>
      getCachedDealAggregates(viewer)
    ),
  ]);

  const threadIds = new Set(options?.threadIds ?? []);
  const scopedThreads =
    threadIds.size > 0 ? threads.filter((thread) => threadIds.has(thread.thread.id)) : threads;
  const threadsForScoring =
    threadIds.size > 0
      ? await Promise.all(
          scopedThreads.map(async (thread) => {
            const detail = await getEmailThreadDetailForUser(viewer.id, thread.thread.id);
            return detail ?? thread;
          })
        )
      : scopedThreads;

  for (const thread of threadsForScoring) {
    for (const aggregate of aggregates) {
      if (thread.links.some((link) => link.dealId === aggregate.deal.id)) {
        continue;
      }

      const match =
        (await smartInboxEnabled()) === true ? scoreThreadAgainstDeal(thread, aggregate) : null;
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
        evidence: match.evidence,
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
    updatedAt: new Date().toISOString(),
  };
  const existingPending =
    (aggregate.terms?.pendingExtraction as PendingExtractionData | null) ?? currentTermsBase;
  const { mergeTerms } = await import("@/lib/deals");
  const mergedPending = coalesceExtractions(existingPending, patch, (base, next) => {
    const merged = mergeTerms(
      {
        ...base,
        pendingExtraction: null,
      },
      {
        ...next,
        pendingExtraction: null,
      },
      {
        manuallyEditedFields: currentTermsBase.manuallyEditedFields ?? [],
      }
    );
    const { pendingExtraction: _pendingExtraction, ...rest } = merged;
    return rest as PendingExtractionData;
  });

  if (!hasMeaningfulChanges(currentTermsRecord, mergedPending)) {
    return null;
  }

  await getRepository().upsertTerms(dealId, {
    ...currentTermsBase,
    pendingExtraction: mergedPending,
  });
  return mergedPending;
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

export async function processLinkedThreadUpdates(viewer: Viewer, threadIds: string[]) {
  const { getCachedDealAggregates } = await import("@/lib/cached-data");
  const allAggregates = await getCachedDealAggregates(viewer);
  const smartInboxOn = (await smartInboxEnabled()) === true;

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
        const events = smartInboxOn ? detectImportantEmailEvents(message) : [];
        await replaceEmailDealEventsForMessage({
          userId: viewer.id,
          dealId: link.dealId,
          threadId: thread.thread.id,
          messageId: message.id,
          events,
        });

        const suggestion = smartInboxOn
          ? buildEmailTermSuggestion(aggregate, thread, message)
          : null;
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
              evidence: suggestion.evidence,
            });
          }
        }

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
            sourceText: item.sourceText,
          });
        }

        if (smartInboxOn) {
          const discrepancies = detectPromiseDiscrepancies(aggregate, message);
          for (const discrepancy of discrepancies) {
            await saveEmailRiskFlag({
              dealId: link.dealId,
              category:
                discrepancy.field === "paymentAmount"
                  ? "payment_terms"
                  : discrepancy.field === "exclusivity"
                    ? "exclusivity"
                    : discrepancy.field === "deliverables"
                      ? "deliverables"
                      : discrepancy.field === "usageDuration"
                        ? "usage_rights"
                        : "other",
              title: `Email contradicts contract: ${discrepancy.field}`,
              detail: `Email claims "${discrepancy.emailClaim}" but contract says "${discrepancy.contractValue}".`,
              severity: discrepancy.severity,
              suggestedAction:
                "Review the email thread and compare with your signed contract terms.",
              evidence: [discrepancy.sourceText],
              sourceType: "email",
              sourceMessageId: discrepancy.messageId,
            });
          }
        }

        if (message.direction === "inbound" && message.from?.email) {
          await upsertBrandContact({
            userId: viewer.id,
            dealId: link.dealId,
            name: message.from.name ?? message.from.email,
            email: message.from.email,
            organization: aggregate.deal.brandName,
            inferredRole: inferContactRole(message),
            lastSeenAt: message.receivedAt ?? message.sentAt,
          });
        }
      }

      const latestMessage = thread.messages[thread.messages.length - 1];
      if (latestMessage) {
        await checkCrossDealConflicts(aggregate, allAggregates, latestMessage);
      }
    }
  }
}

export async function loadLinkedDealAggregate(
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

export {
  clearEmailResyncRequiredNotification,
  createEmailThreadNoteForUser,
  emitEmailResyncRequiredNotification,
  getConnectedEmailAccount,
  getEmailSyncState,
  saveConnectedEmailAccount,
};
