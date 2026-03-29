import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Clock3,
  DollarSign,
  Receipt
} from "lucide-react";

import { ConflictWarnings } from "@/components/conflict-warnings";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { DisclosureObligations } from "@/components/disclosure-obligations";
import { QuickActionsPanel, type QuickActionItem } from "@/components/quick-actions-panel";
import { RecentDealCardMenu } from "@/components/recent-deal-card-menu";
import { DashboardSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth";
import {
  getCachedDealAggregates,
  getCachedIntakeDrafts,
  getCachedOnboardingState
} from "@/lib/cached-data";
import { countConflictSeverity } from "@/lib/conflict-intelligence";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { cn, formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

function daysUntil(date: string | null) {
  if (!date) {
    return null;
  }

  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function dueLabel(date: string | null) {
  const days = daysUntil(date);

  if (days === null) {
    return "Date not set";
  }

  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }

  if (days === 0) {
    return "Due today";
  }

  if (days === 1) {
    return "In 1 day";
  }

  return `In ${days} days`;
}

function paymentBadgeClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "late") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
  }

  if (status === "awaiting_payment" || status === "invoiced") {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a3acb9]";
}

function nextStepTextClass(tone: "warning" | "success" | "accent" | "neutral") {
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

function buildTodaySummary(input: {
  activePartnerships: number;
  dueSoonDeliverables: number;
  overdueInvoices: number;
  riskAlertCount: number;
}) {
  const partnershipCopy =
    input.activePartnerships === 0
      ? "No active partnerships yet"
      : `${input.activePartnerships} active partnership${input.activePartnerships === 1 ? "" : "s"}`;

  const dueCopy =
    input.dueSoonDeliverables === 0
      ? "nothing due this week"
      : `${input.dueSoonDeliverables} deliverable${input.dueSoonDeliverables === 1 ? "" : "s"} due this week`;

  const invoiceCopy =
    input.overdueInvoices === 0
      ? "no overdue invoices"
      : `${input.overdueInvoices} overdue invoice${input.overdueInvoices === 1 ? "" : "s"}`;

  const riskCopy =
    input.riskAlertCount === 0
      ? "no high-risk contracts"
      : `${input.riskAlertCount} high-risk contract${input.riskAlertCount === 1 ? "" : "s"} to review`;

  return `${partnershipCopy}. Right now you have ${dueCopy}, ${invoiceCopy}, and ${riskCopy}.`;
}

function buildDealNextStep(deal: {
  status: string;
  paymentStatus: string;
  nextDeliverableDate: string | null;
  riskFlags: Array<{ severity: string }>;
}) {
  const hasHighRisk = deal.riskFlags.some((flag) => flag.severity === "high");
  const nextDueDays = daysUntil(deal.nextDeliverableDate);

  if (deal.paymentStatus === "late") {
    return {
      label: "Send payment follow-up",
      tone: "warning" as const
    };
  }

  if (hasHighRisk) {
    return {
      label: "Review high-risk clauses",
      tone: "warning" as const
    };
  }

  if (nextDueDays !== null && nextDueDays >= 0 && nextDueDays <= 7) {
    return {
      label: "Prepare the next deliverable",
      tone: "accent" as const
    };
  }

  if (deal.status === "contract_received") {
    return {
      label: "Review contract and confirm terms",
      tone: "accent" as const
    };
  }

  if (deal.paymentStatus === "awaiting_payment" || deal.paymentStatus === "invoiced") {
    return {
      label: "Track payout progress",
      tone: "success" as const
    };
  }

  return {
    label: "Open workspace and review the next step",
    tone: "neutral" as const
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
  if (deal.paymentStatus === "awaiting_payment" || deal.paymentStatus === "invoiced") return 3;
  return 4;
}

export default function WorkspaceDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const viewer = await requireViewer();
  const [aggregates, intakeDrafts, onboardingState] = await Promise.all([
    getCachedDealAggregates(viewer),
    getCachedIntakeDrafts(viewer),
    getCachedOnboardingState(viewer)
  ]);

  const isOnboardingComplete = !!onboardingState.profileOnboardingCompletedAt;

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
      disclosureObligations: aggregate.terms?.disclosureObligations ?? []
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

  const dashboardConflicts = Array.from(
    new Map(
      dealRows
        .flatMap((deal) => deal.conflictResults)
        .map((conflict) => [
          `${conflict.type}:${conflict.title}:${conflict.relatedDealIds.join(",")}`,
          conflict
        ])
    ).values()
  );

  const dashboardConflictCounts = countConflictSeverity(dashboardConflicts);

  const allDeliverables = dealRows
    .flatMap((deal) =>
      deal.deliverables.map((deliverable) => ({
        ...deliverable,
        dealId: deal.id,
        campaignName: deal.campaignName,
        brandName: deal.brandName
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
    ["invoiced", "awaiting_payment", "late"].includes(deal.paymentStatus)
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
          title: "Overdue payout needs a follow-up",
          body: `${firstLateDeal.campaignName} is still overdue. Check the payment thread and nudge the brand.`,
          href: `/app/p/${firstLateDeal.id}`,
          ctaLabel: "Open payment status"
        }
      : null,
    firstHighRiskDeal
      ? {
          tone: "warning",
          title: "Contract watchouts still need review",
          body: `${firstHighRiskDeal.campaignName} has high-severity issues that should be checked before work continues.`,
          href: `/app/p/${firstHighRiskDeal.id}`,
          ctaLabel: "Review risks"
        }
      : null,
    nextActionDeliverable
      ? {
          tone: "accent",
          title: "A deliverable is coming up soon",
          body: `${nextActionDeliverable.title} for ${nextActionDeliverable.campaignName} is due ${dueLabel(nextActionDeliverable.dueDate).toLowerCase()}.`,
          href: `/app/p/${nextActionDeliverable.dealId}`,
          ctaLabel: "Open deliverable"
        }
      : null,
    firstDraft
      ? firstDraft.session.status === "ready_for_confirmation"
        ? {
            tone: "accent",
            title: "Workspace ready to confirm",
            body: `${firstDraft.deal.campaignName} has finished processing and is ready for your review.`,
            href: `/app/intake/${firstDraft.session.id}/review`,
            ctaLabel: "Review and confirm"
          }
        : firstDraft.session.status === "draft"
          ? {
              tone: "neutral",
              title: "Resume your draft",
              body: `${firstDraft.deal.campaignName} has a saved draft waiting for you.`,
              href: `/app/intake/new?draft=${firstDraft.session.id}`,
              ctaLabel: "Resume draft"
            }
          : {
              tone: "neutral",
              title: "Workspace is processing",
              body: `${firstDraft.deal.campaignName} is being analyzed. You'll be notified when it's ready.`,
              href: `/app/intake/${firstDraft.session.id}`,
              ctaLabel: "View progress"
            }
      : null
  ].filter(Boolean) as QuickActionItem[];

  const snapshotMetrics = [
    {
      label: "Active partnerships",
      value: String(activePartnerships),
      note: `${completedPartnerships} wrapped`
    },
    {
      label: "Tracked revenue",
      value: formatCurrency(totalRevenue),
      note: `${dealRows.length} total workspaces`
    },
    {
      label: "Outstanding payouts",
      value: formatCurrency(pendingPaymentsAmount),
      note:
        overdueInvoices > 0
          ? `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"}`
          : "Nothing overdue"
    },
    {
      label: "Risk alerts",
      value: String(riskAlertCount),
      note:
        dashboardConflictCounts.total > 0
          ? `${dashboardConflictCounts.total} cross-partnership warning${dashboardConflictCounts.total === 1 ? "" : "s"}`
          : "No active overlaps"
    }
  ];

  const secondarySections = {
    dueSoonDeliverables: dueSoonDeliverables.slice(0, 4),
    pendingPayoutDeals: pendingPayoutDeals.slice(0, 4),
    snapshotMetrics,
    disclosureObligations: dealRows.flatMap((deal) => deal.disclosureObligations ?? []).slice(0, 4)
  };

  const todaySummary = buildTodaySummary({
    activePartnerships,
    dueSoonDeliverables: dueSoonDeliverables.length,
    overdueInvoices,
    riskAlertCount
  });

  const hasDueSoon = secondarySections.dueSoonDeliverables.length > 0;
  const hasPendingPayouts = secondarySections.pendingPayoutDeals.length > 0;

  return (
    <div className="px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        {/* Hero: greeting + summary */}
        <section className="border border-black/8 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#15191f] dark:shadow-none sm:p-7">
          <DashboardGreeting firstName={firstName} />

          <p className="mt-4 max-w-[62ch] text-sm leading-7 text-[#475467] dark:text-[#b1bac6]">
            {todaySummary}
          </p>
        </section>

        {/* Attention items (full-width, only when items exist) */}
        <QuickActionsPanel items={attentionItems} />

        {/* Active partnerships (full-width) */}
        <section data-guide="active-partnerships" className="border border-black/8 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#15191f] dark:shadow-none sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[28px] font-semibold tracking-[-0.05em] text-foreground">
              Active partnerships
            </h2>

            <Link
              href="/app/p/history"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View all
            </Link>
          </div>

          {activePartnershipItems.length === 0 ? (
            <div className="mt-6 border border-dashed border-black/10 bg-[#fafafb] p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-base font-semibold text-foreground">No active partnerships yet.</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with one workspace and this dashboard will begin surfacing due dates, payment follow-ups, and risk review.
              </p>
              <div className="mt-5">
                <Link
                  href="/app/intake/new"
                  data-guide="add-documents"
                  className={cn(buttonVariants({ size: "sm" }), "gap-2")}
                >
                  New workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden border border-black/8 dark:border-white/10">
              {/* Column headers (desktop only) */}
              <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_120px_140px_130px_minmax(0,1fr)_40px] border-b border-black/8 bg-[#f7f8fa] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#667085]">
                <span>Campaign</span>
                <span>Stage</span>
                <span>Amount</span>
                <span>Due</span>
                <span>Next step</span>
                <span />
              </div>

              {activePartnershipItems.slice(0, 5).map((deal) => {
                const nextStep = buildDealNextStep(deal);

                return (
                  <div
                    key={deal.id}
                    className="flex flex-col gap-2 border-b border-black/6 px-5 py-4 transition-colors last:border-b-0 hover:bg-[#fafafb] md:grid md:grid-cols-[minmax(0,1.4fr)_120px_140px_130px_minmax(0,1fr)_40px] md:items-center dark:border-white/8 dark:hover:bg-white/[0.02]"
                  >
                    <Link href={`/app/p/${deal.id}`} className="min-w-0 pr-4">
                      <p className="truncate text-base font-semibold text-foreground">
                        {deal.campaignName}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {deal.brandName}
                      </p>
                    </Link>

                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs text-muted-foreground md:hidden">Stage</span>
                      <span className="text-sm text-muted-foreground">
                        {humanizeToken(deal.status)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs text-muted-foreground md:hidden">Amount</span>
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(deal.paymentAmount, deal.currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs text-muted-foreground md:hidden">Due</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(deal.nextDeliverableDate)}
                      </span>
                    </div>

                    <Link
                      href={`/app/p/${deal.id}`}
                      className="flex items-center justify-between gap-2 md:justify-start"
                    >
                      <span className="text-xs text-muted-foreground md:hidden">Next step</span>
                      <span className={cn("text-sm font-medium", nextStepTextClass(nextStep.tone))}>
                        {nextStep.label}
                      </span>
                      <ArrowRight className="hidden h-3.5 w-3.5 text-foreground/40 md:block" />
                    </Link>

                    <div className="flex justify-end">
                      <RecentDealCardMenu dealId={deal.id} dealName={deal.campaignName} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Cross-partnership conflicts (conditional) */}
        {dashboardConflicts.length > 0 ? (
          <ConflictWarnings
            conflicts={dashboardConflicts}
            compact
            title="Cross-partnership conflicts"
            description="HelloBrand found overlapping category, exclusivity, or timing signals across active workspaces."
          />
        ) : null}

        {/* Secondary strip: deliverables, payments, snapshot */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
          {/* Deliverables */}
          {hasDueSoon ? (
            <section className="border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#15191f] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085] dark:text-[#8f98a6]">
                    Deliverables
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Upcoming this week
                  </h2>
                </div>
                <Clock3 className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
              </div>

              <div className="mt-6 space-y-3">
                {secondarySections.dueSoonDeliverables.map((item) => (
                  <Link
                    key={`${item.dealId}:${item.id}`}
                    href={`/app/p/${item.dealId}`}
                    className="block border border-[#d7e7df] bg-[#f3f8f5] p-4 transition-colors hover:bg-[#eef6f1] dark:border-[#294137] dark:bg-[#12201a] dark:hover:bg-[#15261f]"
                  >
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.campaignName}</p>
                    <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-foreground">{formatDate(item.dueDate)}</span>
                      <span className="text-muted-foreground">{dueLabel(item.dueDate)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <div className="flex items-start gap-3 border border-black/8 bg-white px-5 py-5 dark:border-white/10 dark:bg-[#15191f]">
              <Clock3 className="h-4 w-4 shrink-0 text-[#98a2b3] dark:text-[#8f98a6]" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Deliverables</span>
                {" "}· Nothing due this week
              </p>
            </div>
          )}

          {/* Payments */}
          {hasPendingPayouts ? (
            <section className="border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#15191f] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085] dark:text-[#8f98a6]">
                    Payments
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Outstanding payouts
                  </h2>
                </div>
                <Receipt className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
              </div>

              <div className="mt-6 space-y-3">
                {secondarySections.pendingPayoutDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/app/p/${deal.id}`}
                    className="block border border-black/8 bg-[#fcfcfd] p-4 transition-colors hover:bg-[#f7f8fa] dark:border-white/10 dark:bg-[#12171d] dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{deal.campaignName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{deal.brandName}</p>
                      </div>
                      <Badge className={paymentBadgeClass(deal.paymentStatus)}>
                        {humanizeToken(deal.paymentStatus)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {formatCurrency(deal.paymentAmount, deal.currency)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <div className="flex items-start gap-3 border border-black/8 bg-white px-5 py-5 dark:border-white/10 dark:bg-[#15191f]">
              <Receipt className="h-4 w-4 shrink-0 text-[#98a2b3] dark:text-[#8f98a6]" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Payments</span>
                {" "}· No outstanding payouts
              </p>
            </div>
          )}

          {/* Portfolio snapshot */}
          <section className="border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#15191f] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085] dark:text-[#8f98a6]">
                  Portfolio snapshot
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  At a glance
                </h2>
              </div>
              <DollarSign className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {secondarySections.snapshotMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border border-black/8 bg-[#fafafb] px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{metric.note}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Disclosure reminders (conditional) */}
        {secondarySections.disclosureObligations.length > 0 ? (
          <DisclosureObligations
            obligations={secondarySections.disclosureObligations}
            title="Disclosure reminders across active partnerships"
          />
        ) : null}
      </div>
    </div>
  );
}
