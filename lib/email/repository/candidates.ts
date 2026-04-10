/**
 * This file stores email-to-deal matching, event extraction, suggestions, action items, and contact intelligence.
 * It keeps the inbox analysis records together so the thread and account modules do not have to own that extra workflow state.
 */
import { prisma } from "@/lib/prisma";
import type {
  BrandContactRecord,
  DealRecord,
  EmailActionItemRecord,
  EmailDealCandidateMatchRecord,
  EmailDealCandidateMatchView,
  EmailDealEventRecord,
  EmailDealTermSuggestionRecord
} from "@/lib/types";

import {
  iso,
  toAccountRecord,
  toActionItemRecord,
  toBrandContactRecord,
  toCandidateMatchRecord,
  toDealEventRecord,
  toJsonValue,
  toLinkView,
  toTermSuggestionRecord,
  toThreadRecord
} from "./shared";

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
  return prisma.riskFlag.create({
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
