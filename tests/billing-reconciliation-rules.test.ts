import { describe, expect, test } from "vitest";
import {
  BillingSubscriptionStatus,
  BillingWebhookEventStatus
} from "@prisma/client";

import {
  isFinalizedWebhookStatus,
  resolveCheckoutSessionMerge,
  resolveSubscriptionMerge,
  selectCurrentSubscription
} from "@/lib/billing/reconciliation-rules";

describe("billing reconciliation rules", () => {
  test("treats processed and ignored webhook events as finalized duplicates", () => {
    expect(isFinalizedWebhookStatus(BillingWebhookEventStatus.processed)).toBe(true);
    expect(isFinalizedWebhookStatus(BillingWebhookEventStatus.ignored)).toBe(true);
    expect(isFinalizedWebhookStatus(BillingWebhookEventStatus.processing)).toBe(false);
    expect(isFinalizedWebhookStatus(BillingWebhookEventStatus.failed)).toBe(false);
  });

  test("prefers an active subscription when selecting the current snapshot", () => {
    const selected = selectCurrentSubscription([
      { id: "sub-canceled", status: BillingSubscriptionStatus.canceled },
      { id: "sub-active", status: BillingSubscriptionStatus.active },
      { id: "sub-incomplete", status: BillingSubscriptionStatus.incomplete }
    ]);

    expect(selected?.id).toBe("sub-active");
  });

  test("returns null when no active subscription exists", () => {
    const selected = selectCurrentSubscription([
      { id: "sub-latest", status: BillingSubscriptionStatus.canceled },
      { id: "sub-older", status: BillingSubscriptionStatus.incomplete }
    ]);

    expect(selected).toBeNull();
  });

  test("reuses the provisional record when subscription webhooks arrive before checkout reconciliation", () => {
    expect(
      resolveSubscriptionMerge({
        existingId: null,
        provisionalId: "provisional-sub"
      })
    ).toBe("update-provisional");
  });

  test("prefers the existing subscription row once checkout reconciliation catches up", () => {
    expect(
      resolveCheckoutSessionMerge({
        existingId: "saved-subscription",
        provisionalId: "provisional-checkout-row",
        stripeSubscriptionId: "sub_123"
      })
    ).toEqual({
      action: "update-existing",
      deleteProvisionalId: "provisional-checkout-row"
    });
  });

  test("updates the provisional checkout row when no saved subscription exists yet", () => {
    expect(
      resolveCheckoutSessionMerge({
        existingId: null,
        provisionalId: "provisional-checkout-row",
        stripeSubscriptionId: "sub_123"
      })
    ).toEqual({
      action: "update-provisional",
      deleteProvisionalId: null
    });
  });

  test("creates a new record when neither an existing nor provisional subscription is present", () => {
    expect(
      resolveCheckoutSessionMerge({
        existingId: null,
        provisionalId: null,
        stripeSubscriptionId: "sub_123"
      })
    ).toEqual({
      action: "create",
      deleteProvisionalId: null
    });
  });
});
