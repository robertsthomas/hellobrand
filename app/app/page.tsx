/**
 * This file renders the signed-in dashboard landing page.
 * It pulls together the main workspace overview while shared calculations and data rules stay outside the route.
 */

import { ArrowRight, Clock3, DollarSign, Receipt } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  ConflictWarnings,
  DashboardGreeting,
  DashboardSkeleton,
  DisclosureObligations,
  QuickActionsPanel,
  RecentDealCardMenu,
} from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth";
import { getCachedDealAggregates, getCachedIntakeDrafts } from "@/lib/cached-data";
import { cn, formatCurrency, formatDate, humanizeToken } from "@/lib/utils";
import {
  buildDashboardViewModel,
  buildDealNextStep,
  dueLabel,
  nextStepTextClass,
  paymentBadgeClass,
} from "./page-helpers";

export default function WorkspaceDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const t = await getTranslations("appDashboard");
  const viewer = await requireViewer();
  const [aggregates, intakeDrafts] = await Promise.all([
    getCachedDealAggregates(viewer),
    getCachedIntakeDrafts(viewer),
  ]);
  const {
    activePartnershipItems,
    attentionItems,
    dashboardConflicts,
    firstName,
    hasDueSoon,
    hasPendingPayouts,
    secondarySections,
    todaySummary,
  } = buildDashboardViewModel({
    aggregates,
    intakeDrafts,
    viewer,
    t,
  });

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
        <section
          data-guide="active-partnerships"
          className="border border-black/8 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#15191f] dark:shadow-none sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[22px] font-semibold tracking-[-0.05em] text-foreground sm:text-[28px]">
              {t("sections.activePartnerships.title")}
            </h2>

            <Link
              href="/app/p/history"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("sections.activePartnerships.viewAll")}
            </Link>
          </div>

          {activePartnershipItems.length === 0 ? (
            <div className="mt-6 border border-dashed border-black/10 bg-[#fafafb] p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-base font-semibold text-foreground">
                {t("sections.activePartnerships.emptyTitle")}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("sections.activePartnerships.emptyBody")}
              </p>
              <div className="mt-5">
                <Link
                  href="/app/intake/new"
                  data-guide="add-documents"
                  className={cn(buttonVariants({ size: "sm" }), "gap-2")}
                >
                  {t("sections.activePartnerships.newWorkspace")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden border border-black/8 dark:border-white/10">
              {/* Column headers (desktop only) */}
              <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_120px_140px_130px_minmax(0,1fr)_40px] border-b border-black/8 bg-secondary px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:border-white/10 dark:bg-secondary dark:text-muted-foreground">
                <span>{t("columns.campaign")}</span>
                <span>{t("columns.stage")}</span>
                <span>{t("columns.amount")}</span>
                <span>{t("columns.due")}</span>
                <span>{t("columns.nextStep")}</span>
                <span />
              </div>

              {activePartnershipItems.slice(0, 5).map((deal) => {
                const nextStep = buildDealNextStep(deal, t);

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
                      <span className="text-xs text-muted-foreground md:hidden">
                        {t("columns.stage")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {humanizeToken(deal.status)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs text-muted-foreground md:hidden">
                        {t("columns.amount")}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(deal.paymentAmount, deal.currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs text-muted-foreground md:hidden">{t("columns.due")}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(deal.nextDeliverableDate)}
                      </span>
                    </div>

                    <Link
                      href={`/app/p/${deal.id}`}
                      className="flex items-center justify-between gap-2 md:justify-start"
                    >
                      <span className="text-xs text-muted-foreground md:hidden">
                        {t("columns.nextStep")}
                      </span>
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
            title={t("conflicts.title")}
            description={t("conflicts.description")}
          />
        ) : null}

        {/* Secondary strip: deliverables, payments, snapshot */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
          {/* Deliverables */}
          {hasDueSoon ? (
            <section className="border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#15191f] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground">
                    {t("sections.deliverables.eyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    {t("sections.deliverables.title")}
                  </h2>
                </div>
                <Clock3 className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
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
                      <span className="font-medium text-foreground">
                        {formatDate(item.dueDate)}
                      </span>
                      <span className="text-muted-foreground">{dueLabel(item.dueDate, t)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <div className="flex items-start gap-3 border border-black/8 bg-white px-5 py-5 dark:border-white/10 dark:bg-[#15191f]">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground dark:text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t("sections.deliverables.eyebrow")}
                </span>{" "}
                · {t("sections.deliverables.empty")}
              </p>
            </div>
          )}

          {/* Payments */}
          {hasPendingPayouts ? (
            <section className="border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#15191f] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground">
                    {t("sections.payments.eyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    {t("sections.payments.title")}
                  </h2>
                </div>
                <Receipt className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
              </div>

              <div className="mt-6 space-y-3">
                {secondarySections.pendingPayoutDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/app/p/${deal.id}`}
                    className="block border border-black/8 bg-card p-4 transition-colors hover:bg-secondary dark:border-white/10 dark:bg-card dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {deal.campaignName}
                        </p>
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
              <Receipt className="h-4 w-4 shrink-0 text-muted-foreground dark:text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t("sections.payments.eyebrow")}</span>{" "}
                · {t("sections.payments.empty")}
              </p>
            </div>
          )}

          {/* Portfolio snapshot */}
          <section className="border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#15191f] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground">
                  {t("sections.snapshot.eyebrow")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  {t("sections.snapshot.title")}
                </h2>
              </div>
              <DollarSign className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
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
            title={t("sections.disclosure.title")}
          />
        ) : null}
      </div>
    </div>
  );
}
