# Tier-Based Entitlements for HelloBrand

Manage subscription-tier access, feature gates, usage limits, and billing-driven entitlement changes in HelloBrand's Next.js + Clerk + Prisma + Stripe stack.

## When to Use This Skill

Use this skill when:

- Free users get limited access and Basic/Premium users unlock more features.
- Stripe subscriptions determine a user's plan tier.
- Clerk Auth identifies users, while Prisma manages application data and billing state.
- Next.js API routes or Server Actions need to enforce feature access or usage limits.
- React components need to show, hide, disable, or upsell gated features.
- You need monthly usage counters for AI generations, briefs, concepts, or workspaces.
- You are adding a new feature that should be tier-gated.
- You need to add a new usage limit or modify an existing one.

## Core Rule

Entitlements must be enforced on the server.

React gates are for user experience only. Never rely on client-side checks as the source of truth for paid access, usage limits, or permissions.

## Architecture

HelloBrand's entitlement source-of-truth split:

1. **Stripe**: billing state, products, prices, subscriptions, invoices, payment status.
2. **Prisma/Postgres**: app entitlement state (`BillingAccount`, `BillingSubscription`, `BillingUsageLedger`), current plan, usage counters, overrides, trials.
3. **Code config**: default capabilities and limits per tier in `lib/billing/entitlements.ts`.
4. **Server enforcement**: API routes, Server Actions, Inngest background jobs.
5. **React UI**: visual gating, upgrade prompts, usage displays.

Avoid putting entitlement logic directly in random components, API handlers, or Stripe webhook branches. Route everything through shared entitlement helpers in `lib/billing/`.

## Plan Tiers

HelloBrand has three tiers (defined in `prisma/schema/billing.prisma` as `PlanTier` enum):

| Tier | Price | Description |
| --- | --- | --- |
| `free` | $0 | 1 workspace, limited AI, no briefs |
| `basic` | $29/mo or $288/yr | 8 workspaces, brief generation, analytics, concepts |
| `premium` | $79/mo or $768/yr | Unlimited everything, inbox sync, advanced analytics |

## Feature Matrix

Features are gated as booleans per tier, defined in `FEATURE_MATRIX` in `lib/billing/entitlements.ts`:

| Feature Key | free | basic | premium |
| --- | --- | --- | --- |
| `workspace_creation` | true | true | true |
| `assistant_chat` | true | true | true |
| `deal_draft_generation` | true | true | true |
| `brief_generation` | false | true | true |
| `analytics` | false | true | true |
| `analytics_advanced` | false | false | true |
| `premium_inbox` | false | false | true |
| `email_connections` | false | false | true |
| `concept_generation` | false | true | true |

## Usage Limits

Quantitative limits per tier, defined in `USAGE_LIMIT_MATRIX` in `lib/billing/entitlements.ts`:

| Usage Key | free | basic | premium |
| --- | --- | --- | --- |
| `active_workspaces` | 1 | 8 | null (unlimited) |
| `assistant_messages_monthly` | 10 | 250 | null (unlimited) |
| `brief_generations_monthly` | 0 | 20 | null (unlimited) |
| `concept_generations_monthly` | 0 | 20 | null (unlimited) |

`null` means unlimited. `0` means the feature is not available (use the feature boolean instead).

`active_workspaces` is computed live via `prisma.deal.count()` rather than from the usage ledger.

## Key Types

```ts
// From lib/types.ts and lib/billing/entitlements.ts

type Viewer = {
  id: string;
  email: string;
  displayName: string;
  mode: "clerk" | "demo" | "e2e";
};

type ViewerEntitlements = {
  effectiveTier: PlanTier;
  source: EntitlementSource; // "override" | "billing" | "fallback"
  overrideTier: PlanTier | null;
  currentPlanTier: PlanTier | null;
  currentTrialPlanTier: PlanTier | null;
  currentSubscriptionStatus: BillingSubscriptionStatus | null;
  hasActiveSubscription: boolean;
  features: Record<FeatureKey, boolean>;
  usage: Record<UsageLimitKey, UsageEntitlement>;
};
```

## Tier Resolution Priority

`resolveEffectiveEntitlementTier()` in `lib/billing/rules.ts` resolves in this order:

1. **`overrideTier`** — Dev/E2E override from `HELLOBRAND_DEV_PLAN` env var or `hb_e2e_tier` cookie.
2. If subscription status is `trialing` → `currentTrialPlanTier ?? currentPlanTier ?? PlanTier.free`.
3. Otherwise → `currentPlanTier ?? currentTrialPlanTier ?? PlanTier.free`.

The `source` field indicates which path was taken: `"override"`, `"billing"`, or `"fallback"`.

## Adding a New Feature Gate

### 1. Add the feature key to the feature matrix

In `lib/billing/entitlements.ts`:

```ts
// Add to FeatureKey union type
export type FeatureKey =
  | "workspace_creation"
  | "assistant_chat"
  // ... existing keys
  | "my_new_feature"; // <-- add this

// Add to FEATURE_MATRIX
export const FEATURE_MATRIX: Record<PlanTier, Record<FeatureKey, boolean>> = {
  free: { ..., my_new_feature: false },
  basic: { ..., my_new_feature: true },
  premium: { ..., my_new_feature: true },
};
```

### 2. Enforce on the server

In API routes or server actions:

```ts
import { getViewerEntitlements, assertViewerHasFeature } from "@/lib/billing/entitlements";
import { requireApiViewer } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const viewer = await requireApiViewer();
  assertViewerHasFeature(viewer, "my_new_feature");
  // ... proceed with the action
}
```

`assertViewerHasFeature` throws if the feature is disabled for the viewer's effective tier.

### 3. Show/hide in React

```tsx
const entitlements = await getViewerEntitlements(viewer);
const hasMyFeature = entitlements.features.my_new_feature;

// In page/component JSX:
{hasMyFeature ? (
  <MyFeatureContent />
) : (
  <UpgradePrompt />
)}
```

## Adding a New Usage Limit

### 1. Add the usage key to the usage limit matrix

In `lib/billing/entitlements.ts`:

```ts
// Add to UsageLimitKey union type
export type UsageLimitKey =
  | "active_workspaces"
  | "assistant_messages_monthly"
  // ... existing keys
  | "my_resource_monthly"; // <-- add this

// Add to USAGE_LIMIT_MATRIX
export const USAGE_LIMIT_MATRIX: Record<PlanTier, Record<UsageLimitKey, number | null>> = {
  free: { ..., my_resource_monthly: 5 },
  basic: { ..., my_resource_monthly: 50 },
  premium: { ..., my_resource_monthly: null }, // unlimited
};
```

### 2. Check before consuming, increment after success

```ts
import {
  getViewerEntitlements,
  assertViewerWithinUsageLimit,
  recordViewerUsage,
} from "@/lib/billing/entitlements";
import { requireApiViewer } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const viewer = await requireApiViewer();

  // Check feature gate first
  assertViewerHasFeature(viewer, "my_new_feature");

  // Check usage limit (throws if exceeded)
  assertViewerWithinUsageLimit(viewer, "my_resource_monthly");

  // Do the work
  const result = await doExpensiveWork();

  // Record usage only after success
  await recordViewerUsage(viewer, "my_resource_monthly");

  return NextResponse.json({ result });
}
```

### 3. Show usage in React

Usage data is available in `ViewerEntitlements.usage`:

```tsx
const usage = entitlements.usage.my_resource_monthly;
// usage = { limit: number | null, used: number, remaining: number | null, windowKey: string }

<p>{usage.used} / {usage.limit ?? "∞"} used this month</p>
```

## Server-Side Enforcement API

The main exports from `lib/billing/entitlements.ts`:

| Function | Purpose |
| --- | --- |
| `getViewerEntitlements(viewer)` | Full entitlement snapshot: tier, features, usage |
| `assertViewerHasFeature(viewer, feature)` | Throws if feature is disabled |
| `assertViewerWithinUsageLimit(viewer, key, increment?)` | Throws if usage would exceed limit |
| `recordViewerUsage(viewer, key, quantity?)` | Upserts a `BillingUsageLedger` row |

All of these resolve the viewer's effective tier, look up the `BillingAccount`, and read usage ledger rows for the current monthly window (`YYYY-MM`).

## Auth Integration

HelloBrand uses Clerk for authentication, not Supabase Auth.

| Function | File | Behavior |
| --- | --- | --- |
| `requireViewer()` | `lib/auth.ts` | Returns `Viewer` or redirects to `/login` |
| `requireApiViewer()` | `lib/auth.ts` | Returns `Viewer` or throws `Error("Unauthorized")` |
| `getCurrentViewer()` | `lib/auth.ts` | Returns `Viewer | null` (cached via React `cache()`) |

On first authentication, `getCurrentViewer()` upserts a `User` row and ensures a `BillingAccount` exists with `currentPlanTier: "free"`.

## Stripe Price Mapping

Map Stripe price IDs to plan tiers explicitly. Never infer a plan from a display name.

Price mapping is in `lib/billing/config.ts`:

```ts
// Env vars hold the price IDs
STRIPE_BASIC_MONTHLY_PRICE_ID
STRIPE_BASIC_YEARLY_PRICE_ID
STRIPE_PREMIUM_MONTHLY_PRICE_ID
STRIPE_PREMIUM_YEARLY_PRICE_ID
```

Resolution happens via `getPlanForStripePrice(priceId)` in `lib/billing/config.ts`.

## Stripe Webhook Flow

The webhook handler is at `app/api/stripe/webhook/route.ts`.

### Flow

1. **Signature verification** via `getStripeWebhookEvent(payload, signature)`.
2. **Idempotency** via `beginStripeWebhookProcessing(event)` — returns `{ alreadyFinalized }`. If already finalized, returns 200 with `{ duplicate: true }`.
3. **Event routing**:
   - `checkout.session.completed` → `reconcileStripeCheckoutSession()`
   - `customer.subscription.created` / `updated` / `deleted` → `reconcileStripeSubscription()`
   - `invoice.payment_failed` → `reconcileStripeInvoicePaymentFailure()`
   - `invoice.paid` → Fetches subscription from Stripe, then `reconcileStripeSubscription()`
4. **Completion**: `completeStripeWebhookProcessing(eventId, status)` on success, or `failStripeWebhookProcessing(eventId, message)` on error.

All reconciliation functions live in `lib/billing/service.ts` and use rules from `lib/billing/reconciliation-rules.ts`.

## Billing State Rules

Subscription status behavior (from `lib/billing/rules.ts`):

| Status | Behavior |
| --- | --- |
| `trialing` | Allow paid tier during trial |
| `active` | Allow paid tier |
| `past_due` | Optionally allow a short grace period |
| `unpaid` | Restrict to free |
| `canceled` | Downgrade at period end if `currentPeriodEnd` is still in future |
| `incomplete` | Keep free until payment succeeds |
| `paused` | Restrict paid entitlements |

Use `isActiveBillingSubscriptionStatus(status)` from `lib/billing/rules.ts` to check if a subscription should grant paid entitlements.

## Prisma Billing Models

Defined in `prisma/schema/billing.prisma`:

| Model | Purpose |
| --- | --- |
| `BillingAccount` | One per user; holds current plan state, Stripe customer ID |
| `BillingSubscription` | Historical + active subscriptions |
| `BillingTrialLedger` | Trial history per account/plan |
| `BillingUsageLedger` | Monthly usage counters keyed by `[billingAccountId, featureKey, windowKey]` |
| `BillingWebhookEvent` | Idempotent webhook processing |
| `PaymentRecord` | Per-deal payment tracking |
| `InvoiceRecord` | Invoice data per deal |
| `InvoiceDeliveryRecord` | Email delivery tracking for invoices |
| `InvoiceReminderTouchpoint` | Scheduled reminder sends |

### Usage Ledger Details

```prisma
model BillingUsageLedger {
  id               String    @id @default(uuid())
  billingAccountId String
  featureKey       String
  windowKey        String    // "YYYY-MM" format
  quantity         Int       @default(0)
  limit            Int?
  periodStart      DateTime?
  periodEnd        DateTime?
  metadataJson     Json?

  @@unique([billingAccountId, featureKey, windowKey])
}
```

- `featureKey` matches `UsageLimitKey` values
- `windowKey` is a `YYYY-MM` string for monthly tracking
- `quantity` is incremented atomically via Prisma's `upsert` with `increment`
- `active_workspaces` is not stored here — it is computed live via `prisma.deal.count()`

## React Feature Gate Pattern

Pass entitlements from server components to client components. Do not call entitlement APIs from the client.

```tsx
// In a server component or page:
const viewer = await requireViewer();
const entitlements = await getViewerEntitlements(viewer);

<ClientComponent
  hasFeature={entitlements.features.brief_generation}
  usage={entitlements.usage.brief_generations_monthly}
/>

// In the client component:
function ClientComponent({ hasFeature, usage }: {
  hasFeature: boolean;
  usage: { used: number; limit: number | null; remaining: number | null };
}) {
  if (!hasFeature) {
    return <UpgradePrompt currentTier={entitlements.effectiveTier} />;
  }

  return (
    <div>
      <p>{usage.used} / {usage.limit ?? "∞"} used</p>
      {/* Feature content */}
    </div>
  );
}
```

## File Structure

HelloBrand's entitlement-related files:

```txt
lib/
  auth.ts                           # requireViewer, requireApiViewer, getCurrentViewer
  billing/
    config.ts                       # Env vars, dev overrides, Stripe price ID resolution
    entitlements.ts                  # FEATURE_MATRIX, USAGE_LIMIT_MATRIX, getViewerEntitlements, assert*
    rules.ts                        # resolveEffectiveEntitlementTier, isActiveBillingSubscriptionStatus
    plans.ts                        # Plan catalog (names, prices, marketing copy)
    service.ts                      # Checkout, portal, reconciliation, webhook lifecycle
    reconciliation-rules.ts         # Stripe-to-Prisma merge logic
    insights.ts                     # Billing insights (cost vs. earnings)
prisma/schema/
  billing.prisma                    # BillingAccount, BillingSubscription, BillingUsageLedger, etc.
app/api/stripe/
  webhook/route.ts                  # Stripe webhook handler
  checkout/route.ts                 # Checkout session creation
  portal/route.ts                   # Billing portal session
```

## Adding a New Gated Feature Checklist

When adding a new tier-gated feature:

1. **Define the feature key** in `FeatureKey` type and `FEATURE_MATRIX` in `lib/billing/entitlements.ts`
2. **Add usage limit** (if metered) in `UsageLimitKey` type and `USAGE_LIMIT_MATRIX`
3. **Add to Prisma** if the feature needs its own data model
4. **Enforce in API routes** using `assertViewerHasFeature()` and `assertViewerWithinUsageLimit()`
5. **Record usage** after success using `recordViewerUsage()`
6. **Gate in React** by passing `entitlements.features.*` and `entitlements.usage.*` from server to client
7. **Add to feature flags** in `flags.ts` if the feature also needs a LaunchDarkly rollout gate
8. **Add translations** for upgrade prompts and usage displays in `messages/en.json` (and `es.json`, `fr.json`)
9. **Update the assistant** page manual and suggested prompts if the feature adds new UI
10. **Add E2E tests** across the tier matrix (free blocked, basic allowed, premium allowed)
11. **Update `AGENTS.md`** if the feature adds new directories or major API routes

## Common Mistakes

Avoid:

- Trusting React feature gates as security.
- Checking Stripe directly inside every request.
- Using Stripe product names as plan identifiers.
- Forgetting webhook signature verification.
- Incrementing usage before the operation succeeds.
- Not handling `past_due`, `canceled`, and `incomplete` subscription states.
- Letting client-provided data bypass ownership checks — always use `getDealForViewer()` or `requireApiViewer()`.
- Hardcoding plan rules in multiple places — keep them in `FEATURE_MATRIX` and `USAGE_LIMIT_MATRIX`.
- Forgetting admin overrides for manual enterprise deals.
- Calling entitlement APIs from client components — resolve on the server and pass down.

## Best Practices

- Keep tier defaults in one typed config (`lib/billing/entitlements.ts`).
- Store Stripe IDs and subscription state in Prisma (`BillingAccount`).
- Use Stripe webhooks to sync billing state into the app.
- Enforce every important entitlement on the server.
- Use Prisma `upsert` with `increment` for atomic usage counter updates.
- Use Clerk for identity, but verify ownership in your database.
- Show usage before users hit limits.
- Return helpful `403` and `429` responses with upgrade hints.
- Add tests for every plan and every major gated action.

## Testing Checklist

Test these scenarios for any gated feature:

- Free user cannot access paid-only features.
- Basic user can access Basic features but not Premium.
- Premium user can access all features.
- Usage limit blocks after the maximum is reached.
- Usage increments only after successful completion.
- Stripe subscription created updates billing account plan.
- Stripe subscription updated changes billing account plan.
- Stripe subscription deleted downgrades billing account.
- Past-due subscription follows the grace-period policy.
- User cannot access another user's workspace entitlements.
- React gate matches server-side behavior.
- E2E tier cookie override works for automated tests.
- Feature flag can independently disable a feature regardless of tier.
