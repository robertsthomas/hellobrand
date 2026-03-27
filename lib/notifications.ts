export type NotificationCategory =
  | "workspace"
  | "inbox"
  | "payments"
  | "deadlines"
  | "risks"
  | "contracts"
  | "approvals";

export type NotificationStatus = "active" | "cleared" | "superseded";

export type NotificationEventType =
  | "email.resync_required"
  | "workspace.queued"
  | "workspace.processing_started"
  | "workspace.ready_for_review"
  | "workspace.failed"
  | "workspace.duplicate_checking"
  | "workspace.duplicates_found"
  | "workspace.confirmed"
  | "workspace.cancelled"
  | "payment.overdue"
  | "payment.received"
  | "invoice.generate_prompt"
  | "deadline.upcoming"
  | "risk.contract"
  | "document.ready"
  | "deliverable.approved";

export type NotificationType =
  | "email_resync_required"
  | "payment_overdue"
  | "invoice_generate_prompt"
  | "upcoming_deadline"
  | "contract_risk"
  | "deliverable_approved"
  | "new_contract"
  | "payment_received"
  | "workspace_generating"
  | "workspace_checking_duplicates"
  | "workspace_ready"
  | "workspace_failed"
  | "workspace_duplicate_found"
  | "workspace_confirmed"
  | "workspace_cancelled";

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  eventType: NotificationEventType;
  type: NotificationType;
  status: NotificationStatus;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  href: string;
  dealId: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  clearedAt: string | null;
  supersededAt: string | null;
  read: boolean;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
}

export interface NotificationSeed {
  category: NotificationCategory;
  eventType: NotificationEventType;
  entityType: string;
  entityId: string;
  sessionId?: string | null;
  dealId?: string | null;
  title: string;
  description: string;
  href: string;
  dedupeKey: string;
  createdAt?: Date | string;
}

const WORKSPACE_SUPERSESSION_MAP: Partial<
  Record<NotificationEventType, NotificationEventType[]>
> = {
  "workspace.processing_started": ["workspace.queued", "workspace.failed"],
  "workspace.ready_for_review": [
    "workspace.queued",
    "workspace.processing_started",
    "workspace.failed"
  ],
  "workspace.failed": ["workspace.queued", "workspace.processing_started"],
  "workspace.duplicates_found": ["workspace.duplicate_checking"],
  "workspace.cancelled": [
    "workspace.queued",
    "workspace.processing_started",
    "workspace.ready_for_review",
    "workspace.failed",
    "workspace.duplicate_checking",
    "workspace.duplicates_found"
  ],
  "workspace.confirmed": [
    "workspace.queued",
    "workspace.processing_started",
    "workspace.ready_for_review",
    "workspace.failed",
    "workspace.duplicate_checking",
    "workspace.duplicates_found"
  ]
};

export function notificationTypeForEventType(
  eventType: NotificationEventType
): NotificationType {
  switch (eventType) {
    case "payment.overdue":
      return "payment_overdue";
    case "email.resync_required":
      return "email_resync_required";
    case "payment.received":
      return "payment_received";
    case "invoice.generate_prompt":
      return "invoice_generate_prompt";
    case "deadline.upcoming":
      return "upcoming_deadline";
    case "risk.contract":
      return "contract_risk";
    case "document.ready":
      return "new_contract";
    case "deliverable.approved":
      return "deliverable_approved";
    case "workspace.queued":
    case "workspace.processing_started":
      return "workspace_generating";
    case "workspace.ready_for_review":
      return "workspace_ready";
    case "workspace.failed":
      return "workspace_failed";
    case "workspace.duplicate_checking":
      return "workspace_checking_duplicates";
    case "workspace.duplicates_found":
      return "workspace_duplicate_found";
    case "workspace.confirmed":
      return "workspace_confirmed";
    case "workspace.cancelled":
      return "workspace_cancelled";
  }
}

export function buildEmailResyncRequiredNotificationSeed(input: {
  accountId: string;
  provider: "gmail" | "outlook" | "yahoo";
  emailAddress: string;
  createdAt?: Date | string;
}): NotificationSeed {
  const providerLabel =
    input.provider === "gmail"
      ? "Gmail"
      : input.provider === "outlook"
        ? "Outlook"
        : "Yahoo";

  return {
    category: "inbox",
    eventType: "email.resync_required",
    entityType: "connected_email_account",
    entityId: input.accountId,
    title: `${providerLabel} inbox needs resync`,
    description: `We couldn't continue syncing ${input.emailAddress}. Reconnect this inbox to start a fresh sync.`,
    href: "/app/settings",
    dedupeKey: `email.resync_required:${input.accountId}`,
    createdAt: input.createdAt
  };
}

export function isNotificationUnread(notification: NotificationItem) {
  return notification.readAt === null;
}

function workspaceNotificationHref(input: {
  eventType: NotificationEventType;
  sessionId: string;
  dealId: string;
}) {
  switch (input.eventType) {
    case "workspace.ready_for_review":
    case "workspace.failed":
    case "workspace.duplicates_found":
      return `/app/intake/${input.sessionId}/review`;
    case "workspace.confirmed":
      return `/app/deals/${input.dealId}`;
    case "workspace.cancelled":
      return "/app";
    default:
      return `/app/intake/${input.sessionId}`;
  }
}

function workspaceLabel(input: {
  brandName?: string | null;
  campaignName?: string | null;
  draftBrandName?: string | null;
  draftCampaignName?: string | null;
}) {
  const skip = new Set(["workspace", "untitled brand", "untitled deal"]);
  const candidates = [
    input.draftBrandName,
    input.brandName,
    input.draftCampaignName,
    input.campaignName
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && !skip.has(trimmed.toLowerCase())) {
      return trimmed;
    }
  }

  return "Your";
}

export function getWorkspaceSupersededEventTypes(
  eventType: NotificationEventType
) {
  return [...(WORKSPACE_SUPERSESSION_MAP[eventType] ?? [])];
}

export function buildWorkspaceNotificationSeed(input: {
  sessionId: string;
  dealId: string;
  brandName?: string | null;
  campaignName?: string | null;
  draftBrandName?: string | null;
  draftCampaignName?: string | null;
  errorMessage?: string | null;
  duplicateMatchJson?: unknown | null;
  createdAt?: Date | string;
  eventType: NotificationEventType;
}): NotificationSeed {
  const label = workspaceLabel(input);
  const href = workspaceNotificationHref({
    eventType: input.eventType,
    sessionId: input.sessionId,
    dealId: input.dealId
  });

  switch (input.eventType) {
    case "workspace.queued":
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `${label} workspace is queued`,
        description:
          "Your workspace is queued for analysis. We'll notify you when processing begins and when it's ready.",
        href,
        dedupeKey: `workspace.queued:${input.sessionId}`,
        createdAt: input.createdAt
      };
    case "workspace.processing_started":
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `${label} workspace is generating`,
        description: "Your workspace is being analyzed. We'll notify you when it's ready.",
        href,
        dedupeKey: `workspace.processing_started:${input.sessionId}`,
        createdAt: input.createdAt
      };
    case "workspace.ready_for_review":
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `${label} workspace is ready for review`,
        description: "Your workspace has been analyzed and is ready for review.",
        href,
        dedupeKey: `workspace.ready_for_review:${input.sessionId}`,
        createdAt: input.createdAt
      };
    case "workspace.failed":
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `${label} workspace processing failed`,
        description:
          input.errorMessage?.trim() || "Something went wrong processing your documents.",
        href,
        dedupeKey: `workspace.failed:${input.sessionId}`,
        createdAt: input.createdAt
      };
    case "workspace.duplicate_checking":
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `Checking ${label} for duplicates`,
        description: "We're checking if this workspace overlaps with any existing ones.",
        href,
        dedupeKey: `workspace.duplicate_checking:${input.sessionId}`,
        createdAt: input.createdAt
      };
    case "workspace.duplicates_found": {
      const matches = Array.isArray(input.duplicateMatchJson)
        ? (input.duplicateMatchJson as Array<{ brandName?: string | null }>)
        : [];
      const matchBrand = matches[0]?.brandName?.trim() || "an existing workspace";
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `Possible duplicate: ${label}`,
        description: `This workspace may overlap with ${matchBrand}. Review to merge or keep separate.`,
        href,
        dedupeKey: `workspace.duplicates_found:${input.sessionId}`,
        createdAt: input.createdAt
      };
    }
    case "workspace.confirmed":
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `${label} workspace confirmed`,
        description: "This workspace has been reviewed and moved into your active partnerships.",
        href,
        dedupeKey: `workspace.confirmed:${input.sessionId}`,
        createdAt: input.createdAt
      };
    case "workspace.cancelled":
      return {
        category: "workspace",
        eventType: input.eventType,
        entityType: "workspace",
        entityId: input.sessionId,
        sessionId: input.sessionId,
        dealId: input.dealId,
        title: `${label} workspace cancelled`,
        description: "This workspace was cancelled and removed.",
        href: "/app",
        dedupeKey: `workspace.cancelled:${input.sessionId}`,
        createdAt: input.createdAt
      };
    default:
      throw new Error(`Unsupported workspace notification event: ${input.eventType}`);
  }
}

export function formatNotificationRelativeTime(dateString: string) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
