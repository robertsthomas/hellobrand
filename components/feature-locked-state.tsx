import Link from "next/link";
import type { ReactNode } from "react";
import { PlanTier } from "@prisma/client";
import { ArrowRight, Lock } from "lucide-react";

import { openBillingPortalAction } from "@/app/actions";
import { PostHogActionLink } from "@/components/posthog-action-link";
import { PostHogSubmitButton } from "@/components/posthog-submit-button";
import { humanizeToken } from "@/lib/utils";

function UpgradeButton({
  requiredTier,
  currentTier,
  hasActiveSubscription,
  actionLabel,
  title
}: {
  requiredTier: PlanTier;
  currentTier: PlanTier;
  hasActiveSubscription: boolean;
  actionLabel?: string;
  title: string;
}) {
  const label = actionLabel ?? `Upgrade to ${humanizeToken(requiredTier)}`;

  if (hasActiveSubscription) {
    return (
      <form action={openBillingPortalAction}>
        <PostHogSubmitButton
          eventName="billing_portal_clicked"
          payload={{
            source: "feature_upgrade_card",
            requiredTier,
            currentTier,
            title
          }}
          pendingLabel="Opening portal..."
          className="group inline-flex items-center justify-center gap-2 bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
        >
          {label}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </PostHogSubmitButton>
      </form>
    );
  }

  return (
    <PostHogActionLink
      href="/app/settings/billing"
      eventName="billing_checkout_started"
      payload={{
        source: "feature_upgrade_card",
        requiredTier,
        currentTier,
        title
      }}
      className="group inline-flex items-center justify-center gap-2 bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </PostHogActionLink>
  );
}

/**
 * Inline upgrade card — compact, no gradient, no feature list.
 * Use inside a page alongside other content.
 */
export function FeatureUpgradeCard({
  icon,
  title,
  description,
  requiredTier,
  currentTier,
  hasActiveSubscription,
  actionLabel,
  children,
}: {
  icon?: ReactNode;
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
    <div className="border border-black/[0.06] bg-white p-6 text-center dark:border-white/10 dark:bg-white/[0.02] sm:p-8">
      {icon && (
        <div className="mx-auto flex h-10 w-10 items-center justify-center bg-foreground/[0.05]">
          {icon}
        </div>
      )}
      <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-5 flex items-center justify-center gap-4">
        <UpgradeButton
          requiredTier={requiredTier}
          currentTier={currentTier}
          hasActiveSubscription={hasActiveSubscription}
          actionLabel={actionLabel}
          title={title}
        />
      </div>
    </div>
  );
}

/**
 * Full-page centered upgrade state — for pages entirely locked behind a tier.
 */
export function FeatureLockedState({
  icon,
  title,
  description,
  requiredTier,
  currentTier,
  hasActiveSubscription,
  actionLabel,
  children,
}: {
  icon?: ReactNode;
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
    <div className="flex min-h-[50vh] items-center justify-center px-6 py-12">
      <div className="max-w-sm text-center">
        {icon ? (
          <div className="mx-auto flex h-12 w-12 items-center justify-center bg-foreground/[0.05]">
            {icon}
          </div>
        ) : (
          <div className="mx-auto flex h-12 w-12 items-center justify-center bg-foreground/[0.05]">
            <Lock className="h-5 w-5 text-foreground/50" />
          </div>
        )}
        <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex items-center justify-center gap-4">
          <UpgradeButton
            requiredTier={requiredTier}
            currentTier={currentTier}
            hasActiveSubscription={hasActiveSubscription}
            actionLabel={actionLabel}
            title={title}
          />
        </div>
        <Link
          href="/app/settings/billing"
          className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
        >
          Compare plans
        </Link>
      </div>
    </div>
  );
}
