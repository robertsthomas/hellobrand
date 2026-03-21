import { BillingSubscriptionStatus, PlanTier } from "@prisma/client";

import { getDevPlanOverride } from "@/lib/billing/config";
import { isActiveBillingSubscriptionStatus } from "@/lib/billing/rules";
import { prisma } from "@/lib/prisma";
import { getRepository } from "@/lib/repository";
import type { Viewer } from "@/lib/types";

export const FEATURE_KEYS = [
  "workspace_creation",
  "assistant_chat",
  "deal_draft_generation",
  "brief_generation",
  "analytics",
  "analytics_advanced",
  "premium_inbox",
  "email_connections"
] as const;

export const USAGE_LIMIT_KEYS = [
  "active_workspaces",
  "assistant_messages_monthly",
  "deal_drafts_monthly",
  "brief_generations_monthly"
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type UsageLimitKey = (typeof USAGE_LIMIT_KEYS)[number];
export type EntitlementSource = "override" | "billing" | "fallback";

type UsageLimitMatrix = Record<PlanTier, Record<UsageLimitKey, number | null>>;
type FeatureMatrix = Record<PlanTier, Record<FeatureKey, boolean>>;

export type UsageEntitlement = {
  key: UsageLimitKey;
  current: number;
  limit: number | null;
  remaining: number | null;
  blocked: boolean;
};

export type ViewerEntitlements = {
  effectiveTier: PlanTier;
  source: EntitlementSource;
  overrideTier: PlanTier | null;
  currentPlanTier: PlanTier | null;
  currentTrialPlanTier: PlanTier | null;
  currentSubscriptionStatus: BillingSubscriptionStatus | null;
  hasActiveSubscription: boolean;
  features: Record<FeatureKey, boolean>;
  usage: Record<UsageLimitKey, UsageEntitlement>;
};

const FEATURE_MATRIX: FeatureMatrix = {
  basic: {
    workspace_creation: true,
    assistant_chat: true,
    deal_draft_generation: true,
    brief_generation: false,
    analytics: false,
    analytics_advanced: false,
    premium_inbox: false,
    email_connections: false
  },
  standard: {
    workspace_creation: true,
    assistant_chat: true,
    deal_draft_generation: true,
    brief_generation: true,
    analytics: true,
    analytics_advanced: false,
    premium_inbox: false,
    email_connections: false
  },
  premium: {
    workspace_creation: true,
    assistant_chat: true,
    deal_draft_generation: true,
    brief_generation: true,
    analytics: true,
    analytics_advanced: true,
    premium_inbox: true,
    email_connections: true
  }
};

const USAGE_LIMIT_MATRIX: UsageLimitMatrix = {
  basic: {
    active_workspaces: 3,
    assistant_messages_monthly: 25,
    deal_drafts_monthly: 10,
    brief_generations_monthly: 3
  },
  standard: {
    active_workspaces: null,
    assistant_messages_monthly: 250,
    deal_drafts_monthly: 100,
    brief_generations_monthly: 30
  },
  premium: {
    active_workspaces: null,
    assistant_messages_monthly: null,
    deal_drafts_monthly: null,
    brief_generations_monthly: null
  }
};

function currentWindowKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function usageFeatureKey(key: UsageLimitKey) {
  return key;
}

async function getActiveWorkspaceCount(viewer: Viewer) {
  if (!process.env.DATABASE_URL) {
    const deals = await getRepository().listDeals(viewer.id);
    return deals.filter(
      (deal) => deal.status !== "completed" && deal.status !== "paid"
    ).length;
  }

  return prisma.deal.count({
    where: {
      userId: viewer.id,
      status: {
        notIn: ["completed", "paid"]
      }
    }
  });
}

async function ensureBillingAccountForUsage(viewer: Viewer) {
  return prisma.billingAccount.upsert({
    where: { userId: viewer.id },
    update: {
      billingEmail: viewer.email
    },
    create: {
      userId: viewer.id,
      billingEmail: viewer.email
    }
  });
}

function featureErrorMessage(feature: FeatureKey, effectiveTier: PlanTier) {
  switch (feature) {
    case "premium_inbox":
      return "Inbox sync and communication intelligence are available on Premium.";
    case "email_connections":
      return "Email connections are available on Premium.";
    case "analytics":
      return "Analytics is available on Standard and Premium.";
    case "analytics_advanced":
      return "Advanced reporting is available on Premium.";
    case "brief_generation":
      return "AI brief generation is available on Standard and Premium.";
    default:
      return `This feature is not available on the ${effectiveTier} plan.`;
  }
}

function usageErrorMessage(key: UsageLimitKey, limit: number, effectiveTier: PlanTier) {
  switch (key) {
    case "active_workspaces":
      return `The ${effectiveTier} plan supports ${limit} active workspaces. Upgrade to add more.`;
    case "assistant_messages_monthly":
      return `You have used all ${limit} assistant messages included in your ${effectiveTier} plan this month.`;
    case "deal_drafts_monthly":
      return `You have used all ${limit} AI draft generations included in your ${effectiveTier} plan this month.`;
    case "brief_generations_monthly":
      return `You have used all ${limit} AI brief generations included in your ${effectiveTier} plan this month.`;
    default:
      return "This usage limit has been reached.";
  }
}

export async function getViewerEntitlements(viewer: Viewer): Promise<ViewerEntitlements> {
  const overrideTier = getDevPlanOverride();
  const workspaceCount = await getActiveWorkspaceCount(viewer);

  if (!process.env.DATABASE_URL) {
    const effectiveTier = overrideTier ?? PlanTier.basic;
    const usage = Object.fromEntries(
      USAGE_LIMIT_KEYS.map((key) => {
        const current = key === "active_workspaces" ? workspaceCount : 0;
        const limit = USAGE_LIMIT_MATRIX[effectiveTier][key];
        const blocked = limit !== null && current >= limit;
        return [
          key,
          {
            key,
            current,
            limit,
            remaining: limit === null ? null : Math.max(limit - current, 0),
            blocked
          }
        ];
      })
    ) as Record<UsageLimitKey, UsageEntitlement>;

    return {
      effectiveTier,
      source: overrideTier ? "override" : "fallback",
      overrideTier,
      currentPlanTier: overrideTier,
      currentTrialPlanTier: null,
      currentSubscriptionStatus: null,
      hasActiveSubscription: false,
      features: FEATURE_MATRIX[effectiveTier],
      usage
    };
  }

  const [billingAccount, activeWorkspaceCount] = await Promise.all([
    prisma.billingAccount.findUnique({
      where: { userId: viewer.id },
      select: {
        currentPlanTier: true,
        currentTrialPlanTier: true,
        currentSubscriptionStatus: true,
        id: true
      }
    }),
    Promise.resolve(workspaceCount)
  ]);

  const effectiveTier =
    overrideTier ??
    billingAccount?.currentPlanTier ??
    billingAccount?.currentTrialPlanTier ??
    PlanTier.basic;
  const source: EntitlementSource = overrideTier
    ? "override"
    : billingAccount?.currentPlanTier || billingAccount?.currentTrialPlanTier
      ? "billing"
      : "fallback";

  const windowKey = currentWindowKey();
  const usageRows = billingAccount?.id
    ? await prisma.billingUsageLedger.findMany({
        where: {
          billingAccountId: billingAccount.id,
          windowKey
        }
      })
    : [];

  const usageMap = new Map(usageRows.map((row) => [row.featureKey, row.quantity]));
  const usage = Object.fromEntries(
    USAGE_LIMIT_KEYS.map((key) => {
      const current = key === "active_workspaces" ? activeWorkspaceCount : usageMap.get(usageFeatureKey(key)) ?? 0;
      const limit = USAGE_LIMIT_MATRIX[effectiveTier][key];
      const blocked = limit !== null && current >= limit;
      return [
        key,
        {
          key,
          current,
          limit,
          remaining: limit === null ? null : Math.max(limit - current, 0),
          blocked
        }
      ];
    })
  ) as Record<UsageLimitKey, UsageEntitlement>;

  return {
    effectiveTier,
    source,
    overrideTier,
    currentPlanTier: billingAccount?.currentPlanTier ?? null,
    currentTrialPlanTier: billingAccount?.currentTrialPlanTier ?? null,
    currentSubscriptionStatus: billingAccount?.currentSubscriptionStatus ?? null,
    hasActiveSubscription: isActiveBillingSubscriptionStatus(
      billingAccount?.currentSubscriptionStatus
    ),
    features: FEATURE_MATRIX[effectiveTier],
    usage
  };
}

export async function assertViewerHasFeature(viewer: Viewer, feature: FeatureKey) {
  const entitlements = await getViewerEntitlements(viewer);
  if (!entitlements.features[feature]) {
    throw new Error(featureErrorMessage(feature, entitlements.effectiveTier));
  }

  return entitlements;
}

export async function assertViewerWithinUsageLimit(
  viewer: Viewer,
  key: UsageLimitKey,
  increment = 1
) {
  const entitlements = await getViewerEntitlements(viewer);
  const usage = entitlements.usage[key];
  if (usage.limit !== null && usage.current + increment > usage.limit) {
    throw new Error(usageErrorMessage(key, usage.limit, entitlements.effectiveTier));
  }

  return entitlements;
}

export async function recordViewerUsage(
  viewer: Viewer,
  key: UsageLimitKey,
  quantity = 1,
  now = new Date()
) {
  const billingAccount = await ensureBillingAccountForUsage(viewer);
  const windowKey = currentWindowKey(now);
  const limit = USAGE_LIMIT_MATRIX[(await getViewerEntitlements(viewer)).effectiveTier][key];

  return prisma.billingUsageLedger.upsert({
    where: {
      billingAccountId_featureKey_windowKey: {
        billingAccountId: billingAccount.id,
        featureKey: usageFeatureKey(key),
        windowKey
      }
    },
    update: {
      quantity: {
        increment: quantity
      },
      limit
    },
    create: {
      billingAccountId: billingAccount.id,
      featureKey: usageFeatureKey(key),
      windowKey,
      quantity,
      limit
    }
  });
}
