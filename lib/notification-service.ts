import { revalidatePath, revalidateTag } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { enqueueNotificationEmailDelivery } from "@/lib/notification-email";
import {
  buildWorkspaceNotificationSeed,
  getWorkspaceSupersededEventTypes,
  notificationTypeForEventType,
  type NotificationSeed,
  type NotificationCategory,
  type NotificationEventType,
  type NotificationItem,
  type NotificationListResponse,
  type NotificationStatus
} from "@/lib/notifications";
import type { DealAggregate, Viewer } from "@/lib/types";

interface ListNotificationsOptions {
  includeRead?: boolean;
  includeCleared?: boolean;
  includeSuperseded?: boolean;
  limit?: number;
  cursor?: string | null;
}

type AppNotificationRow = {
  id: string;
  category: string;
  eventType: string;
  entityType: string;
  entityId: string;
  sessionId: string | null;
  dealId: string | null;
  title: string;
  body: string;
  href: string;
  status: string;
  readAt: Date | null;
  clearedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const NON_WORKSPACE_CATEGORIES: NotificationCategory[] = [
  "payments",
  "deadlines",
  "risks",
  "contracts",
  "approvals"
];

function ensureDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toNotificationItem(row: AppNotificationRow): NotificationItem {
  return {
    id: row.id,
    category: row.category as NotificationCategory,
    eventType: row.eventType as NotificationEventType,
    type: notificationTypeForEventType(row.eventType as NotificationEventType),
    status: row.status as NotificationStatus,
    entityType: row.entityType,
    entityId: row.entityId,
    title: row.title,
    description: row.body,
    href: row.href,
    dealId: row.dealId,
    sessionId: row.sessionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readAt: iso(row.readAt),
    clearedAt: iso(row.clearedAt),
    supersededAt: iso(row.supersededAt),
    read: row.readAt !== null
  };
}

async function upsertNotificationSeed(userId: string, seed: NotificationSeed) {
  const existing = await prisma.appNotification.findUnique({
    where: {
      userId_dedupeKey: {
        userId,
        dedupeKey: seed.dedupeKey
      }
    }
  });

  const normalizedCreatedAt =
    seed.createdAt instanceof Date
      ? seed.createdAt
      : typeof seed.createdAt === "string"
        ? new Date(seed.createdAt)
        : new Date();

  if (existing) {
    const contentChanged =
      existing.title !== seed.title ||
      existing.body !== seed.description ||
      existing.href !== seed.href;

    if (existing.status === "cleared" && !contentChanged) {
      return existing;
    }

    const shouldResetRead = existing.status === "superseded" || contentChanged;

    return prisma.appNotification.update({
      where: { id: existing.id },
      data: {
        category: seed.category,
        eventType: seed.eventType,
        entityType: seed.entityType,
        entityId: seed.entityId,
        sessionId: seed.sessionId ?? null,
        dealId: seed.dealId ?? null,
        title: seed.title,
        body: seed.description,
        href: seed.href,
        status: "active",
        clearedAt: null,
        supersededAt: null,
        readAt: shouldResetRead ? null : existing.readAt,
        createdAt: normalizedCreatedAt
      }
    });
  }

  return prisma.appNotification.create({
    data: {
      userId,
      category: seed.category,
      eventType: seed.eventType,
      entityType: seed.entityType,
      entityId: seed.entityId,
      sessionId: seed.sessionId ?? null,
      dealId: seed.dealId ?? null,
      title: seed.title,
      body: seed.description,
      href: seed.href,
      dedupeKey: seed.dedupeKey,
      createdAt: normalizedCreatedAt
    }
  });
}

async function supersedeWorkspaceNotifications(
  userId: string,
  sessionId: string,
  eventTypes: NotificationEventType[]
) {
  if (eventTypes.length === 0) {
    return;
  }

  await prisma.appNotification.updateMany({
    where: {
      userId,
      sessionId,
      status: "active",
      eventType: {
        in: eventTypes
      }
    },
    data: {
      status: "superseded",
      supersededAt: new Date()
    }
  });
}

async function refreshNotificationViews(userId: string) {
  revalidateTag(`user-${userId}-notifications`, "max");
  revalidatePath("/app", "layout");
  revalidatePath("/app/settings/notifications");
}

async function emitWorkspaceNotificationSeed(userId: string, seed: NotificationSeed) {
  const supersededEvents = getWorkspaceSupersededEventTypes(seed.eventType);
  if (seed.sessionId) {
    await supersedeWorkspaceNotifications(userId, seed.sessionId, supersededEvents);
  }

  const row = await upsertNotificationSeed(userId, seed);
  await refreshNotificationViews(userId);

  try {
    await enqueueNotificationEmailDelivery(row.id);
  } catch (error) {
    console.error("Failed to enqueue workspace notification email.", error);
  }

  return row;
}

async function loadSessionNotificationContext(sessionId: string) {
  return prisma.intakeSession.findUnique({
    where: { id: sessionId },
    include: {
      deal: {
        select: {
          id: true,
          brandName: true,
          campaignName: true
        }
      }
    }
  });
}

function computeDealNotificationSeeds(input: {
  aggregates: DealAggregate[];
  paymentRemindersEnabled: boolean;
  conflictAlertsEnabled: boolean;
}) {
  const seeds: NotificationSeed[] = [];

  for (const aggregate of input.aggregates) {
    const { deal, documents, riskFlags, terms } = aggregate;
    const normalized = buildNormalizedIntakeRecord(aggregate);
    const brandName = normalized?.brandName ?? deal.brandName;
    const paymentAmount = terms?.paymentAmount;
    const currency = terms?.currency ?? "USD";
    const formattedAmount = paymentAmount
      ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(paymentAmount)
      : null;

    if (input.paymentRemindersEnabled && deal.paymentStatus === "late") {
      seeds.push({
        category: "payments",
        eventType: "payment.overdue",
        entityType: "deal",
        entityId: deal.id,
        dealId: deal.id,
        title: `${brandName} payment is overdue`,
        description: formattedAmount
          ? `Payment of ${formattedAmount} is overdue and needs follow-up.`
          : "Payment is overdue and needs follow-up.",
        href: `/app/deals/${deal.id}`,
        dedupeKey: `payment.overdue:${deal.id}`,
        createdAt: deal.updatedAt
      });
    }

    if (input.paymentRemindersEnabled && deal.paymentStatus === "paid") {
      seeds.push({
        category: "payments",
        eventType: "payment.received",
        entityType: "deal",
        entityId: deal.id,
        dealId: deal.id,
        title: `${brandName} payment received`,
        description: formattedAmount
          ? `${brandName} paid ${formattedAmount}.`
          : `Payment has been received from ${brandName}.`,
        href: `/app/deals/${deal.id}`,
        dedupeKey: `payment.received:${deal.id}`,
        createdAt: deal.updatedAt
      });
    }

    const deliverables = terms?.deliverables ?? [];
    for (const deliverable of deliverables) {
      if (deliverable.dueDate) {
        const daysUntil = Math.ceil(
          (new Date(deliverable.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntil >= 0 && daysUntil <= 7) {
          seeds.push({
            category: "deadlines",
            eventType: "deadline.upcoming",
            entityType: "deliverable",
            entityId: deliverable.id,
            dealId: deal.id,
            title: `${deliverable.title} due${daysUntil === 0 ? " today" : ` in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}`,
            description: `${deliverable.title} for ${brandName} is coming up.`,
            href: `/app/deals/${deal.id}`,
            dedupeKey: `deadline.upcoming:${deal.id}:${deliverable.id}`,
            createdAt: deliverable.dueDate
          });
        }
      }

      if (deliverable.status === "completed") {
        seeds.push({
          category: "approvals",
          eventType: "deliverable.approved",
          entityType: "deliverable",
          entityId: deliverable.id,
          dealId: deal.id,
          title: `${deliverable.title} approved`,
          description: `Your ${deliverable.title} ${deliverable.channel ? `on ${deliverable.channel} ` : ""}was approved by ${brandName}.`,
          href: `/app/deals/${deal.id}`,
          dedupeKey: `deliverable.approved:${deal.id}:${deliverable.id}`,
          createdAt: deal.updatedAt
        });
      }
    }

    const highRisks = riskFlags.filter((flag) => flag.severity === "high");
    if (input.conflictAlertsEnabled && highRisks.length > 0) {
      seeds.push({
        category: "risks",
        eventType: "risk.contract",
        entityType: "deal",
        entityId: deal.id,
        dealId: deal.id,
        title: `${brandName} contract has ${highRisks.length} risk flag${highRisks.length === 1 ? "" : "s"}`,
        description: `Review ${highRisks.length} high-severity item${highRisks.length === 1 ? "" : "s"} before signing.`,
        href: `/app/deals/${deal.id}`,
        dedupeKey: `risk.contract:${deal.id}`,
        createdAt: highRisks[0]?.createdAt ?? deal.updatedAt
      });
    }

    const readyDocuments = documents.filter((doc) => doc.processingStatus === "ready");
    for (const doc of readyDocuments) {
      seeds.push({
        category: "contracts",
        eventType: "document.ready",
        entityType: "document",
        entityId: doc.id,
        dealId: deal.id,
        title: `${doc.fileName} processing complete`,
        description: `${brandName} contract document is ready for review.`,
        href: `/app/deals/${deal.id}`,
        dedupeKey: `document.ready:${doc.id}`,
        createdAt: doc.updatedAt
      });
    }
  }

  return seeds;
}

async function loadConfirmedAggregatesForViewer(viewerId: string) {
  const repository = getRepository();
  const deals = await repository.listDeals(viewerId);
  const aggregates: DealAggregate[] = [];

  for (const deal of deals) {
    const aggregate = await repository.getDealAggregate(viewerId, deal.id);
    if (aggregate) {
      aggregates.push(aggregate);
    }
  }

  return aggregates;
}

export async function syncComputedNotificationsForViewer(viewer: Viewer) {
  if (!ensureDatabase()) {
    return;
  }

  const [aggregates, profile] = await Promise.all([
    loadConfirmedAggregatesForViewer(viewer.id),
    getProfileForViewer(viewer).catch(() => null)
  ]);

  const seeds = computeDealNotificationSeeds({
    aggregates,
    paymentRemindersEnabled: profile?.paymentRemindersEnabled ?? true,
    conflictAlertsEnabled: profile?.conflictAlertsEnabled ?? true
  });

  for (const seed of seeds) {
    await upsertNotificationSeed(viewer.id, seed);
  }

  const activeDedupeKeys = seeds.map((seed) => seed.dedupeKey);
  const staleWhere = {
    userId: viewer.id,
    category: {
      in: NON_WORKSPACE_CATEGORIES
    },
    status: "active"
  } as const;

  if (activeDedupeKeys.length === 0) {
    await prisma.appNotification.updateMany({
      where: staleWhere,
      data: {
        status: "superseded",
        supersededAt: new Date()
      }
    });
  } else {
    await prisma.appNotification.updateMany({
      where: {
        ...staleWhere,
        dedupeKey: {
          notIn: activeDedupeKeys
        }
      },
      data: {
        status: "superseded",
        supersededAt: new Date()
      }
    });
  }
}

export async function listNotificationsForViewer(
  viewer: Viewer,
  options: ListNotificationsOptions = {}
): Promise<NotificationListResponse> {
  if (!ensureDatabase()) {
    return {
      notifications: [],
      unreadCount: 0,
      nextCursor: null
    };
  }

  await syncComputedNotificationsForViewer(viewer);

  const limit = options.limit ?? 100;
  const includeRead = options.includeRead ?? true;
  const rows = await prisma.appNotification.findMany({
    where: {
      userId: viewer.id,
      ...(includeRead ? {} : { readAt: null }),
      ...(options.includeCleared ? {} : { clearedAt: null }),
      ...(options.includeSuperseded ? {} : { status: "active" })
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit
  });

  const unreadCount = await prisma.appNotification.count({
    where: {
      userId: viewer.id,
      status: "active",
      clearedAt: null,
      readAt: null
    }
  });

  return {
    notifications: rows.map((row) => toNotificationItem(row)),
    unreadCount,
    nextCursor: null
  };
}

export async function markNotificationStateForViewer(
  viewer: Viewer,
  notificationId: string,
  action: "mark_read" | "mark_unread" | "clear"
) {
  if (!ensureDatabase()) {
    return null;
  }

  const notification = await prisma.appNotification.findFirst({
    where: {
      id: notificationId,
      userId: viewer.id
    }
  });

  if (!notification) {
    throw new Error("Notification not found.");
  }

  const updated = await prisma.appNotification.update({
    where: { id: notification.id },
    data:
      action === "mark_read"
        ? { readAt: notification.readAt ?? new Date() }
        : action === "mark_unread"
          ? { readAt: null }
          : { status: "cleared", clearedAt: new Date() }
  });

  await refreshNotificationViews(viewer.id);
  return toNotificationItem(updated);
}

export async function markAllNotificationsReadForViewer(viewer: Viewer) {
  if (!ensureDatabase()) {
    return;
  }

  await prisma.appNotification.updateMany({
    where: {
      userId: viewer.id,
      status: "active",
      clearedAt: null,
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  await refreshNotificationViews(viewer.id);
}

export async function clearAllNotificationsForViewer(viewer: Viewer) {
  if (!ensureDatabase()) {
    return;
  }

  await prisma.appNotification.updateMany({
    where: {
      userId: viewer.id,
      status: "active",
      clearedAt: null
    },
    data: {
      status: "cleared",
      clearedAt: new Date()
    }
  });

  await refreshNotificationViews(viewer.id);
}

export async function emitWorkspaceNotificationForSession(
  sessionId: string,
  eventType: Extract<
    NotificationEventType,
    | "workspace.queued"
    | "workspace.processing_started"
    | "workspace.ready_for_review"
    | "workspace.failed"
    | "workspace.duplicate_checking"
    | "workspace.duplicates_found"
    | "workspace.confirmed"
    | "workspace.cancelled"
  >
) {
  if (!ensureDatabase()) {
    return null;
  }

  const session = await loadSessionNotificationContext(sessionId);
  if (!session) {
    return null;
  }

  const seed = buildWorkspaceNotificationSeed({
    sessionId: session.id,
    dealId: session.dealId,
    brandName: session.deal.brandName,
    campaignName: session.deal.campaignName,
    draftBrandName: session.draftBrandName,
    draftCampaignName: session.draftCampaignName,
    errorMessage: session.errorMessage,
    duplicateMatchJson: session.duplicateMatchJson ?? null,
    createdAt: session.updatedAt,
    eventType
  });

  return emitWorkspaceNotificationSeed(session.userId, seed);
}

export async function emitWorkspaceNotificationForCurrentState(sessionId: string) {
  if (!ensureDatabase()) {
    return;
  }

  const session = await loadSessionNotificationContext(sessionId);
  if (!session) {
    return;
  }

  if (session.status === "queued") {
    await emitWorkspaceNotificationForSession(sessionId, "workspace.queued");
  }

  if (session.status === "processing") {
    await emitWorkspaceNotificationForSession(sessionId, "workspace.processing_started");
  }

  if (session.status === "ready_for_confirmation") {
    await emitWorkspaceNotificationForSession(sessionId, "workspace.ready_for_review");
  }

  if (session.status === "failed") {
    await emitWorkspaceNotificationForSession(sessionId, "workspace.failed");
  }

  if (session.status === "completed") {
    await emitWorkspaceNotificationForSession(sessionId, "workspace.confirmed");
    return;
  }

  if (session.duplicateCheckStatus === "checking") {
    await emitWorkspaceNotificationForSession(sessionId, "workspace.duplicate_checking");
    return;
  }

  if (session.duplicateCheckStatus === "duplicates_found") {
    await emitWorkspaceNotificationForSession(sessionId, "workspace.duplicates_found");
    return;
  }

  await supersedeWorkspaceNotifications(session.userId, session.id, [
    "workspace.duplicate_checking"
  ]);
  await refreshNotificationViews(session.userId);
}

export async function supersedeWorkspaceNotificationEvents(
  viewerId: string,
  sessionId: string,
  eventTypes: NotificationEventType[]
) {
  if (!ensureDatabase()) {
    return;
  }

  await supersedeWorkspaceNotifications(viewerId, sessionId, eventTypes);
  await refreshNotificationViews(viewerId);
}
