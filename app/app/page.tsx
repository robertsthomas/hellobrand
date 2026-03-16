import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileClock,
  FileText,
  FolderSearch,
  Plus,
  Receipt,
  Trash2
} from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { ConflictWarnings } from "@/components/conflict-warnings";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { DisclosureObligations } from "@/components/disclosure-obligations";
import { EmptyDashboardUpload } from "@/components/empty-dashboard-upload";
import { RecentDealCardMenu } from "@/components/recent-deal-card-menu";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { countConflictSeverity } from "@/lib/conflict-intelligence";
import { listDealAggregatesForViewer } from "@/lib/deals";
import { listIntakeDraftsForViewer } from "@/lib/intake";
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
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  }

  if (status === "contract_received" || status === "negotiating") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] hover:bg-[#f5f6f8]";
}

function paymentBadgeClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "late") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "awaiting_payment" || status === "invoiced") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085]";
}

export default async function WorkspaceDashboardPage() {
  const viewer = await requireViewer();
  const aggregates = await listDealAggregatesForViewer(viewer);
  const intakeDrafts = await listIntakeDraftsForViewer(viewer);

  const dealRows = aggregates.map((aggregate) => ({
    ...aggregate.deal,
    riskFlags: aggregate.riskFlags,
    deliverables: aggregate.terms?.deliverables ?? [],
    paymentAmount: aggregate.terms?.paymentAmount ?? null,
    currency: aggregate.terms?.currency ?? "USD",
    documents: aggregate.documents,
    latestDocument: aggregate.latestDocument,
    conflictResults: aggregate.conflictResults,
    disclosureObligations: aggregate.terms?.disclosureObligations ?? []
  }));

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

  const metrics = [
    {
      label: "Active deals",
      value: String(activeDeals),
      note: `${completedDeals} completed`,
      icon: FileText
    },
    {
      label: "Tracked revenue",
      value: formatCurrency(totalRevenue),
      note: `${dealRows.length} total workspaces`,
      icon: DollarSign
    },
    {
      label: "Outstanding",
      value: formatCurrency(pendingPaymentsAmount),
      note:
        overdueInvoices > 0
          ? `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"}`
          : "Nothing overdue",
      icon: Receipt
    },
    {
      label: "Risk alerts",
      value: String(riskAlertCount),
      note:
        dashboardConflictCounts.total > 0
          ? `${dashboardConflictCounts.total} cross-deal warning${dashboardConflictCounts.total === 1 ? "" : "s"}`
          : "No active overlaps",
      icon: AlertTriangle
    }
  ];

  if (dealRows.length === 0) {
    return (
      <div className="px-5 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1200px] space-y-8">
          <section className="rounded-[28px] border border-black/8 bg-white px-8 py-10 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
                Documents
              </p>
              <h1 className="text-[48px] font-semibold tracking-[-0.06em] text-foreground">
                New workspace
              </h1>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                Upload a contract, paste an email thread, or do both. HelloBrand
                analyzes the source material first, then lets you confirm the deal
                details before the workspace goes live.
              </p>
            </div>

            <div className="mt-14 flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-[#fafbfc] px-8">
              <div className="max-w-xl text-center">
                <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#f4f6f8]">
                  <FolderSearch className="h-10 w-10 text-[#667085]" />
                </div>
                <h2 className="text-[40px] font-semibold tracking-[-0.06em] text-foreground">
                  Start your first workspace
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-lg leading-8 text-muted-foreground">
                  Upload your first deal document or paste text to create a new
                  workspace.
                </p>
                <div className="mt-8">
                  <EmptyDashboardUpload />
                </div>
              </div>
            </div>
          </section>

          {intakeDrafts.length > 0 ? (
            <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                    Drafts
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Continue recent intake sessions
                  </h2>
                </div>
              </div>

              <div className="space-y-3">
                {intakeDrafts.slice(0, 3).map(({ session, deal }) => (
                  <Card key={session.id} className="gap-0 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={
                          session.status === "draft"
                            ? `/app/intake/new?draft=${session.id}`
                            : `/app/intake/${session.id}`
                        }
                        className="min-w-0 flex-1"
                      >
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
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
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/8 text-[#667085] transition hover:border-accent/30 hover:text-accent"
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
        <section className="rounded-[28px] border border-black/8 bg-white px-7 py-7 shadow-[0_20px_50px_rgba(15,23,42,0.05)] lg:px-8">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
                Deal workspace
              </p>
              <h1 className="mt-3 text-[44px] font-semibold tracking-[-0.07em] text-foreground lg:text-[56px]">
                Your brand deal command center
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                Keep intake drafts, active agreements, payment follow-up, and
                deliverable timing in one clean operating layer.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/app/deals/history"
                className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl px-4")}
              >
                Open deal library
              </Link>
              <Link
                href="/app/intake/new"
                className={cn(buttonVariants(), "rounded-2xl px-5")}
                aria-label="Create a new workspace"
                title="Start a new deal workspace"
              >
                <Plus className="h-4 w-4" />
                New workspace
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.label}
                  className="rounded-[22px] border border-black/7 bg-[#fbfbfc] px-5 py-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <Icon className="h-4.5 w-4.5 text-[#98a2b3]" />
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

            <div className="hidden items-center gap-3 rounded-[18px] border border-black/8 bg-white px-4 py-3 text-sm text-muted-foreground lg:flex">
              <Clock3 className="h-4 w-4 text-[#98a2b3]" />
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
                <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
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

                  <div className="overflow-hidden rounded-[22px] border border-black/8">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_140px_150px_140px_60px] border-b border-black/8 bg-[#f7f8fa] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                      <span>Deal</span>
                      <span>Stage</span>
                      <span>Payment</span>
                      <span>Next due</span>
                      <span />
                    </div>

                    {dealRows.slice(0, 6).map((deal) => (
                      <div
                        key={deal.id}
                        className="grid grid-cols-[minmax(0,1.6fr)_140px_150px_140px_60px] items-center border-b border-black/6 px-5 py-4 last:border-b-0"
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
                  <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                          Deliverables
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                          Upcoming this week
                        </h2>
                      </div>
                      <Clock3 className="h-5 w-5 text-[#98a2b3]" />
                    </div>

                    <div className="space-y-4">
                      {dueSoonDeliverables.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-black/10 bg-[#fafbfc] px-5 py-6 text-sm text-muted-foreground">
                          No upcoming deliverables this week.
                        </div>
                      ) : (
                        dueSoonDeliverables.slice(0, 4).map((item) => (
                          <Link
                            key={`${item.dealId}:${item.id}`}
                            href={`/app/deals/${item.dealId}`}
                            className="flex items-start justify-between gap-4 rounded-[20px] border border-black/8 bg-[#fbfbfc] px-4 py-4"
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

                  <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                          Payments
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                          Outstanding payouts
                        </h2>
                      </div>
                      <Receipt className="h-5 w-5 text-[#98a2b3]" />
                    </div>

                    <div className="space-y-4">
                      {dealRows
                        .filter((deal) =>
                          ["invoiced", "awaiting_payment", "late"].includes(deal.paymentStatus)
                        )
                        .slice(0, 4)
                        .map((deal) => (
                          <Link
                            key={deal.id}
                            href={`/app/deals/${deal.id}`}
                            className="flex items-start justify-between gap-4 rounded-[20px] border border-black/8 bg-[#fbfbfc] px-4 py-4"
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
                        <div className="rounded-[20px] border border-dashed border-black/10 bg-[#fafbfc] px-5 py-6 text-sm text-muted-foreground">
                          No outstanding payouts right now.
                        </div>
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
                <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                    Action center
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    What needs attention
                  </h2>

                  <div className="mt-6 space-y-4">
                    {actionItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        className={cn(
                          "block rounded-[22px] border px-5 py-5",
                          item.tone === "accent" && "border-accent/25 bg-accent/5",
                          item.tone === "warning" && "border-orange-200 bg-orange-50",
                          item.tone === "success" && "border-emerald-200 bg-emerald-50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                              item.tone === "accent" && "bg-accent/10 text-accent",
                              item.tone === "warning" && "bg-orange-100 text-orange-700",
                              item.tone === "success" && "bg-emerald-100 text-emerald-700"
                            )}
                          >
                            {item.tone === "success" ? (
                              <CheckCircle2 className="h-4.5 w-4.5" />
                            ) : (
                              <AlertTriangle className="h-4.5 w-4.5" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{item.title}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {item.body}
                            </p>
                            <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                              Open workspace
                              <ArrowUpRight className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}

                    {actionItems.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-black/10 bg-[#fafbfc] px-5 py-6 text-sm text-muted-foreground">
                        Nothing urgent right now.
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                    Intake drafts
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    In-progress setups
                  </h2>

                  <div className="mt-6 space-y-4">
                    {intakeDrafts.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-black/10 bg-[#fafbfc] px-5 py-6 text-sm text-muted-foreground">
                        No draft intakes waiting.
                      </div>
                    ) : (
                      intakeDrafts.slice(0, 4).map(({ session, deal }) => (
                        <Card key={session.id} className="gap-0 bg-[#fbfbfc] p-4 shadow-none">
                          <div className="flex items-start justify-between gap-3">
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
                              <p className="mt-3 text-xs text-[#98a2b3]">
                                Updated {formatDate(session.updatedAt)}
                              </p>
                            </Link>
                            <Badge className={statusBadgeClass(session.status)}>
                              {humanizeToken(session.status)}
                            </Badge>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deals" className="mt-6">
            <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                    Library
                  </p>
                  <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                    Active workspaces
                  </h2>
                </div>
                <Link href="/app/deals/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Manage all deals
                </Link>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-black/8">
                <div className="grid grid-cols-[minmax(0,1.5fr)_150px_160px_160px_140px] border-b border-black/8 bg-[#f7f8fa] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  <span>Campaign</span>
                  <span>Stage</span>
                  <span>Payment status</span>
                  <span>Amount</span>
                  <span>Next due</span>
                </div>

                {dealRows.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/app/deals/${deal.id}`}
                    className="grid grid-cols-[minmax(0,1.5fr)_150px_160px_160px_140px] items-center border-b border-black/6 px-5 py-4 last:border-b-0 hover:bg-[#fafbfc]"
                  >
                    <div className="min-w-0 pr-4">
                      <p className="truncate text-base font-semibold text-foreground">
                        {deal.campaignName}
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {deal.brandName}
                      </p>
                    </div>
                    <div>
                      <Badge className={statusBadgeClass(deal.status)}>
                        {humanizeToken(deal.status)}
                      </Badge>
                    </div>
                    <div>
                      <Badge className={paymentBadgeClass(deal.paymentStatus)}>
                        {humanizeToken(deal.paymentStatus)}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(deal.paymentAmount, deal.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(deal.nextDeliverableDate)}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="deliverables" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-3">
              <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Overdue
                  </h2>
                  <FileClock className="h-5 w-5 text-[#98a2b3]" />
                </div>
                <div className="space-y-3">
                  {overdueDeliverables.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-black/10 bg-[#fafbfc] px-5 py-6 text-sm text-muted-foreground">
                      No overdue deliverables.
                    </div>
                  ) : (
                    overdueDeliverables.slice(0, 5).map((item) => (
                      <Link
                        key={`${item.dealId}:${item.id}:late`}
                        href={`/app/deals/${item.dealId}`}
                        className="block rounded-[20px] border border-red-200 bg-red-50 px-4 py-4"
                      >
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.campaignName}</p>
                        <p className="mt-2 text-xs font-medium text-red-700">{dueLabel(item.dueDate)}</p>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Due this week
                  </h2>
                  <Clock3 className="h-5 w-5 text-[#98a2b3]" />
                </div>
                <div className="space-y-3">
                  {dueSoonDeliverables.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-black/10 bg-[#fafbfc] px-5 py-6 text-sm text-muted-foreground">
                      Nothing due this week.
                    </div>
                  ) : (
                    dueSoonDeliverables.slice(0, 5).map((item) => (
                      <Link
                        key={`${item.dealId}:${item.id}:soon`}
                        href={`/app/deals/${item.dealId}`}
                        className="block rounded-[20px] border border-black/8 bg-[#fbfbfc] px-4 py-4"
                      >
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.campaignName}</p>
                        <p className="mt-2 text-xs font-medium text-foreground">{formatDate(item.dueDate)}</p>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Recently wrapped
                  </h2>
                  <CheckCircle2 className="h-5 w-5 text-[#98a2b3]" />
                </div>
                <div className="space-y-3">
                  {dealRows
                    .filter((deal) => deal.status === "completed" || deal.status === "paid")
                    .slice(0, 5)
                    .map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/app/deals/${deal.id}`}
                        className="block rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4"
                      >
                        <p className="font-semibold text-foreground">{deal.campaignName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{deal.brandName}</p>
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          {humanizeToken(deal.status)}
                        </p>
                      </Link>
                    ))}
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_400px]">
              <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
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
                      className="rounded-[22px] border border-black/8 bg-[#fbfbfc] px-5 py-5"
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

              <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                    Health check
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Operating notes
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[20px] border border-black/8 bg-[#fbfbfc] px-4 py-4">
                    <p className="font-semibold text-foreground">Cross-deal overlaps</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dashboardConflictCounts.total > 0
                        ? `${dashboardConflictCounts.total} overlap warning${dashboardConflictCounts.total === 1 ? "" : "s"} across active workspaces.`
                        : "No overlap issues detected right now."}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-black/8 bg-[#fbfbfc] px-4 py-4">
                    <p className="font-semibold text-foreground">Deliverable pressure</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dueSoonDeliverables.length} deliverable
                      {dueSoonDeliverables.length === 1 ? "" : "s"} due within the next 7 days.
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-black/8 bg-[#fbfbfc] px-4 py-4">
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
