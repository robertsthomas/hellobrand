import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import type { DealAggregate } from "@/lib/types";

export type NotificationType =
  | "payment_overdue"
  | "upcoming_deadline"
  | "contract_risk"
  | "deliverable_approved"
  | "new_contract"
  | "payment_received"
  | "workspace_generating"
  | "workspace_ready"
  | "workspace_failed"
  | "workspace_duplicate_found";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  dealId: string;
  createdAt: string;
}

export const NOTIFICATIONS_READ_STORAGE_KEY = "hellobrand:notifications:read";
export const NOTIFICATIONS_READ_EVENT = "hellobrand:notifications:read-change";

export function generateNotifications(aggregates: DealAggregate[]): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const aggregate of aggregates) {
    const { deal, documents, riskFlags, terms } = aggregate;
    const normalized = buildNormalizedIntakeRecord(aggregate);
    const brandName = normalized?.brandName ?? deal.brandName;
    const paymentAmount = terms?.paymentAmount;
    const currency = terms?.currency ?? "USD";
    const formattedAmount = paymentAmount
      ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(paymentAmount)
      : null;

    if (deal.paymentStatus === "late") {
      items.push({
        id: `payment-overdue-${deal.id}`,
        type: "payment_overdue",
        title: `${brandName} payment is overdue`,
        description: formattedAmount
          ? `Payment of ${formattedAmount} is overdue and needs follow-up.`
          : "Payment is overdue and needs follow-up.",
        dealId: deal.id,
        createdAt: deal.updatedAt
      });
    }

    if (deal.paymentStatus === "paid") {
      items.push({
        id: `payment-received-${deal.id}`,
        type: "payment_received",
        title: `${brandName} payment received`,
        description: formattedAmount
          ? `${brandName} paid ${formattedAmount}.`
          : `Payment has been received from ${brandName}.`,
        dealId: deal.id,
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
          items.push({
            id: `deadline-${deal.id}-${deliverable.id}`,
            type: "upcoming_deadline",
            title: `${deliverable.title} due${daysUntil === 0 ? " today" : ` in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}`,
            description: `${deliverable.title} for ${brandName} is coming up.`,
            dealId: deal.id,
            createdAt: deliverable.dueDate
          });
        }
      }

      if (deliverable.status === "completed") {
        items.push({
          id: `approved-${deal.id}-${deliverable.id}`,
          type: "deliverable_approved",
          title: `${deliverable.title} approved`,
          description: `Your ${deliverable.title} ${deliverable.channel ? `on ${deliverable.channel} ` : ""}was approved by ${brandName}.`,
          dealId: deal.id,
          createdAt: deal.updatedAt
        });
      }
    }

    const highRisks = riskFlags.filter((flag) => flag.severity === "high");
    if (highRisks.length > 0) {
      items.push({
        id: `risk-${deal.id}`,
        type: "contract_risk",
        title: `${brandName} contract has ${highRisks.length} risk flag${highRisks.length === 1 ? "" : "s"}`,
        description: `Review ${highRisks.length} high-severity item${highRisks.length === 1 ? "" : "s"} before signing.`,
        dealId: deal.id,
        createdAt: highRisks[0].createdAt
      });
    }

    const readyDocuments = documents.filter((doc) => doc.processingStatus === "ready");
    for (const doc of readyDocuments) {
      items.push({
        id: `contract-${doc.id}`,
        type: "new_contract",
        title: `${doc.fileName} processing complete`,
        description: `${brandName} contract document is ready for review.`,
        dealId: deal.id,
        createdAt: doc.updatedAt
      });
    }

    const { intakeSession } = aggregate;
    if (intakeSession) {
      if (
        intakeSession.status === "processing" ||
        intakeSession.status === "queued" ||
        intakeSession.status === "uploading"
      ) {
        items.push({
          id: `workspace-generating-${deal.id}`,
          type: "workspace_generating",
          title: `${brandName} workspace is generating`,
          description: "Your workspace is being analyzed. We'll notify you when it's ready.",
          dealId: deal.id,
          createdAt: intakeSession.updatedAt
        });
      }

      if (
        intakeSession.status === "ready_for_confirmation" ||
        intakeSession.status === "completed"
      ) {
        items.push({
          id: `workspace-ready-${deal.id}`,
          type: "workspace_ready",
          title: `${brandName} workspace is ready`,
          description: "Your workspace has been analyzed and is ready for review.",
          dealId: deal.id,
          createdAt: intakeSession.updatedAt
        });
      }

      if (intakeSession.status === "failed") {
        items.push({
          id: `workspace-failed-${deal.id}`,
          type: "workspace_failed",
          title: `${brandName} workspace processing failed`,
          description: intakeSession.errorMessage ?? "Something went wrong processing your documents.",
          dealId: deal.id,
          createdAt: intakeSession.updatedAt
        });
      }

      if (intakeSession.duplicateCheckStatus === "duplicates_found" && intakeSession.duplicateMatchJson) {
        const matches = intakeSession.duplicateMatchJson as Array<{ brandName?: string }>;
        const matchBrand = matches[0]?.brandName ?? "an existing workspace";
        items.push({
          id: `workspace-duplicate-${deal.id}`,
          type: "workspace_duplicate_found",
          title: `Possible duplicate: ${brandName}`,
          description: `This workspace may overlap with ${matchBrand}. Review to merge or keep separate.`,
          dealId: deal.id,
          createdAt: intakeSession.updatedAt
        });
      }
    }
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function loadReadNotificationIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const raw = localStorage.getItem(NOTIFICATIONS_READ_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function persistReadNotificationIds(ids: Set<string>) {
  try {
    localStorage.setItem(NOTIFICATIONS_READ_STORAGE_KEY, JSON.stringify([...ids]));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    }
  } catch {
    // localStorage unavailable
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
