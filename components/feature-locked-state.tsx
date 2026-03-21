import Link from "next/link";
import type { ReactNode } from "react";
import { PlanTier } from "@prisma/client";
import { Lock, ArrowRight, Sparkles, Check } from "lucide-react";

import { openBillingPortalAction } from "@/app/actions";
import { getPlanCatalogFeatures } from "@/lib/billing/plans";
import { SubmitButton } from "@/components/submit-button";
import { humanizeToken } from "@/lib/utils";

const PLAN_RANK: Record<PlanTier, number> = {
  basic: 0,
  standard: 1,
  premium: 2,
};

function UpgradeAction({
  requiredTier,
  hasActiveSubscription,
  actionLabel,
}: {
  requiredTier: PlanTier;
  hasActiveSubscription: boolean;
  actionLabel?: string;
}) {
  const label = actionLabel ?? `Upgrade to ${humanizeToken(requiredTier)}`;

  if (hasActiveSubscription) {
    return (
      <form action={openBillingPortalAction}>
        <SubmitButton
          pendingLabel="Opening portal…"
          className="group inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background transition-all hover:opacity-90"
        >
          {label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </SubmitButton>
      </form>
    );
  }

  return (
    <Link
      href="/app/settings/billing"
      className="group inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background transition-all hover:opacity-90"
    >
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function TierBadge({
  label,
  tier,
  variant,
}: {
  label: string;
  tier: PlanTier;
  variant: "current" | "required";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        variant === "required"
          ? "bg-foreground/5 text-foreground"
          : "bg-black/[0.03] text-muted-foreground"
      }`}
    >
      {variant === "required" && <Sparkles className="h-3 w-3" />}
      {label}: {humanizeToken(tier)}
    </span>
  );
}

function FeatureUpgradeCardInner({
  eyebrow = "Upgrade required",
  title,
  description,
  requiredTier,
  currentTier,
  hasActiveSubscription,
  actionLabel,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  requiredTier: PlanTier;
  currentTier: PlanTier;
  hasActiveSubscription: boolean;
  actionLabel?: string;
  children?: ReactNode;
}) {
  const features = getPlanCatalogFeatures(requiredTier);
  const stepsAway = PLAN_RANK[requiredTier] - PLAN_RANK[currentTier];

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-[#fafaf7] to-[#f5f4f0] shadow-panel">
      {/* Header */}
      <div className="px-8 pb-0 pt-8">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.06]">
            <Lock className="h-4.5 w-4.5 text-foreground/60" />
          </div>
          <div className="flex gap-2">
            <TierBadge label="Current" tier={currentTier} variant="current" />
            <TierBadge
              label="Required"
              tier={requiredTier}
              variant="required"
            />
          </div>
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          {title}
        </h2>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {/* Feature list */}
      {features.length > 0 && (
        <div className="mx-8 mt-6 rounded-xl border border-black/[0.04] bg-white/60 p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            Included with {humanizeToken(requiredTier)}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07]">
                  <Check className="h-2.5 w-2.5 text-foreground/70" />
                </div>
                <span className="text-[13px] leading-snug text-foreground/80">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {children ? <div className="px-8 pt-5">{children}</div> : null}

      {/* CTA */}
      <div className="flex items-center justify-between px-8 pb-7 pt-6">
        <UpgradeAction
          requiredTier={requiredTier}
          hasActiveSubscription={hasActiveSubscription}
          actionLabel={actionLabel}
        />
        {stepsAway > 1 && (
          <Link
            href="/app/settings/billing"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Compare plans
          </Link>
        )}
      </div>
    </div>
  );
}

export function FeatureUpgradeCard(props: {
  eyebrow?: string;
  title: string;
  description: string;
  requiredTier: PlanTier;
  currentTier: PlanTier;
  hasActiveSubscription: boolean;
  actionLabel?: string;
  children?: ReactNode;
}) {
  return <FeatureUpgradeCardInner {...props} />;
}

export function FeatureLockedState(props: {
  eyebrow?: string;
  title: string;
  description: string;
  requiredTier: PlanTier;
  currentTier: PlanTier;
  hasActiveSubscription: boolean;
  actionLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-start justify-center px-6 py-12 lg:px-10 lg:py-16">
      <div className="w-full max-w-xl">
        <FeatureUpgradeCardInner {...props} />
      </div>
    </div>
  );
}
