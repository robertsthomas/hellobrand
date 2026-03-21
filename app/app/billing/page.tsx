import { BillingInterval } from "@prisma/client";

import { openBillingPortalAction, startCheckoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireViewer } from "@/lib/auth";
import { getBillingOverviewForViewer } from "@/lib/billing/service";
import { formatDate, humanizeToken } from "@/lib/utils";

function statusTone(status: string | null) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "trialing") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (status === "past_due" || status === "unpaid") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085]";
}

export default async function BillingPage({
  searchParams
}: {
  searchParams?: Promise<{
    billing_error?: string;
    checkout?: string;
  }>;
}) {
  const viewer = await requireViewer();
  const overview = await getBillingOverviewForViewer(viewer);
  const resolved = searchParams ? await searchParams : {};
  const billingError = resolved.billing_error ?? null;
  const checkoutState = resolved.checkout ?? null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="max-w-4xl space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
              Billing
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">
              Plans and billing
            </h1>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
            Start a paid plan, test trial eligibility, and prepare the app for Stripe-backed
            subscriptions. Entitlements still resolve from the app database, not from Clerk
            metadata.
          </p>
        </section>

        {billingError ? (
          <section className="max-w-4xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {billingError}
          </section>
        ) : null}

        {checkoutState === "success" ? (
          <section className="max-w-4xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            Stripe checkout completed. Subscription state will update after webhook reconciliation.
          </section>
        ) : null}

        {checkoutState === "canceled" ? (
          <section className="max-w-4xl border border-black/8 bg-[#f5f6f8] px-5 py-4 text-sm text-[#667085]">
            Stripe checkout was canceled before the subscription was started.
          </section>
        ) : null}

        {!overview.billingReady && overview.billingErrorMessage ? (
          <section className="max-w-4xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {overview.billingErrorMessage}
          </section>
        ) : null}

        {!overview.stripeConfigured ? (
          <section className="max-w-4xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Stripe is not configured yet. Add `STRIPE_SECRET_KEY` and the plan price IDs before
            testing checkout.
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  Current access
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  {overview.currentPlanTier
                    ? `${humanizeToken(overview.currentPlanTier)} plan`
                    : "No active subscription yet"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {overview.currentPlanTier
                    ? "This reflects the current billing snapshot stored in Postgres."
                    : "Choose a plan below to start a Stripe checkout flow for this Clerk-authenticated account."}
                </p>
              </div>

              <span
                className={`inline-flex border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${statusTone(
                  overview.currentSubscriptionStatus
                )}`}
              >
                {overview.currentSubscriptionStatus
                  ? humanizeToken(overview.currentSubscriptionStatus)
                  : "No status yet"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 border-t border-black/8 pt-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  Billing interval
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {overview.currentPlanInterval
                    ? humanizeToken(overview.currentPlanInterval)
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                  Active trial
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {overview.currentTrialPlanTier
                    ? `${humanizeToken(overview.currentTrialPlanTier)} until ${formatDate(
                        overview.currentTrialEndsAt
                      )}`
                    : "No current trial"}
                </p>
              </div>
            </div>

            {overview.hasActiveSubscription ? (
              <div className="mt-6 border-t border-black/8 pt-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  Active subscriptions are managed in Stripe. Use the billing portal for upgrades,
                  downgrades, cancellations, and payment-method changes.
                </p>
                <form action={openBillingPortalAction} className="mt-4">
                  <SubmitButton
                    pendingLabel="Opening portal..."
                    className="inline-flex items-center justify-center border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-foreground"
                  >
                    Manage in Stripe
                  </SubmitButton>
                </form>
              </div>
            ) : null}
          </div>

          <aside className="rounded-[2rem] border border-black/8 bg-[#fbfbf8] p-8 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Trial policy
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>`Basic` and `Standard` default to 14-day trials.</p>
              <p>`Premium` defaults to a 7-day trial.</p>
              <p>
                Paid `Basic` and `Standard` customers get a 14-day `Premium` upsell trial when
                they upgrade through Stripe.
              </p>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
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
                className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-panel"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                      {plan.name}
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                      {plan.monthlyPriceLabel}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.yearlyAvailable ? plan.annualEquivalentLabel : "Monthly billing only right now"}
                    </p>
                  </div>
                  <span className="border border-black/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {plan.trialLabel}
                  </span>
                </div>

                <p className="mt-5 text-sm leading-6 text-muted-foreground">{plan.summary}</p>

                <ul className="mt-6 space-y-2 border-t border-black/8 pt-5 text-sm text-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <div className="mt-6 grid gap-3 border-t border-black/8 pt-5">
                  <form action={startCheckoutAction} className="grid gap-2">
                    <input type="hidden" name="planTier" value={plan.tier} />
                    <input type="hidden" name="interval" value={BillingInterval.month} />
                    <SubmitButton
                      pendingLabel="Redirecting..."
                      disabled={disablePlanActions || !plan.monthlyAvailable}
                      className="inline-flex items-center justify-center bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCurrentPlan ? "Current plan" : "Start monthly"}
                    </SubmitButton>
                  </form>

                  {plan.yearlyAvailable ? (
                    <form action={startCheckoutAction} className="grid gap-2">
                      <input type="hidden" name="planTier" value={plan.tier} />
                      <input type="hidden" name="interval" value={BillingInterval.year} />
                      <SubmitButton
                        pendingLabel="Redirecting..."
                        disabled={disablePlanActions}
                        className="inline-flex items-center justify-center border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Start annual
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>

                {!plan.monthlyAvailable ? (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Missing the Stripe monthly price ID for this plan.
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
