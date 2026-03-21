import { BillingInterval, PlanTier } from "@prisma/client";

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

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function stripePriceEnvName(planTier: PlanTier, interval: BillingInterval) {
  const suffix = interval === BillingInterval.month ? "MONTHLY" : "YEARLY";
  return `STRIPE_PRICE_${planTier.toUpperCase()}_${suffix}`;
}

export function getStripePriceId(planTier: PlanTier, interval: BillingInterval) {
  const envName = stripePriceEnvName(planTier, interval);
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(`Missing ${envName}.`);
  }

  return value;
}

export function hasStripePriceId(planTier: PlanTier, interval: BillingInterval) {
  return Boolean(process.env[stripePriceEnvName(planTier, interval)]?.trim());
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}
