import type { ReactNode } from "react";
import { BillingInterval, PlanTier } from "@prisma/client";
import { Check } from "lucide-react";

import {
  cancelSubscriptionAction,
  openBillingPortalAction,
  startCheckoutAction,
} from "@/app/actions";
import { InfoTooltip } from "@/components/app-tooltip";
import { BillingUpgradePanel } from "@/components/billing-upgrade-panel";
import { PostHogSubmitButton } from "@/components/posthog-submit-button";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getBillingOverviewForViewer } from "@/lib/billing/service";
import { formatDate, humanizeToken } from "@/lib/utils";
import {
  billingIntro,
  buildBillingPageViewModel,
  moneyOrLabel,
  statusBadgeLabel,
  statusTone,
  trialCountdownLabel,
} from "./page-helpers";

function StatusBanner({
  tone,
  children,
}: {
  tone: "critical" | "neutral" | "notice" | "success" | "warning";
  children: ReactNode;
}) {
  const toneClassName = {
    critical: "border-destructive/25 bg-destructive/8 text-destructive",
    neutral: "border-border bg-secondary text-muted-foreground",
    notice: "border-ocean/25 bg-ocean/8 text-ocean",
    success: "border-success/25 bg-success/8 text-success",
    warning: "border-accent/25 bg-accent/8 text-accent-foreground dark:text-accent",
  }[tone];

  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      aria-live="polite"
      className={`border px-4 py-3 text-sm ${toneClassName}`}
    >
      {children}
    </div>
  );
}

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing_error?: string; billing_notice?: string; checkout?: string }>;
}) {
  const viewer = await requireViewer();
  const [overview, entitlements] = await Promise.all([
    getBillingOverviewForViewer(viewer),
    getViewerEntitlements(viewer),
  ]);
  const { billingError, billingNotice, checkoutState, usageCards } = buildBillingPageViewModel({
    searchParams: searchParams ? await searchParams : undefined,
  });

  return (
    <div className="space-y-6">
      {/* Status banners */}
      {billingError && <StatusBanner tone="critical">{billingError}</StatusBanner>}
      {checkoutState === "success" && (
        <StatusBanner tone="success">
          Checkout complete. Your plan details should update momentarily.
        </StatusBanner>
      )}
      {checkoutState === "canceled" && (
        <StatusBanner tone="neutral">Checkout was canceled.</StatusBanner>
      )}
      {billingNotice && <StatusBanner tone="notice">{billingNotice}</StatusBanner>}
      {!overview.stripeConfigured && (
        <StatusBanner tone="warning">
          Billing setup is still being finished. Add your Stripe secret, webhook secret, and plan
          price IDs before testing paid flows.
        </StatusBanner>
      )}

      {/* Current plan + usage */}
      <section className="border border-black/[0.06] bg-white shadow-panel">
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                  {humanizeToken(entitlements.effectiveTier)} plan
                </h2>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] ${statusTone(
                    overview.currentSubscriptionStatus
                  )}`}
                >
                  {statusBadgeLabel({
                    currentSubscriptionStatus: overview.currentSubscriptionStatus,
                    currentTrialEndsAt: overview.currentTrialEndsAt,
                    currentPlanTier: overview.currentPlanTier,
                  })}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {billingIntro({
                  currentPlanTier: overview.currentPlanTier,
                  currentSubscriptionStatus: overview.currentSubscriptionStatus,
                })}
              </p>
            </div>

            {overview.hasActiveSubscription && (
              <div className="flex items-center gap-2">
                <form action={openBillingPortalAction}>
                  <PostHogSubmitButton
                    eventName="billing_portal_clicked"
                    payload={{ source: "billing_overview" }}
                    pendingLabel="Opening…"
                    className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[#f7f5f1]"
                  >
                    Manage in Stripe
                  </PostHogSubmitButton>
                </form>
                {!overview.cancelAtPeriodEnd && (
                  <form action={cancelSubscriptionAction}>
                    <PostHogSubmitButton
                      eventName="billing_cancel_clicked"
                      payload={{ source: "billing_overview" }}
                      pendingLabel="Canceling…"
                      className="inline-flex items-center justify-center rounded-lg border border-destructive/25 bg-white px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
                    >
                      Cancel plan
                    </PostHogSubmitButton>
                  </form>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-black/[0.06] pt-5 text-sm lg:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Billing</span>
              <p className="mt-0.5 font-medium text-foreground">
                {overview.currentPlanInterval
                  ? humanizeToken(overview.currentPlanInterval)
                  : "Monthly"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Trial</span>
                <InfoTooltip
                  label="Trial policy"
                  content="Basic and Standard include 14-day trials. Premium includes a 7-day trial."
                  className="h-4 w-4"
                />
              </div>
              <p className="mt-0.5 font-medium text-foreground">
                {overview.currentTrialPlanTier
                  ? `${trialCountdownLabel(overview.currentTrialEndsAt) ?? "Active"} · ends ${formatDate(overview.currentTrialEndsAt)}`
                  : "Not trialing"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Renewal</span>
              <p className="mt-0.5 font-medium text-foreground">
                {overview.currentPeriodEnd
                  ? overview.cancelAtPeriodEnd
                    ? `Ends ${formatDate(overview.currentPeriodEnd)}`
                    : `Renews ${formatDate(overview.currentPeriodEnd)}`
                  : "None scheduled"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="mt-0.5 font-medium text-foreground">
                {overview.cancelAtPeriodEnd
                  ? "Ends at period end"
                  : overview.currentSubscriptionStatus
                    ? humanizeToken(overview.currentSubscriptionStatus)
                    : "No active plan"}
              </p>
            </div>
          </div>
        </div>

        {/* Usage meters */}
        <div className="grid grid-cols-2 gap-px border-t border-black/[0.06] bg-black/[0.03] lg:grid-cols-4">
          {usageCards.map(({ key, label }) => {
            const usage = entitlements.usage[key];
            const pct =
              usage.limit === null ? 0 : Math.min((usage.current / usage.limit) * 100, 100);
            const isOver = usage.limit !== null && usage.current > usage.limit;

            return (
              <div key={key} className="bg-white px-5 py-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {usage.limit === null ? "Unlimited" : `${usage.current}/${usage.limit}`}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-black/[0.04]">
                  <div
                    role="progressbar"
                    aria-label={`${label} usage`}
                    aria-valuemin={0}
                    aria-valuemax={usage.limit ?? usage.current}
                    aria-valuenow={usage.current}
                    className={`h-full rounded-full transition-all ${
                      isOver ? "bg-destructive" : pct > 80 ? "bg-accent" : "bg-foreground/70"
                    }`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border border-black/[0.06] bg-white shadow-panel">
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Billing insights
              </p>
              <h3 className="mt-2 flex items-center gap-1 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                Brand earnings versus HelloBrand cost
                <InfoTooltip label="Disclaimer" content={overview.insights.disclaimer} />
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                A simple creator-facing financial snapshot based on tracked deal payments and
                current HelloBrand pricing.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="border border-black/[0.06] bg-[#faf8f4] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Paid from brands
              </p>
              <p className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-foreground sm:text-[32px]">
                {moneyOrLabel(
                  overview.insights.paidToDateTotal,
                  overview.insights.earningsCurrency ?? "USD",
                  "Mixed currencies"
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tracked revenue marked paid across your deal records.
              </p>
            </div>

            <div className="border border-black/[0.06] bg-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Outstanding from brands
              </p>
              <p className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-foreground sm:text-[32px]">
                {moneyOrLabel(
                  overview.insights.outstandingTotal,
                  overview.insights.earningsCurrency ?? "USD",
                  "Mixed currencies"
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Includes sent invoices that are awaiting payment or already late.
              </p>
            </div>

            <div className="border border-black/[0.06] bg-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                HelloBrand cost
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                  {moneyOrLabel(overview.insights.monthlyPlanCostUsd, "USD")}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">monthly</span>
                </p>
                <p className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                  {moneyOrLabel(overview.insights.yearlyPlanCostUsd, "USD")}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">yearly</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on your current HelloBrand plan pricing.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="border border-black/[0.06] bg-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                This month
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Paid from brands</span>
                  <span className="font-medium text-foreground">
                    {moneyOrLabel(
                      overview.insights.currentMonthPaidTotal,
                      overview.insights.earningsCurrency ?? "USD",
                      "Mixed currencies"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">HelloBrand monthly cost</span>
                  <span className="font-medium text-foreground">
                    {moneyOrLabel(overview.insights.monthlyPlanCostUsd, "USD")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-black/[0.06] pt-2">
                  <span className="text-muted-foreground">Net after plan cost</span>
                  <span className="font-semibold text-foreground">
                    {moneyOrLabel(
                      overview.insights.currentMonthNetAfterPlanCostUsd,
                      "USD",
                      "Hidden"
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-black/[0.06] bg-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Year view
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Paid from brands (YTD)</span>
                  <span className="font-medium text-foreground">
                    {moneyOrLabel(
                      overview.insights.yearToDatePaidTotal,
                      overview.insights.earningsCurrency ?? "USD",
                      "Mixed currencies"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">HelloBrand yearly cost</span>
                  <span className="font-medium text-foreground">
                    {moneyOrLabel(overview.insights.yearlyPlanCostUsd, "USD")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-black/[0.06] pt-2">
                  <span className="text-muted-foreground">YTD minus yearly cost</span>
                  <span className="font-semibold text-foreground">
                    {moneyOrLabel(overview.insights.yearToDateNetAfterPlanCostUsd, "USD", "Hidden")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {overview.insights.comparisonNotice ? (
            <p className="mt-4 text-sm text-accent-foreground dark:text-accent">
              {overview.insights.comparisonNotice}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {overview.insights.methodology}
          </p>
        </div>
      </section>

      {/* Recommended upgrade */}
      <BillingUpgradePanel
        recommendedTier={overview.recommendedUpgradeTier}
        recommendation={overview.recommendedUpgradeLabel}
        hasActiveSubscription={overview.hasActiveSubscription}
        billingReady={overview.billingReady}
        stripeConfigured={overview.stripeConfigured}
        monthlyAvailable={
          overview.recommendedUpgradeTier
            ? (overview.planCatalog.find((p) => p.tier === overview.recommendedUpgradeTier)
                ?.monthlyAvailable ?? false)
            : false
        }
      />

      {/* Plan cards */}
      <section>
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Compare plans</h3>
        <p className="mb-5 max-w-[42rem] text-sm leading-6 text-muted-foreground">
          Choose the level of support that matches how often you manage paid partnerships. For many
          creators, one organized partnership can cover multiple months of HelloBrand.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {overview.planCatalog.map((plan) => {
            const isCurrentPlan = overview.currentPlanTier === plan.tier;
            const disablePlanActions =
              !overview.billingReady ||
              !overview.stripeConfigured ||
              overview.hasActiveSubscription ||
              isCurrentPlan;

            return (
              <article
                key={plan.tier}
                className={`flex flex-col border bg-white p-6 shadow-panel ${
                  isCurrentPlan
                    ? "border-foreground/20 ring-1 ring-foreground/10"
                    : "border-black/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      {plan.monthlyPriceLabel}
                    </p>
                  </div>
                  {isCurrentPlan && (
                    <span className="rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                      Current
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.yearlyAvailable ? plan.annualEquivalentLabel : "Monthly billing only"}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{plan.summary}</p>

                <ul className="mt-4 flex-1 space-y-2 border-t border-black/[0.06] pt-4">
                  {plan.features.map((feature, index) => {
                    const isHighlighted =
                      (plan.tier === PlanTier.standard || plan.tier === PlanTier.premium) &&
                      !(index === 0 && feature.startsWith("Everything in "));

                    return (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check
                          aria-hidden="true"
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isHighlighted ? "text-foreground" : "text-muted-foreground/50"}`}
                        />
                        <span
                          className={
                            isHighlighted ? "font-medium text-foreground" : "text-muted-foreground"
                          }
                        >
                          {feature}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-5 grid gap-2 border-t border-black/[0.06] pt-4">
                  <form action={startCheckoutAction}>
                    <input type="hidden" name="planTier" value={plan.tier} />
                    <input type="hidden" name="interval" value={BillingInterval.month} />
                    <PostHogSubmitButton
                      eventName="billing_checkout_started"
                      payload={{
                        source: "billing_plan_grid",
                        targetTier: plan.tier,
                        interval: BillingInterval.month,
                      }}
                      pendingLabel="Redirecting…"
                      disabled={disablePlanActions || !plan.monthlyAvailable}
                      className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isCurrentPlan ? "Current plan" : "Start monthly"}
                    </PostHogSubmitButton>
                  </form>

                  {plan.yearlyAvailable && (
                    <form action={startCheckoutAction}>
                      <input type="hidden" name="planTier" value={plan.tier} />
                      <input type="hidden" name="interval" value={BillingInterval.year} />
                      <PostHogSubmitButton
                        eventName="billing_checkout_started"
                        payload={{
                          source: "billing_plan_grid",
                          targetTier: plan.tier,
                          interval: BillingInterval.year,
                        }}
                        pendingLabel="Redirecting…"
                        disabled={disablePlanActions}
                        className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Start annual
                      </PostHogSubmitButton>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          The goal is simple: protect more value than your plan costs.
        </p>
      </section>
    </div>
  );
}
