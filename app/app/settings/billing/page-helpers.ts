/**
 * Helpers for the billing settings route.
 * This file keeps billing-specific status copy, trial math, money formatting, and small route view-model shaping out of the page component.
 */
import { PlanTier } from "@prisma/client";

import type { UsageLimitKey } from "@/lib/billing/entitlements";
import { humanizeToken } from "@/lib/utils";

export function statusTone(status: string | null) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "trialing") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "past_due" || status === "unpaid") return "border-red-200 bg-red-50 text-red-700";
  return "border-black/[0.06] bg-[#f5f6f8] text-[#667085]";
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(Math.ceil(diff / (24 * 60 * 60 * 1000)), 0);
}

export function trialCountdownLabel(date: string | null) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days === 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function statusBadgeLabel(options: {
  currentSubscriptionStatus: string | null;
  currentTrialEndsAt: string | null;
  currentPlanTier: PlanTier | null;
}) {
  if (options.currentSubscriptionStatus === "trialing")
    return trialCountdownLabel(options.currentTrialEndsAt) ?? "Trial";
  if (options.currentSubscriptionStatus === "active") return "Active";
  if (options.currentSubscriptionStatus === "past_due" || options.currentSubscriptionStatus === "unpaid")
    return "Payment issue";
  if (options.currentSubscriptionStatus === "paused") return "Paused";
  if (options.currentSubscriptionStatus === "canceled") return "Canceled";
  return options.currentPlanTier ? "Plan selected" : "No plan yet";
}

export function billingIntro(options: {
  currentPlanTier: PlanTier | null;
  currentSubscriptionStatus: string | null;
}) {
  if (options.currentSubscriptionStatus === "trialing" && options.currentPlanTier)
    return `You are currently trying the ${humanizeToken(options.currentPlanTier)} plan.`;
  if (options.currentPlanTier) return "Manage your plan, payment method, and renewal details.";
  return "Choose the plan that fits how you manage brand partnerships.";
}

export function moneyOrLabel(amount: number | null, currency = "USD", fallback = "Unavailable") {
  if (amount === null) {
    return fallback;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function buildBillingPageViewModel(input: {
  searchParams?: { billing_error?: string; billing_notice?: string; checkout?: string };
}) {
  const resolved = input.searchParams ?? {};

  return {
    billingError: resolved.billing_error ?? null,
    billingNotice: resolved.billing_notice ?? null,
    checkoutState: resolved.checkout ?? null,
    usageCards: [
      { key: "active_workspaces", label: "Workspaces" },
      { key: "assistant_messages_monthly", label: "Assistant" },
      { key: "deal_drafts_monthly", label: "AI drafts" },
      { key: "brief_generations_monthly", label: "Briefs" }
    ] satisfies Array<{ key: UsageLimitKey; label: string }>
  };
}
