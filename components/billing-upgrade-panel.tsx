import { BillingInterval, PlanTier } from "@prisma/client";

import { openBillingPortalAction, startCheckoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { humanizeToken } from "@/lib/utils";

export function BillingUpgradePanel({
  recommendedTier,
  recommendation,
  hasActiveSubscription,
  billingReady,
  stripeConfigured,
  monthlyAvailable
}: {
  recommendedTier: PlanTier | null;
  recommendation: string | null;
  hasActiveSubscription: boolean;
  billingReady: boolean;
  stripeConfigured: boolean;
  monthlyAvailable: boolean;
}) {
  if (!recommendedTier || !recommendation) {
    return null;
  }

  return (
    <aside className="rounded-[2rem] border border-black/8 bg-[#fbfbf8] p-8 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
        Recommended next step
      </p>
      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
        {humanizeToken(recommendedTier)}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{recommendation}</p>

      {hasActiveSubscription ? (
        <form action={openBillingPortalAction} className="mt-6">
          <SubmitButton
            pendingLabel="Opening portal..."
            disabled={!billingReady || !stripeConfigured}
            className="inline-flex items-center justify-center bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upgrade in Stripe
          </SubmitButton>
        </form>
      ) : (
        <form action={startCheckoutAction} className="mt-6">
          <input type="hidden" name="planTier" value={recommendedTier} />
          <input type="hidden" name="interval" value={BillingInterval.month} />
          <SubmitButton
            pendingLabel="Redirecting..."
            disabled={!billingReady || !stripeConfigured || !monthlyAvailable}
            className="inline-flex items-center justify-center bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start {humanizeToken(recommendedTier)}
          </SubmitButton>
        </form>
      )}
    </aside>
  );
}
