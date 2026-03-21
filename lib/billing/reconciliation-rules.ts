import { BillingSubscriptionStatus, BillingWebhookEventStatus } from "@prisma/client";

import { isActiveBillingSubscriptionStatus } from "@/lib/billing/rules";

export function isFinalizedWebhookStatus(
  status: BillingWebhookEventStatus | null | undefined
) {
  return (
    status === BillingWebhookEventStatus.processed ||
    status === BillingWebhookEventStatus.ignored
  );
}

export function selectCurrentSubscription<T extends { status: BillingSubscriptionStatus }>(
  subscriptions: T[]
) {
  return subscriptions.find((entry) => isActiveBillingSubscriptionStatus(entry.status)) ?? null;
}

export function resolveCheckoutSessionMerge(params: {
  existingId: string | null;
  provisionalId: string | null;
  stripeSubscriptionId: string | null;
}) {
  if (params.existingId) {
    return {
      action: "update-existing" as const,
      deleteProvisionalId:
        params.provisionalId && params.provisionalId !== params.existingId
          ? params.provisionalId
          : null
    };
  }

  if (params.provisionalId) {
    return {
      action: "update-provisional" as const,
      deleteProvisionalId: null
    };
  }

  if (params.stripeSubscriptionId) {
    return {
      action: "create" as const,
      deleteProvisionalId: null
    };
  }

  return {
    action: "noop" as const,
    deleteProvisionalId: null
  };
}

export function resolveSubscriptionMerge(params: {
  existingId: string | null;
  provisionalId: string | null;
}) {
  if (params.existingId) {
    return "update-existing" as const;
  }

  if (params.provisionalId) {
    return "update-provisional" as const;
  }

  return "create" as const;
}
