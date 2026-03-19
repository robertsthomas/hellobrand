import { Suspense } from "react";

import { NotificationsSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { getCachedDealAggregates } from "@/lib/cached-data";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { NotificationsView } from "@/components/notifications-view";
import type { DealAggregate } from "@/lib/types";


export type NotificationType =
  | "payment_overdue"
  | "upcoming_deadline"
  | "contract_risk"
  | "deliverable_approved"
  | "new_contract"
  | "payment_received";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  dealId: string;
  createdAt: string;
}

function generateNotifications(aggregates: DealAggregate[]): NotificationItem[] {
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
          : `Payment is overdue and needs follow-up.`,
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
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  const viewer = await requireViewer();
  const aggregates = await getCachedDealAggregates(viewer);
  const notifications = generateNotifications(aggregates);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <NotificationsView notifications={notifications} />
      </div>
    </div>
  );
}
