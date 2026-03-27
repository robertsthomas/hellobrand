import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileClock,
  FileText,
  Receipt,
  Info
} from "lucide-react";

import { AppTooltip, InfoTooltip } from "@/components/app-tooltip";
import { ConflictWarnings } from "@/components/conflict-warnings";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { DashboardDealsTable } from "@/components/dashboard-deals-table";
import { DisclosureObligations } from "@/components/disclosure-obligations";
import { QuickActionsPanel } from "@/components/quick-actions-panel";
import { RecentDealCardMenu } from "@/components/recent-deal-card-menu";
import { DashboardSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ScrollableTabsList } from "@/components/scrollable-tabs-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { getCachedDealAggregates } from "@/lib/cached-data";
import { countConflictSeverity } from "@/lib/conflict-intelligence";
import { listIntakeDraftsForViewer } from "@/lib/intake";
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

function statusBadgeClass(status: string) {
  if (status === "completed" || status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/10";
  }

  if (status === "contract_received" || status === "negotiating") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/10";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] hover:bg-[#f5f6f8] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a3acb9] dark:hover:bg-white/[0.04]";
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

export default function WorkspaceDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const viewer = await requireViewer();
  const [aggregates, intakeDrafts] = await Promise.all([
    getCachedDealAggregates(viewer),
    listIntakeDraftsForViewer(viewer)
  ]);

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
      documents: aggregate.documents,
      latestDocument: aggregate.latestDocument,
      conflictResults: aggregate.conflictResults,
      disclosureObligations: aggregate.terms?.disclosureObligations ?? []
    };
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

  const activePartnerships = dealRows.filter((deal) => deal.status !== "completed").length;
  const totalRevenue = dealRows.reduce((sum, deal) => sum + (deal.paymentAmount ?? 0), 0);
  const pendingPaymentsAmount = dealRows
    .filter((deal) =>
      ["invoiced", "awaiting_payment", "late"].includes(deal.paymentStatus)
    )
    .reduce((sum, deal) => sum + (deal.paymentAmount ?? 0), 0);
  const riskAlertCount = dealRows.filter((deal) =>
    deal.riskFlags.some((flag) => flag.severity === "high")
  ).length;
  const overdueInvoices = dealRows.filter((deal) => deal.paymentStatus === "late").length;
  const completedPartnerships = dealRows.filter(
    (deal) => deal.status === "completed" || deal.status === "paid"
  ).length;
  const dueSoonDeliverables = allDeliverables.filter((item) => {
    const days = daysUntil(item.dueDate);
    return days !== null && days >= 0 && days <= 7;
  });
  const overdueDeliverables = allDeliverables.filter((item) => {
    const days = daysUntil(item.dueDate);
    return days !== null && days < 0;
  });
  const firstLateDeal = dealRows.find((deal) => deal.paymentStatus === "late");
  const firstHighRiskDeal = dealRows.find((deal) =>
    deal.riskFlags.some((flag) => flag.severity === "high")
  );
  const nextActionDeliverable = dueSoonDeliverables[0] ?? allDeliverables[0] ?? null;

  const actionItems = [
    firstLateDeal
      ? {
          tone: "warning" as const,
          title: "Payment follow-up",
          body: `${firstLateDeal.campaignName} has an overdue invoice that needs a check-in.`,
          href: `/app/deals/${firstLateDeal.id}`
        }
      : null,
    firstHighRiskDeal
      ? {
          tone: "accent" as const,
          title: "Review contract watchouts",
          body: `${firstHighRiskDeal.campaignName} still has high-severity items before signature.`,
          href: `/app/deals/${firstHighRiskDeal.id}`
        }
      : null,
    nextActionDeliverable
      ? {
          tone: "success" as const,
          title: "Upcoming deliverable",
          body: `${nextActionDeliverable.title} for ${nextActionDeliverable.campaignName} is due ${formatDate(nextActionDeliverable.dueDate)}.`,
          href: `/app/deals/${nextActionDeliverable.dealId}`
        }
      : null
  ].filter(Boolean) as Array<{
    tone: "accent" | "warning" | "success";
    title: string;
    body: string;
    href: string;
  }>;

  const firstName = viewer.displayName.trim().split(/\s+/)[0] || "Creator";

  const metrics = [
    {
      label: "Active partnerships",
      value: String(activePartnerships),
      note: `${completedPartnerships} completed`,
      icon: FileText,
      help: "Confirmed workspaces that are still in progress or under review."
    },
    {
      label: "Tracked revenue",
      value: formatCurrency(totalRevenue),
      note: `${dealRows.length} total workspaces`,
      icon: DollarSign,
      help: "Combined value across all confirmed workspaces currently tracked in HelloBrand."
    },
    {
      label: "Outstanding",
      value: formatCurrency(pendingPaymentsAmount),
      note:
        overdueInvoices > 0
          ? `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"}`
          : "Nothing overdue",
      icon: Receipt,
      help: "Payments still waiting to be received, including invoiced and overdue brand partnerships."
    },
    {
      label: "Risk alerts",
      value: String(riskAlertCount),
      note:
        dashboardConflictCounts.total > 0
          ? `${dashboardConflictCounts.total} cross-partnership warning${dashboardConflictCounts.total === 1 ? "" : "s"}`
          : "No active overlaps",
      icon: AlertTriangle,
      help: "Workspaces with high-severity contract risks or cross-partnership conflicts that need attention."
    }
  ];

  return (
    <div className="px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <section className="border border-black/8 bg-white px-4 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] sm:px-7 sm:py-7 lg:px-8 dark:border-white/10 dark:bg-[#15191f] dark:shadow-none">
          <div>
            <DashboardGreeting firstName={firstName} />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.label}
                  className="border border-black/7 bg-[#fbfbfc] px-5 py-5 dark:border-white/10 dark:bg-[#10141a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <AppTooltip content={metric.help} sideOffset={8}>
                        <button
                          type="button"
                          aria-label={`About ${metric.label}`}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#98a2b3] transition hover:text-foreground dark:text-[#8f98a6]"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </AppTooltip>
                    </div>
                    <Icon className="h-4.5 w-4.5 text-[#98a2b3] dark:text-[#8f98a6]" />
                  </div>
                  <p className="mt-5 text-2xl font-semibold tracking-[-0.06em] text-foreground sm:text-[34px]">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{metric.note}</p>
                </div>
              );
            })}
          </div>
        </section>

        <Tabs defaultValue="overview" className="w-full">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <ScrollableTabsList>
              <TabsList className="inline-flex h-auto w-max flex-nowrap gap-1 border-0 bg-transparent p-1 shadow-none dark:bg-transparent">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deals">Partnerships</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
            </ScrollableTabsList>

            <div className="flex items-center gap-3 rounded-md border border-black/8 bg-white px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-[#15191f]">
              <Clock3 className="h-4 w-4 text-[#98a2b3] dark:text-[#8f98a6]" />
              <span>{dueSoonDeliverables.length} due this week</span>
            </div>
          </div>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {dashboardConflicts.length > 0 ? (
              <ConflictWarnings
                conflicts={dashboardConflicts}
                compact
                title="Cross-partnership conflicts"
                description="HelloBrand found overlapping category, exclusivity, or timing signals across active workspaces."
              />
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,360px)]">
              <div className="min-w-0 space-y-6">
                <section className="overflow-hidden border border-black/8 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.05)] sm:p-6 dark:border-white/10 dark:bg-[#15191f] dark:shadow-none">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                        Recent workspaces
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[30px]">
                        Active partnership flow
                      </h2>
                    </div>
                    <Link
                      href="/app/deals/history"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      View all
                    </Link>
                  </div>

                  <div className="border-t border-black/8 dark:border-white/10">
                    {dealRows.length === 0 ? (
                      <div className="px-1 py-5 text-sm text-muted-foreground">
                        No workspaces yet. Use the new workspace button when you&apos;re ready to start one.
                      </div>
                    ) : (
                      <>
                        <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_140px_150px_140px_60px] border-b border-black/8 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3] dark:border-white/10 dark:text-[#8f98a6]">
                          <span>Partnership</span>
                          <span>Stage</span>
                          <span>Payment</span>
                          <span>Next due</span>
                          <span />
                        </div>

                        {dealRows.slice(0, 6).map((deal) => (
                          <div
                            key={deal.id}
                            className="flex flex-col gap-2 border-b border-black/6 px-3 py-4 transition-colors hover:bg-[#f6f7f8] sm:px-5 md:grid md:grid-cols-[minmax(0,1.6fr)_140px_150px_140px_60px] md:items-center dark:border-white/8 dark:hover:bg-white/[0.04]"
                          >
                            <Link href={`/app/deals/${deal.id}`} className="min-w-0 pr-4">
                              <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                                {deal.campaignName}
                              </p>
                              <p className="mt-1 truncate text-sm text-muted-foreground">
                                {deal.brandName}
                              </p>
                            </Link>
                            <div className="flex items-center justify-between md:block">
                              <span className="text-xs text-muted-foreground md:hidden">Stage</span>
                              <Badge className={statusBadgeClass(deal.status)}>
                                {humanizeToken(deal.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between md:block">
                              <span className="text-xs text-muted-foreground md:hidden">Payment</span>
                              <span className="text-sm font-medium text-foreground">
                                {formatCurrency(deal.paymentAmount, deal.currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between md:block">
                              <span className="text-xs text-muted-foreground md:hidden">Next due</span>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(deal.nextDeliverableDate)}
                              </span>
                            </div>
                            <div className="flex justify-end">
                              <RecentDealCardMenu dealId={deal.id} dealName={deal.campaignName} />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="overflow-hidden border border-black/8 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-[#15191f]">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                          Deliverables
                        </p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground sm:text-2xl">
                          Upcoming this week
                        </h2>
                      </div>
                      <Clock3 className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
                    </div>

                    <div className="divide-y divide-black/8 border-t border-black/8 dark:divide-white/10 dark:border-white/10">
                      {dueSoonDeliverables.length === 0 ? (
                        <p className="px-1 py-4 text-sm text-muted-foreground">
                          No upcoming deliverables this week.
                        </p>
                      ) : (
                        dueSoonDeliverables.slice(0, 4).map((item) => (
                          <Link
                            key={`${item.dealId}:${item.id}`}
                            href={`/app/deals/${item.dealId}`}
                            className="flex items-start justify-between gap-4 px-1 py-4 transition-colors hover:bg-[#f6f7f8] dark:hover:bg-white/[0.04]"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{item.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.campaignName}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-medium text-foreground">
                                {formatDate(item.dueDate)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {dueLabel(item.dueDate)}
                              </p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="overflow-hidden border border-black/8 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-[#15191f]">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                          Payments
                        </p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground sm:text-2xl">
                          Outstanding payouts
                        </h2>
                      </div>
                      <Receipt className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
                    </div>

                    <div className="divide-y divide-black/8 border-t border-black/8 dark:divide-white/10 dark:border-white/10">
                      {dealRows
                        .filter((deal) =>
                          ["invoiced", "awaiting_payment", "late"].includes(deal.paymentStatus)
                        )
                        .slice(0, 4)
                        .map((deal) => (
                          <Link
                            key={deal.id}
                            href={`/app/deals/${deal.id}`}
                            className="flex items-start justify-between gap-4 px-1 py-4 transition-colors hover:bg-[#f6f7f8] dark:hover:bg-white/[0.04]"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">
                                {deal.campaignName}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {deal.brandName}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-medium text-foreground">
                                {formatCurrency(deal.paymentAmount, deal.currency)}
                              </p>
                              <Badge className={cn("mt-2", paymentBadgeClass(deal.paymentStatus))}>
                                {humanizeToken(deal.paymentStatus)}
                              </Badge>
                            </div>
                          </Link>
                        ))}

                      {dealRows.filter((deal) =>
                        ["invoiced", "awaiting_payment", "late"].includes(deal.paymentStatus)
                      ).length === 0 ? (
                        <p className="px-1 py-4 text-sm text-muted-foreground">
                          No outstanding payouts right now.
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>

                {dealRows.some((deal) => (deal.disclosureObligations?.length ?? 0) > 0) ? (
                  <DisclosureObligations
                    obligations={dealRows.flatMap((deal) => deal.disclosureObligations ?? []).slice(0, 4)}
                    title="Disclosure reminders across active partnerships"
                  />
                ) : null}
              </div>

              <div className="min-w-0 space-y-6">
                <QuickActionsPanel items={actionItems} />

              <section className="overflow-hidden border border-black/8 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-[#15191f]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                        Intake drafts
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                        In-progress setups
                      </h2>
                    </div>
                    <InfoTooltip
                      label="About intake drafts"
                      content="Saved intake sessions that were already started on the server and can be resumed."
                    />
                  </div>

                  <div className="mt-6 border-t border-black/8 dark:border-white/10">
                    {intakeDrafts.length === 0 ? (
                      <div className="py-5 text-sm text-muted-foreground">
                        No draft intakes waiting.
                      </div>
                    ) : (
                      intakeDrafts.slice(0, 4).map(({ session, deal }) => (
                        <div
                          key={session.id}
                          className="border-b border-black/8 py-4 transition-colors hover:bg-[#f6f7f8] dark:border-white/10 dark:hover:bg-white/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-3 px-1">
                            <Link
                              href={
                                session.status === "draft"
                                  ? `/app/intake/new?draft=${session.id}`
                                  : `/app/intake/${session.id}`
                              }
                              className="min-w-0 flex-1"
                            >
                              <p className="truncate font-semibold text-foreground">
                                {deal.campaignName}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {deal.brandName}
                              </p>
                              <p className="mt-3 text-xs text-[#98a2b3] dark:text-[#8f98a6]">
                                Updated {formatDate(session.updatedAt)}
                              </p>
                            </Link>
                            <Badge className={statusBadgeClass(session.status)}>
                              {humanizeToken(session.status)}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deals" className="mt-6">
            <DashboardDealsTable
              deals={dealRows.map((deal) => ({
                id: deal.id,
                campaignName: deal.campaignName,
                brandName: deal.brandName,
                status: deal.status,
                paymentStatus: deal.paymentStatus,
                paymentAmount: deal.paymentAmount,
                currency: deal.currency,
                nextDeliverableDate: deal.nextDeliverableDate,
              }))}
            />
          </TabsContent>

          <TabsContent value="deliverables" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-3">
              <section className="border border-black/8 bg-white dark:border-white/10 dark:bg-[#161a1f]">
                <div className="flex items-center justify-between border-b border-black/8 px-6 py-5 dark:border-white/10">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Overdue
                  </h2>
                  <FileClock className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
                </div>
                <div className="divide-y divide-black/8">
                  {overdueDeliverables.length === 0 ? (
                    <div className="px-6 py-5 text-sm text-muted-foreground">
                      No overdue deliverables.
                    </div>
                  ) : (
                    overdueDeliverables.slice(0, 5).map((item) => (
                      <Link
                        key={`${item.dealId}:${item.id}:late`}
                        href={`/app/deals/${item.dealId}`}
                        className="block px-6 py-5 transition-colors hover:bg-[#f6f7f8] dark:hover:bg-white/[0.03]"
                      >
                        <div className="border-l-2 border-l-red-300 pl-4">
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.campaignName}</p>
                          <p className="mt-2 text-xs font-medium text-red-700">{dueLabel(item.dueDate)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="border border-black/8 bg-white dark:border-white/10 dark:bg-[#161a1f]">
                <div className="flex items-center justify-between border-b border-black/8 px-6 py-5 dark:border-white/10">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Due this week
                  </h2>
                  <Clock3 className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
                </div>
                <div className="divide-y divide-black/8">
                  {dueSoonDeliverables.length === 0 ? (
                    <div className="px-6 py-5 text-sm text-muted-foreground">
                      Nothing due this week.
                    </div>
                  ) : (
                    dueSoonDeliverables.slice(0, 5).map((item) => (
                      <Link
                        key={`${item.dealId}:${item.id}:soon`}
                        href={`/app/deals/${item.dealId}`}
                        className="block px-6 py-5 transition-colors hover:bg-[#f6f7f8] dark:hover:bg-white/[0.03]"
                      >
                        <div className="border-l-2 border-l-primary/20 pl-4">
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.campaignName}</p>
                          <p className="mt-2 text-xs font-medium text-foreground">{formatDate(item.dueDate)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="border border-black/8 bg-white dark:border-white/10 dark:bg-[#161a1f]">
                <div className="flex items-center justify-between border-b border-black/8 px-6 py-5 dark:border-white/10">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Recently wrapped
                  </h2>
                  <CheckCircle2 className="h-5 w-5 text-[#98a2b3] dark:text-[#8f98a6]" />
                </div>
                <div className="divide-y divide-black/8">
                  {dealRows.filter((deal) => deal.status === "completed" || deal.status === "paid").length === 0 ? (
                    <div className="px-6 py-5 text-sm text-muted-foreground">
                      No recently wrapped work.
                    </div>
                  ) : (
                    dealRows
                    .filter((deal) => deal.status === "completed" || deal.status === "paid")
                    .slice(0, 5)
                    .map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/app/deals/${deal.id}`}
                        className="block px-6 py-5 transition-colors hover:bg-[#f6f7f8] dark:hover:bg-white/[0.03]"
                      >
                        <div className="border-l-2 border-l-emerald-300 pl-4">
                          <p className="font-semibold text-foreground">{deal.campaignName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{deal.brandName}</p>
                          <p className="mt-2 text-xs font-medium text-emerald-700">
                            {humanizeToken(deal.status)}
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_400px]">
              <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#15191f]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                    Revenue overview
                  </p>
                  <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                    Partnership performance
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      label: "Tracked revenue",
                      value: formatCurrency(totalRevenue),
                      detail: "Across all confirmed workspaces"
                    },
                    {
                      label: "Average partnership value",
                      value: formatCurrency(
                        dealRows.length > 0 ? Math.round(totalRevenue / dealRows.length) : 0
                      ),
                      detail: "Per confirmed workspace"
                    },
                    {
                      label: "Payments waiting",
                      value: formatCurrency(pendingPaymentsAmount),
                      detail: "Still pending or overdue"
                    },
                    {
                      label: "Risk alerts",
                      value: String(riskAlertCount),
                      detail: "Workspaces with high-severity flags"
                    }
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="border border-black/8 px-5 py-5 dark:border-white/10"
                    >
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                        {card.value}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{card.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#15191f]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                    Health check
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Operating notes
                  </h2>
                </div>

                <div className="divide-y divide-black/8 border-t border-black/8 dark:divide-white/10 dark:border-white/10">
                  <div className="px-1 py-4">
                    <p className="font-semibold text-foreground">Cross-partnership overlaps</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dashboardConflictCounts.total > 0
                        ? `${dashboardConflictCounts.total} overlap warning${dashboardConflictCounts.total === 1 ? "" : "s"} across active workspaces.`
                        : "No overlap issues detected right now."}
                    </p>
                  </div>
                  <div className="px-1 py-4">
                    <p className="font-semibold text-foreground">Deliverable pressure</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dueSoonDeliverables.length} deliverable
                      {dueSoonDeliverables.length === 1 ? "" : "s"} due within the next 7 days.
                    </p>
                  </div>
                  <div className="px-1 py-4">
                    <p className="font-semibold text-foreground">Collections</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {overdueInvoices > 0
                        ? `${overdueInvoices} invoice${overdueInvoices === 1 ? "" : "s"} overdue and worth following up this week.`
                        : "No overdue invoices currently blocking cash flow."}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
