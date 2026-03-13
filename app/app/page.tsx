import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { listDealsForViewer } from "@/lib/deals";
import { getRepository } from "@/lib/repository";
import { cn, formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

function progressForStatus(status: string) {
  const progressMap = {
    contract_received: 18,
    negotiating: 42,
    signed: 58,
    deliverables_pending: 72,
    submitted: 84,
    awaiting_payment: 92,
    paid: 100,
    completed: 100,
  } as const;

  return progressMap[status as keyof typeof progressMap] ?? 18;
}

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
    return "bg-success/10 text-success hover:bg-success/15";
  }

  if (status === "contract_received" || status === "negotiating") {
    return "bg-warning/10 text-warning hover:bg-warning/15";
  }

  return "bg-secondary text-muted-foreground hover:bg-secondary";
}

export default async function WorkspaceDashboardPage() {
  const viewer = await requireViewer();
  const deals = await listDealsForViewer(viewer);

  const dealRows = await Promise.all(
    deals.map(async (deal) => {
      const aggregate = await getRepository().getDealAggregate(viewer.id, deal.id);

      return {
        ...deal,
        riskFlags: aggregate?.riskFlags ?? [],
        deliverables: aggregate?.terms?.deliverables ?? [],
        paymentAmount: aggregate?.terms?.paymentAmount ?? null,
        currency: aggregate?.terms?.currency ?? "USD",
        documents: aggregate?.documents ?? [],
        latestDocument: aggregate?.latestDocument ?? null,
      };
    }),
  );

  const allDeliverables = dealRows
    .flatMap((deal) =>
      deal.deliverables.map((deliverable) => ({
        ...deliverable,
        dealId: deal.id,
        campaignName: deal.campaignName,
        brandName: deal.brandName,
      })),
    )
    .sort((left, right) => {
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return left.dueDate.localeCompare(right.dueDate);
    });

  const activeDeals = dealRows.filter((deal) => deal.status !== "completed").length;
  const totalRevenue = dealRows.reduce(
    (sum, deal) => sum + (deal.paymentAmount ?? 0),
    0,
  );
  const pendingPaymentsAmount = dealRows
    .filter((deal) =>
      ["invoiced", "awaiting_payment", "late"].includes(deal.paymentStatus),
    )
    .reduce((sum, deal) => sum + (deal.paymentAmount ?? 0), 0);
  const riskAlertCount = dealRows.filter((deal) =>
    deal.riskFlags.some((flag) => flag.severity === "high"),
  ).length;
  const overdueInvoices = dealRows.filter((deal) => deal.paymentStatus === "late").length;
  const statusCounts = dealRows.reduce<Record<string, number>>((counts, deal) => {
    counts[deal.status] = (counts[deal.status] ?? 0) + 1;
    return counts;
  }, {});
  const mostCommonStage =
    Object.entries(statusCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "contract_received";

  const activeDealRows = dealRows.filter((deal) => deal.status !== "completed");
  const overdueDeliverables = allDeliverables.filter(
    (item) => item.dueDate && daysUntil(item.dueDate)! < 0,
  );
  const dueSoonDeliverables = allDeliverables.filter((item) => {
    const days = daysUntil(item.dueDate);
    return days !== null && days >= 0 && days <= 7;
  });
  const completedDeals = dealRows.filter(
    (deal) => deal.status === "completed" || deal.status === "paid",
  ).length;

  const actionItems = [
    dealRows.find((deal) => deal.paymentStatus === "late")
      ? {
          tone: "warning" as const,
          title: "Payment overdue",
          body: `${dealRows.find((deal) => deal.paymentStatus === "late")?.campaignName} needs a follow-up on an overdue invoice.`,
          cta: "Open deal",
          href: `/app/deals/${dealRows.find((deal) => deal.paymentStatus === "late")?.id}`,
        }
      : null,
    dealRows.find((deal) => deal.riskFlags.some((flag) => flag.severity === "high"))
      ? {
          tone: "accent" as const,
          title: "Review contract risks",
          body: `${dealRows.find((deal) => deal.riskFlags.some((flag) => flag.severity === "high"))?.campaignName} has high-priority watchouts before signature.`,
          cta: "Review terms",
          href: `/app/deals/${dealRows.find((deal) => deal.riskFlags.some((flag) => flag.severity === "high"))?.id}`,
        }
      : null,
    allDeliverables[0]
      ? {
          tone: "success" as const,
          title: "Upcoming deliverable",
          body: `${allDeliverables[0].title} for ${allDeliverables[0].campaignName} is due ${formatDate(allDeliverables[0].dueDate)}.`,
          cta: "View deliverables",
          href: `/app/deals/${allDeliverables[0].dealId}`,
        }
      : null,
  ].filter(Boolean) as Array<{
    tone: "accent" | "warning" | "success";
    title: string;
    body: string;
    cta: string;
    href: string;
  }>;

  const stats = [
    {
      label: "Active Deals",
      value: String(activeDeals),
      icon: FileText,
      note: `+${Math.max(activeDeals - completedDeals, 0)} this month`,
      noteClassName: "text-success",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      note: `${dealRows.length} tracked deal${dealRows.length === 1 ? "" : "s"}`,
      noteClassName: "text-success",
    },
    {
      label: "Pending Payments",
      value: formatCurrency(pendingPaymentsAmount),
      icon: Clock3,
      note:
        overdueInvoices > 0
          ? `${overdueInvoices} invoice${overdueInvoices === 1 ? "" : "s"} overdue`
          : "No overdue invoices",
      noteClassName: overdueInvoices > 0 ? "text-warning" : "text-muted-foreground",
    },
    {
      label: "Risk Alerts",
      value: String(riskAlertCount),
      icon: AlertTriangle,
      note: riskAlertCount > 0 ? "Review recommended" : "No urgent alerts",
      noteClassName: "text-muted-foreground",
    },
  ];

  if (dealRows.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="mb-3 text-2xl font-semibold">No contracts yet</h2>
          <p className="mb-8 text-muted-foreground">
            Upload your first brand deal to get started. HelloBrand will help you
            understand the terms and negotiate with confidence.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/app/intake/new"
              className={buttonVariants({ className: "gap-2" })}
            >
              <Plus className="h-4 w-4" />
              Start intake
            </Link>
            <Link
              href="/app/intake/new"
              className={buttonVariants({ variant: "outline", className: "gap-2" })}
            >
              Open intake form
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-3 text-[32px] font-semibold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="max-w-2xl text-[15px] text-muted-foreground">
              Welcome back, {viewer.displayName}. Here&apos;s what&apos;s happening
              with your deals.
            </p>
          </div>
          <Link href="/app/intake/new" className={buttonVariants({ className: "gap-2" })}>
            <Plus className="h-4 w-4" />
            New intake
          </Link>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-black/5 bg-white p-8 dark:border-white/10 dark:bg-white/[0.06]">
                <div className="mb-8 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[42px] font-semibold tracking-tight text-foreground">
                  {stat.value}
                </p>
                <p className={cn("mt-10 text-sm", stat.noteClassName)}>{stat.note}</p>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="overview" className="w-full gap-6">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="deals">Active Deals</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
                  Recent Deals
                </h2>
                <Link
                  href="/app/deals/history"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  View All
                </Link>
              </div>

              <div className="space-y-4">
                {dealRows.slice(0, 3).map((deal) => {
                  const progress = progressForStatus(deal.status);

                  return (
                    <Link key={deal.id} href={`/app/deals/${deal.id}`}>
                      <Card className="app-surface app-surface-hover border-black/5 bg-white p-8 dark:border-white/10 dark:bg-white/[0.06]">
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0 flex-1">
                            <div className="mb-4 flex flex-wrap items-center gap-3">
                              <h3 className="text-[22px] font-semibold tracking-tight text-foreground">
                                {deal.campaignName}
                              </h3>
                              <Badge className={statusBadgeClass(deal.status)}>
                                {humanizeToken(deal.status)}
                              </Badge>
                              {deal.riskFlags.length > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="border-accent/30 text-accent"
                                >
                                  {deal.riskFlags.length} Risk Flag
                                  {deal.riskFlags.length === 1 ? "" : "s"}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
                              <span>
                                Payment:{" "}
                                {formatCurrency(deal.paymentAmount, deal.currency)}
                              </span>
                              <span>Due: {formatDate(deal.nextDeliverableDate)}</span>
                              <span>
                                {deal.deliverables.length || deal.documents.length}{" "}
                                {deal.deliverables.length > 0 ? "deliverables" : "documents"}
                              </span>
                            </div>
                          </div>

                          {deal.status === "completed" || deal.status === "paid" ? (
                            <div className="pt-1">
                              <CheckCircle2 className="h-6 w-6 text-success" />
                            </div>
                          ) : (
                            <div className="min-w-[160px] text-right">
                              <p className="mb-2 text-sm font-medium text-muted-foreground">
                                {deal.status === "contract_received" ? "Status" : "Progress"}
                              </p>
                              {deal.status === "contract_received" ? (
                                <p className="text-sm text-foreground">Awaiting signature</p>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <Progress value={progress} className="w-24" />
                                  <span className="text-sm text-muted-foreground">
                                    {progress}%
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card className="border-black/5 bg-white p-8 dark:border-white/10 dark:bg-white/[0.06]">
                <h2 className="mb-6 text-[24px] font-semibold tracking-tight text-foreground">
                  Upcoming Deliverables
                </h2>
                <div className="space-y-5">
                  {allDeliverables.slice(0, 3).map((deliverable, index) => {
                    const tones = [
                      "bg-accent/10 text-accent",
                      "bg-primary/10 text-primary",
                      "bg-success/10 text-success",
                    ];

                    return (
                      <div key={deliverable.id} className="flex items-start gap-4">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            tones[index] ?? tones[0],
                          )}
                        >
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="mb-1 text-base font-medium text-foreground">
                            {deliverable.title}
                          </h4>
                          <p className="mb-2 text-sm text-muted-foreground">
                            {deliverable.campaignName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Due {formatDate(deliverable.dueDate)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {dueLabel(deliverable.dueDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="border-black/5 bg-white p-8 dark:border-white/10 dark:bg-white/[0.06]">
                <h2 className="mb-6 text-[24px] font-semibold tracking-tight text-foreground">
                  Action Items
                </h2>
                <div className="space-y-4">
                  {actionItems.map((item) => (
                    <div
                      key={item.title}
                      className={cn(
                        "rounded-[18px] border p-4",
                        item.tone === "accent" && "border-accent/20 bg-accent/5",
                        item.tone === "warning" && "border-warning/20 bg-warning/5",
                        item.tone === "success" && "border-success/20 bg-success/5",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {item.tone === "success" ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                        ) : (
                          <AlertTriangle
                            className={cn(
                              "mt-0.5 h-5 w-5 shrink-0",
                              item.tone === "accent" && "text-accent",
                              item.tone === "warning" && "text-warning",
                            )}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <h4
                            className={cn(
                              "mb-1 text-base font-medium",
                              item.tone === "accent" && "text-accent",
                              item.tone === "warning" && "text-warning",
                              item.tone === "success" && "text-success",
                            )}
                          >
                            {item.title}
                          </h4>
                          <p className="mb-3 text-sm text-muted-foreground">{item.body}</p>
                          <Link
                            href={item.href}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            {item.cta}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="deals" className="space-y-4">
            {activeDealRows.map((deal) => (
              <Link key={deal.id} href={`/app/deals/${deal.id}`}>
                <Card className="app-surface app-surface-hover border-black/5 bg-white p-8 dark:border-white/10 dark:bg-white/[0.06]">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h3 className="text-[22px] font-semibold tracking-tight text-foreground">
                          {deal.campaignName}
                        </h3>
                        <Badge className={statusBadgeClass(deal.status)}>
                          {humanizeToken(deal.status)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
                        <span>
                          Payment: {formatCurrency(deal.paymentAmount, deal.currency)}
                        </span>
                        <span>
                          {deal.riskFlags.length} risk flag
                          {deal.riskFlags.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          {deal.deliverables.length} deliverable
                          {deal.deliverables.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-[180px]">
                      <Progress value={progressForStatus(deal.status)} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="deliverables" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="border-black/5 bg-white p-6 dark:border-white/10 dark:bg-white/[0.06]">
                <h3 className="mb-4 text-xl font-semibold">Overdue</h3>
                <div className="space-y-3">
                  {overdueDeliverables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No overdue deliverables.</p>
                  ) : (
                    overdueDeliverables.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-[18px] bg-accent/5 p-4">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.campaignName}</p>
                        <p className="mt-2 text-xs text-accent">{dueLabel(item.dueDate)}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <Card className="border-black/5 bg-white p-6 dark:border-white/10 dark:bg-white/[0.06]">
                <h3 className="mb-4 text-xl font-semibold">Due This Week</h3>
                <div className="space-y-3">
                  {dueSoonDeliverables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing due this week.</p>
                  ) : (
                    dueSoonDeliverables.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-[18px] bg-primary/5 p-4">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.campaignName}</p>
                        <p className="mt-2 text-xs text-primary">{dueLabel(item.dueDate)}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <Card className="border-black/5 bg-white p-6 dark:border-white/10 dark:bg-white/[0.06]">
                <h3 className="mb-4 text-xl font-semibold">Recently Completed</h3>
                <div className="space-y-3">
                  {dealRows
                    .filter((deal) => deal.status === "completed" || deal.status === "paid")
                    .slice(0, 4)
                    .map((deal) => (
                      <div key={deal.id} className="rounded-[18px] bg-success/5 p-4">
                        <p className="font-medium text-foreground">{deal.campaignName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{deal.brandName}</p>
                        <p className="mt-2 text-xs text-success">
                          {humanizeToken(deal.status)}
                        </p>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Tracked Revenue",
                  value: formatCurrency(totalRevenue),
                  icon: DollarSign,
                },
                {
                  label: "Average Deal Size",
                  value: formatCurrency(
                    dealRows.length > 0 ? Math.round(totalRevenue / dealRows.length) : 0,
                  ),
                  icon: BarChart3,
                },
                {
                  label: "Deliverables Due",
                  value: String(dueSoonDeliverables.length),
                  icon: Clock3,
                },
                {
                  label: "High Risk Deals",
                  value: String(riskAlertCount),
                  icon: AlertTriangle,
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <Card
                    key={card.label}
                    className="border-black/5 bg-white p-6 dark:border-white/10 dark:bg-white/[0.06]"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                  </Card>
                );
              })}
            </div>

            <Card className="border-black/5 bg-white p-8 dark:border-white/10 dark:bg-white/[0.06]">
              <h3 className="mb-4 text-xl font-semibold">Creator Snapshot</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[18px] bg-secondary p-5 dark:bg-white/[0.04]">
                  <p className="text-sm text-muted-foreground">Most common stage</p>
                  <p className="mt-3 text-xl font-semibold text-foreground">
                    {humanizeToken(mostCommonStage)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-secondary p-5 dark:bg-white/[0.04]">
                  <p className="text-sm text-muted-foreground">Contracts uploaded</p>
                  <p className="mt-3 text-xl font-semibold text-foreground">
                    {dealRows.reduce((sum, deal) => sum + deal.documents.length, 0)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-secondary p-5 dark:bg-white/[0.04]">
                  <p className="text-sm text-muted-foreground">Signed or completed</p>
                  <p className="mt-3 text-xl font-semibold text-foreground">
                    {
                      dealRows.filter((deal) =>
                        ["signed", "paid", "completed"].includes(deal.status),
                      ).length
                    }
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
