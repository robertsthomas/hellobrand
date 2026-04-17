import { BillingInterval, PlanTier } from "@prisma/client";
import { BillingSubscriptionStatus } from "@prisma/client";

export const STRIPE_API_VERSION = "2026-02-25.clover";

function isNonProduction() {
  return process.env.NODE_ENV !== "production";
}

function isValidPlanTier(value: string | undefined | null): value is PlanTier {
  return value === PlanTier.free || value === PlanTier.basic || value === PlanTier.premium;
}

function isPaidPlanTier(planTier: PlanTier): planTier is "basic" | "premium" {
  return planTier === "basic" || planTier === "premium";
}

function isValidBillingInterval(
  value: string | undefined | null
): value is BillingInterval {
  return value === BillingInterval.month || value === BillingInterval.year;
}

function isValidBillingStatus(
  value: string | undefined | null
): value is BillingSubscriptionStatus {
  return Object.values(BillingSubscriptionStatus).includes(
    value as BillingSubscriptionStatus
  );
}

function normalizeBaseUrl(value: string | undefined) {
  const fallback = "http://localhost:3011";
  const normalized = value?.trim() || fallback;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function getBillingBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL || process.env.INTEGRATIONS_APP_URL
  );
}

// fallow-ignore-next-line unused-export
export function getDevPlanOverride() {
  if (!isNonProduction()) {
    return null;
  }

  const value = process.env.HELLOBRAND_DEV_PLAN?.trim().toLowerCase() ?? null;
  return isValidPlanTier(value) ? value : null;
}

/**
 * Async version that also checks the e2e tier cookie.
 * Used in async contexts like getViewerEntitlements.
 */
export async function getDevPlanOverrideAsync(): Promise<PlanTier | null> {
  if (!isNonProduction()) {
    return null;
  }

  if (process.env.HELLOBRAND_E2E_ENABLED === "1") {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const tier = cookieStore.get("hb_e2e_tier")?.value?.trim().toLowerCase() ?? null;
      if (isValidPlanTier(tier)) return tier;
    } catch {
      // Not in a request context
    }
  }

  const value = process.env.HELLOBRAND_DEV_PLAN?.trim().toLowerCase() ?? null;
  return isValidPlanTier(value) ? value : null;
}

export function getDevBillingIntervalOverride() {
  if (!isNonProduction()) {
    return null;
  }

  const value = process.env.HELLOBRAND_DEV_BILLING_INTERVAL?.trim().toLowerCase() ?? null;
  return isValidBillingInterval(value) ? value : null;
}

export function getDevBillingStatusOverride() {
  if (!isNonProduction()) {
    return null;
  }

  const value = process.env.HELLOBRAND_DEV_BILLING_STATUS?.trim().toLowerCase() ?? null;
  return isValidBillingStatus(value) ? value : null;
}

export function getDevTrialDaysLeftOverride() {
  if (!isNonProduction()) {
    return null;
  }

  const value = Number.parseInt(process.env.HELLOBRAND_DEV_TRIAL_DAYS_LEFT ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

function stripePriceEnvName(planTier: PlanTier, interval: BillingInterval) {
  const suffix = interval === BillingInterval.month ? "MONTHLY" : "YEARLY";
  return `STRIPE_PRICE_${planTier.toUpperCase()}_${suffix}`;
}

export function getStripePriceId(planTier: PlanTier, interval: BillingInterval) {
  if (!isPaidPlanTier(planTier)) {
    throw new Error("Free tier does not have a Stripe price.");
  }

  const envName = stripePriceEnvName(planTier, interval);
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(`Missing ${envName}.`);
  }

  return value;
}

export function hasStripePriceId(planTier: PlanTier, interval: BillingInterval) {
  if (!isPaidPlanTier(planTier)) {
    return false;
  }

  return Boolean(process.env[stripePriceEnvName(planTier, interval)]?.trim());
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey() && getStripeWebhookSecret());
}
