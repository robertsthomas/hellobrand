/**
 * Helpers for the signed-in dashboard route.
 * This file keeps dashboard-specific sorting, summary copy, and view-model shaping out of the page component.
 */
import type { QuickActionItem } from "@/components/dashboard";
import { countConflictSeverity } from "@/lib/conflict-intelligence";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import type { ConflictResult, DealAggregate, IntakeDraftListItem, Viewer } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type DashboardTranslationValues = Record<string, string | number | Date>;
type DashboardTranslator = (key: string, values?: DashboardTranslationValues) => string;

function daysUntil(date: string | null) {
  if (!date) {
    return null;
  }

  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function dueLabel(date: string | null, t: DashboardTranslator) {
  const days = daysUntil(date);

  if (days === null) {
    return t("dates.notSet");
  }

  if (days < 0) {
    return t("dates.daysOverdue", { count: Math.abs(days) });
  }

  if (days === 0) {
    return t("dates.dueToday");
  }

  if (days === 1) {
    return t("dates.inDays", { count: 1 });
  }

  return t("dates.inDays", { count: days });
}

export function paymentBadgeClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "late") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
  }

  if (status === "awaiting_payment") {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a3acb9]";
}

export function nextStepTextClass(tone: "warning" | "success" | "accent" | "neutral") {
  if (tone === "warning") {
    return "text-orange-700 dark:text-orange-300";
  }

  if (tone === "success") {
    return "text-emerald-700 dark:text-emerald-300";
  }

  if (tone === "accent") {
    return "text-[#2c5b49] dark:text-[#9fd7bf]";
  }

  return "text-[#667085] dark:text-[#a3acb9]";
}

function buildTodaySummary(
  input: {
  activePartnerships: number;
  dueSoonDeliverables: number;
  overdueInvoices: number;
  riskAlertCount: number;
  },
  t: DashboardTranslator
) {
  const partnershipCopy =
    input.activePartnerships === 0
      ? t("summary.noActivePartnerships")
      : t("summary.activePartnerships", { count: input.activePartnerships });

  const dueCopy =
    input.dueSoonDeliverables === 0
      ? t("summary.nothingDueThisWeek")
      : t("summary.deliverablesDueThisWeek", { count: input.dueSoonDeliverables });

  const invoiceCopy =
    input.overdueInvoices === 0
      ? t("summary.noOverdueInvoices")
      : t("summary.overdueInvoices", { count: input.overdueInvoices });

  const riskCopy =
    input.riskAlertCount === 0
      ? t("summary.noHighRiskContracts")
      : t("summary.highRiskContracts", { count: input.riskAlertCount });

  return t("summary.full", {
    partnerships: partnershipCopy,
    due: dueCopy,
    invoices: invoiceCopy,
    risk: riskCopy,
  });
}

export function buildDealNextStep(deal: {
  status: string;
  paymentStatus: string;
  nextDeliverableDate: string | null;
  riskFlags: Array<{ severity: string }>;
}, t: DashboardTranslator) {
  const hasHighRisk = deal.riskFlags.some((flag) => flag.severity === "high");
  const nextDueDays = daysUntil(deal.nextDeliverableDate);

  if (deal.paymentStatus === "late") {
    return {
      label: t("nextSteps.sendPaymentFollowUp"),
      tone: "warning" as const,
    };
  }

  if (hasHighRisk) {
    return {
      label: t("nextSteps.reviewHighRiskClauses"),
      tone: "warning" as const,
    };
  }

  if (nextDueDays !== null && nextDueDays >= 0 && nextDueDays <= 7) {
    return {
      label: t("nextSteps.prepareNextDeliverable"),
      tone: "accent" as const,
    };
  }

  if (deal.status === "contract_received") {
    return {
      label: t("nextSteps.reviewContractAndConfirmTerms"),
      tone: "accent" as const,
    };
  }

  if (deal.paymentStatus === "awaiting_payment") {
    return {
      label: t("nextSteps.trackPayoutProgress"),
      tone: "success" as const,
    };
  }

  return {
    label: t("nextSteps.openWorkspaceAndReview"),
    tone: "neutral" as const,
  };
}

function partnershipPriority(deal: {
  paymentStatus: string;
  nextDeliverableDate: string | null;
  riskFlags: Array<{ severity: string }>;
}) {
  const nextDueDays = daysUntil(deal.nextDeliverableDate);

  if (deal.paymentStatus === "late") return 0;
  if (deal.riskFlags.some((flag) => flag.severity === "high")) return 1;
  if (nextDueDays !== null && nextDueDays >= 0 && nextDueDays <= 7) return 2;
  if (deal.paymentStatus === "awaiting_payment") return 3;
  return 4;
}

function dedupeDashboardConflicts(conflicts: ConflictResult[]) {
  return Array.from(
    new Map(
      conflicts.map((conflict) => [
        `${conflict.type}:${conflict.title}:${conflict.relatedDealIds.join(",")}`,
        conflict,
      ])
    ).values()
  );
}

export function buildDashboardViewModel(input: {
  aggregates: DealAggregate[];
  intakeDrafts: IntakeDraftListItem[];
  viewer: Viewer;
  t: DashboardTranslator;
}) {
  const { aggregates, intakeDrafts, viewer, t } = input;

  const dealRows = aggregates.map((aggregate) => {
    const normalized = buildNormalizedIntakeRecord(aggregate);

    return {
      ...aggregate.deal,
      brandName: normalized?.brandName ?? aggregate.deal.brandName,
      campaignName: normalized?.contractTitle ?? aggregate.deal.campaignName,
      riskFlags: aggregate.riskFlags,
      deliverables: aggregate.terms?.deliverables ?? [],
      paymentAmount: aggregate.terms?.paymentAmount ?? null,
      currency: aggregate.terms?.currency ?? "USD",
      conflictResults: aggregate.conflictResults,
      disclosureObligations: aggregate.terms?.disclosureObligations ?? [],
    };
  });

  const activePartnershipItems = dealRows
    .filter((deal) => deal.status !== "completed" && deal.status !== "archived")
    .sort((left, right) => {
      const leftPriority = partnershipPriority(left);
      const rightPriority = partnershipPriority(right);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftDue = left.nextDeliverableDate ?? "9999-99-99";
      const rightDue = right.nextDeliverableDate ?? "9999-99-99";
      return leftDue.localeCompare(rightDue);
    });

  const dashboardConflicts = dedupeDashboardConflicts(
    dealRows.flatMap((deal) => deal.conflictResults)
  );
  const dashboardConflictCounts = countConflictSeverity(dashboardConflicts);

  const allDeliverables = dealRows
    .flatMap((deal) =>
      deal.deliverables.map((deliverable) => ({
        ...deliverable,
        dealId: deal.id,
        campaignName: deal.campaignName,
        brandName: deal.brandName,
      }))
    )
    .sort((left, right) => {
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return left.dueDate.localeCompare(right.dueDate);
    });

  const activePartnerships = activePartnershipItems.length;
  const completedPartnerships = dealRows.filter(
    (deal) => deal.status === "completed" || deal.status === "paid"
  ).length;
  const totalRevenue = dealRows.reduce((sum, deal) => sum + (deal.paymentAmount ?? 0), 0);
  const pendingPayoutDeals = dealRows.filter((deal) =>
    ["awaiting_payment", "late"].includes(deal.paymentStatus)
  );
  const pendingPaymentsAmount = pendingPayoutDeals.reduce(
    (sum, deal) => sum + (deal.paymentAmount ?? 0),
    0
  );
  const riskAlertCount = dealRows.filter((deal) =>
    deal.riskFlags.some((flag) => flag.severity === "high")
  ).length;
  const overdueInvoices = dealRows.filter((deal) => deal.paymentStatus === "late").length;
  const dueSoonDeliverables = allDeliverables.filter((item) => {
    const days = daysUntil(item.dueDate);
    return days !== null && days >= 0 && days <= 7;
  });
  const firstLateDeal = pendingPayoutDeals.find((deal) => deal.paymentStatus === "late");
  const firstHighRiskDeal = activePartnershipItems.find((deal) =>
    deal.riskFlags.some((flag) => flag.severity === "high")
  );
  const nextActionDeliverable = dueSoonDeliverables[0] ?? allDeliverables[0] ?? null;
  const firstDraft = intakeDrafts[0] ?? null;
  const firstName = viewer.displayName.trim().split(/\s+/)[0] || "Creator";

  const attentionItems: QuickActionItem[] = [
    firstLateDeal
      ? {
          tone: "warning",
          title: t("actions.overduePayoutTitle"),
          body: t("actions.overduePayoutBody", { campaignName: firstLateDeal.campaignName }),
          href: `/app/p/${firstLateDeal.id}`,
          ctaLabel: t("actions.openPaymentStatus"),
        }
      : null,
    firstHighRiskDeal
      ? {
          tone: "warning",
          title: t("actions.contractWatchoutsTitle"),
          body: t("actions.contractWatchoutsBody", {
            campaignName: firstHighRiskDeal.campaignName,
          }),
          href: `/app/p/${firstHighRiskDeal.id}`,
          ctaLabel: t("actions.reviewRisks"),
        }
      : null,
    nextActionDeliverable
      ? {
          tone: "accent",
          title: t("actions.deliverableComingUpTitle"),
          body: t("actions.deliverableComingUpBody", {
            deliverableTitle: nextActionDeliverable.title,
            campaignName: nextActionDeliverable.campaignName,
            dueLabel: dueLabel(nextActionDeliverable.dueDate, t).toLowerCase(),
          }),
          href: `/app/p/${nextActionDeliverable.dealId}`,
          ctaLabel: t("actions.openDeliverable"),
        }
      : null,
    firstDraft
      ? firstDraft.session.status === "ready_for_confirmation"
        ? {
            tone: "accent",
            title: t("actions.workspaceReadyTitle"),
            body: t("actions.workspaceReadyBody", { campaignName: firstDraft.deal.campaignName }),
            href: `/app/intake/${firstDraft.session.id}/review`,
            ctaLabel: t("actions.reviewAndConfirm"),
          }
        : firstDraft.session.status === "draft"
          ? {
              tone: "neutral",
              title: t("actions.resumeDraftTitle"),
              body: t("actions.resumeDraftBody", { campaignName: firstDraft.deal.campaignName }),
              href: `/app/intake/new?draft=${firstDraft.session.id}`,
              ctaLabel: t("actions.resumeDraft"),
            }
          : {
              tone: "neutral",
              title: t("actions.workspaceProcessingTitle"),
              body: t("actions.workspaceProcessingBody", {
                campaignName: firstDraft.deal.campaignName,
              }),
              href: `/app/intake/${firstDraft.session.id}`,
              ctaLabel: t("actions.viewProgress"),
            }
      : null,
  ].filter(Boolean) as QuickActionItem[];

  const snapshotMetrics = [
      {
      label: t("snapshot.activePartnerships"),
      value: String(activePartnerships),
      note: t("snapshot.activePartnershipsNote", { count: completedPartnerships }),
    },
    {
      label: t("snapshot.trackedRevenue"),
      value: formatCurrency(totalRevenue),
      note: t("snapshot.trackedRevenueNote", { count: dealRows.length }),
    },
    {
      label: t("snapshot.outstandingPayouts"),
      value: formatCurrency(pendingPaymentsAmount),
      note:
        overdueInvoices > 0
          ? t("snapshot.outstandingPayoutsOverdue", { count: overdueInvoices })
          : t("snapshot.outstandingPayoutsClear"),
    },
    {
      label: t("snapshot.riskAlerts"),
      value: String(riskAlertCount),
      note:
        dashboardConflictCounts.total > 0
          ? t("snapshot.riskAlertsWarnings", { count: dashboardConflictCounts.total })
          : t("snapshot.riskAlertsClear"),
    },
  ];

  const secondarySections = {
    dueSoonDeliverables: allDeliverables
      .filter((item) => {
        const days = daysUntil(item.dueDate);
        return days !== null && days >= -7;
      })
      .slice(0, 4),
    pendingPayoutDeals: pendingPayoutDeals.slice(0, 4),
    snapshotMetrics,
    disclosureObligations: dealRows.flatMap((deal) => deal.disclosureObligations ?? []).slice(0, 4),
  };

  return {
    activePartnershipItems,
    attentionItems,
    dashboardConflicts,
    firstName,
    hasDueSoon: secondarySections.dueSoonDeliverables.length > 0,
    hasPendingPayouts: secondarySections.pendingPayoutDeals.length > 0,
    secondarySections,
    todaySummary: buildTodaySummary({
      activePartnerships,
      dueSoonDeliverables: dueSoonDeliverables.length,
      overdueInvoices,
      riskAlertCount,
    }, t),
  };
}
