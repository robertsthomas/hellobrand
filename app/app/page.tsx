import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileClock,
  FileText,
  Receipt,
  Info,
  Trash2
} from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { AppTooltip, InfoTooltip } from "@/components/app-tooltip";
import { ConflictWarnings } from "@/components/conflict-warnings";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { DashboardDealsTable } from "@/components/dashboard-deals-table";
import { DisclosureObligations } from "@/components/disclosure-obligations";
import { EmptyDashboardUpload } from "@/components/empty-dashboard-upload";
import { QuickActionsPanel } from "@/components/quick-actions-panel";
import { RecentDealCardMenu } from "@/components/recent-deal-card-menu";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { countConflictSeverity } from "@/lib/conflict-intelligence";
import { listDealAggregatesForViewer } from "@/lib/deals";
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

export default async function WorkspaceDashboardPage() {
  const viewer = await requireViewer();
  const aggregates = await listDealAggregatesForViewer(viewer);
  const intakeDrafts = await listIntakeDraftsForViewer(viewer);
  const queuedIntakeWorkspaces = intakeDrafts.filter(
    ({ session }) => session.status === "queued"
  );
  const resumableDrafts = intakeDrafts.filter(
    ({ session }) => session.status !== "queued"
  );

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

  const activeDeals = dealRows.filter((deal) => deal.status !== "completed").length;
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
  const completedDeals = dealRows.filter(
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

  const actionItems = [
    dealRows.find((deal) => deal.paymentStatus === "late")
      ? {
          tone: "warning" as const,
          title: "Payment follow-up",
          body: `${dealRows.find((deal) => deal.paymentStatus === "late")?.campaignName} has an overdue invoice that needs a check-in.`,
          href: `/app/deals/${dealRows.find((deal) => deal.paymentStatus === "late")?.id}`
        }
      : null,
    dealRows.find((deal) => deal.riskFlags.some((flag) => flag.severity === "high"))
      ? {
          tone: "accent" as const,
          title: "Review contract watchouts",
          body: `${dealRows.find((deal) => deal.riskFlags.some((flag) => flag.severity === "high"))?.campaignName} still has high-severity items before signature.`,
          href: `/app/deals/${dealRows.find((deal) => deal.riskFlags.some((flag) => flag.severity === "high"))?.id}`
        }
      : null,
    allDeliverables[0]
      ? {
          tone: "success" as const,
          title: "Upcoming deliverable",
          body: `${allDeliverables[0].title} for ${allDeliverables[0].campaignName} is due ${formatDate(allDeliverables[0].dueDate)}.`,
          href: `/app/deals/${allDeliverables[0].dealId}`
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
      label: "Active deals",
      value: String(activeDeals),
      note: `${completedDeals} completed`,
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
      help: "Payments still waiting to be received, including invoiced and overdue brand deals."
    },
    {
      label: "Risk alerts",
      value: String(riskAlertCount),
      note:
        dashboardConflictCounts.total > 0
          ? `${dashboardConflictCounts.total} cross-deal warning${dashboardConflictCounts.total === 1 ? "" : "s"}`
          : "No active overlaps",
      icon: AlertTriangle,
      help: "Workspaces with high-severity contract risks or cross-deal conflicts that need attention."
    }
  ];

  if (dealRows.length === 0) {
    return (
      <div className="px-5 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[980px] space-y-10">
          <section className="max-w-3xl border-t border-black/8 pt-6 dark:border-white/10">
            <div className="max-w-2xl">
              <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-foreground">
                New workspace
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted-foreground">
                Add documents or pasted text for one workspace at a time. Nothing
                is saved to intake drafts here until you start analysis.
              </p>
            </div>

            <div className="mt-6 max-w-3xl">
              <EmptyDashboardUpload
                initialQueuedWorkspaces={queuedIntakeWorkspaces}
              />
            </div>
          </section>

          {resumableDrafts.length > 0 ? (
            <section className="max-w-3xl border-t border-black/8 pt-6 dark:border-white/10">
              <div className="mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                    Existing drafts
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
                    Continue saved intake sessions
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    These are older server-side intake sessions. They are separate
                    from the local workspaces you stage above.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {resumableDrafts.slice(0, 3).map(({ session, deal }) => (
                  <Card key={session.id} className="gap-0 rounded-none border-black/8 p-5 shadow-none dark:border-white/10">
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={
                          session.status === "draft"
                            ? `/app/intake/new?draft=${session.id}`
                            : `/app/intake/${session.id}`
                        }
                        className="min-w-0 flex-1"
                      >
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                          {deal.brandName}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
                          {deal.campaignName}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Last updated {formatDate(session.updatedAt)}
                        </p>
                      </Link>
                      <div className="flex items-center gap-3">
                        <Badge className={statusBadgeClass(session.status)}>
                          {humanizeToken(session.status)}
                        </Badge>
                        <form action={deleteIntakeDraftAction}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <DeleteDraftButton
                            className="inline-flex h-10 w-10 items-center justify-center border border-black/8 text-[#667085] transition hover:border-accent/30 hover:text-accent dark:border-white/10 dark:text-[#a3acb9]"
                            aria-label={`Delete draft ${deal.campaignName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </DeleteDraftButton>
                        </form>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <section className="rounded-[28px] border border-black/8 bg-white px-7 py-7 shadow-[0_20px_50px_rgba(15,23,42,0.05)] lg:px-8 dark:border-white/10 dark:bg-[#15191f] dark:shadow-none">
          <div>
            <DashboardGreeting firstName={firstName} />
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.label}
                  className="rounded-[22px] border border-black/7 bg-[#fbfbfc] px-5 py-5 dark:border-white/10 dark:bg-[#10141a]"
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
                  <p className="mt-5 text-[34px] font-semibold tracking-[-0.06em] text-foreground">
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
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <div className="hidden items-center gap-3 rounded-[18px] border border-black/8 bg-white px-4 py-3 text-sm text-muted-foreground lg:flex dark:border-white/10 dark:bg-[#15191f]">
              <Clock3 className="h-4 w-4 text-[#98a2b3] dark:text-[#8f98a6]" />
              <span>{dueSoonDeliverables.length} due this week</span>
            </div>
          </div>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {dashboardConflicts.length > 0 ? (
              <ConflictWarnings
                conflicts={dashboardConflicts}
                compact
                title="Cross-deal conflicts"
                description="HelloBrand found overlapping category, exclusivity, or timing signals across active workspaces."
              />
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
              <div className="space-y-6">
                <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#15191f] dark:shadow-none">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                        Recent workspaces
                      </p>
                      <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                        Active deal flow
                      </h2>
                    </div>
                    <Link
                      href="/app/deals/history"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-2xl")}
                    >
                      View all
                    </Link>
                  </div>

                  <div className="border-t border-black/8 dark:border-white/10">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_140px_150px_140px_60px] border-b border-black/8 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3] dark:border-white/10 dark:text-[#8f98a6]">
                      <span>Deal</span>
                      <span>Stage</span>
                      <span>Payment</span>
                      <span>Next due</span>
                      <span />
                    </div>

                    {dealRows.slice(0, 6).map((deal) => (
                      <div
                        key={deal.id}
                        className="grid grid-cols-[minmax(0,1.6fr)_140px_150px_140px_60px] items-center border-b border-black/6 px-5 py-4 transition-colors hover:bg-[#f6f7f8] dark:border-white/8 dark:hover:bg-white/[0.04]"
                      >
                        <Link href={`/app/deals/${deal.id}`} className="min-w-0 pr-4">
                          <p className="truncate text-base font-semibold text-foreground">
                            {deal.campaignName}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {deal.brandName}
                          </p>
                        </Link>
                        <div>
                          <Badge className={statusBadgeClass(deal.status)}>
                            {humanizeToken(deal.status)}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(deal.paymentAmount, deal.currency)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(deal.nextDeliverableDate)}
                        </div>
                        <div className="flex justify-end">
                          <RecentDealCardMenu dealId={deal.id} dealName={deal.campaignName} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#15191f]">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                          Deliverables
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
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

                  <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#15191f]">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
                          Payments
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
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
                    title="Disclosure reminders across active deals"
                  />
                ) : null}
              </div>

              <div className="space-y-6">
                <QuickActionsPanel items={actionItems} />

              <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#15191f]">
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
                    Workspace performance
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
                      label: "Average deal size",
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
                    <p className="font-semibold text-foreground">Cross-deal overlaps</p>
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
