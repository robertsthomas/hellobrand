import {
  Prisma,
  BillingProvider,
  BillingInterval,
  BillingTrialStatus,
  BillingSubscriptionStatus,
  BillingWebhookEventStatus,
  PlanTier,
  type BillingAccount,
  type BillingSubscription,
  type BillingTrialLedger
} from "@prisma/client";
import Stripe from "stripe";

import {
  buildPlanAvailability,
  type BillingOverview
} from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import type { Viewer } from "@/lib/types";
import {
  getBillingBaseUrl,
  getStripePriceId,
  getStripeSecretKey,
  getStripeWebhookSecret,
  isStripeConfigured
} from "@/lib/billing/config";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<BillingSubscriptionStatus>([
  BillingSubscriptionStatus.active,
  BillingSubscriptionStatus.trialing,
  BillingSubscriptionStatus.past_due,
  BillingSubscriptionStatus.paused
]);

let stripeClient: Stripe | null = null;

type BillingAccountWithHistory = BillingAccount & {
  subscriptions: BillingSubscription[];
  trialLedgers: BillingTrialLedger[];
};

type TrialOffer = {
  days: number;
  source: string;
};

type StripeWebhookProcessingState = {
  alreadyFinalized: boolean;
};

function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export async function getStripeSubscriptionById(subscriptionId: string) {
  return getStripeClient().subscriptions.retrieve(subscriptionId);
}

export async function createBillingPortalSessionForViewer(viewer: Viewer) {
  const billingAccount = await ensureBillingAccount(viewer);
  const stripeCustomerId = await ensureStripeCustomer(viewer, billingAccount);
  const baseUrl = getBillingBaseUrl();

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/app/billing`
  });

  if (!session.url) {
    throw new Error("Stripe billing portal did not return a redirect URL.");
  }

  return {
    url: session.url
  };
}

export function getStripeWebhookEvent(payload: string, signature: string) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  return getStripeClient().webhooks.constructEvent(payload, signature, webhookSecret);
}

function isKnownBillingSetupError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("does not exist") ||
      error.message.includes("BillingAccount") ||
      error.message.includes("BillingSubscription") ||
      error.message.includes("BillingTrialLedger"))
  );
}

async function findBillingAccountWithHistory(userId: string) {
  return prisma.billingAccount.findUnique({
    where: { userId },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 10
      },
      trialLedgers: {
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });
}

async function ensureBillingAccount(viewer: Viewer) {
  const existing = await prisma.billingAccount.findUnique({
    where: { userId: viewer.id }
  });

  if (existing) {
    if (existing.billingEmail !== viewer.email) {
      return prisma.billingAccount.update({
        where: { id: existing.id },
        data: { billingEmail: viewer.email }
      });
    }

    return existing;
  }

  return prisma.billingAccount.create({
    data: {
      userId: viewer.id,
      billingEmail: viewer.email
    }
  });
}

async function ensureBillingAccountForStripeCustomer(
  customerId: string,
  customer?: Stripe.Customer | Stripe.DeletedCustomer | null
) {
  const existing = await prisma.billingAccount.findFirst({
    where: { stripeCustomerId: customerId }
  });

  if (existing) {
    return existing;
  }

  const resolvedCustomer =
    customer ??
    (await getStripeClient().customers.retrieve(customerId).catch(() => null));

  if (!resolvedCustomer || resolvedCustomer.deleted) {
    throw new Error("Stripe customer could not be resolved.");
  }

  const clerkUserId = resolvedCustomer.metadata?.clerkUserId?.trim();
  if (!clerkUserId) {
    throw new Error("Stripe customer is missing clerkUserId metadata.");
  }

  return prisma.billingAccount.upsert({
    where: { userId: clerkUserId },
    update: {
      stripeCustomerId: customerId,
      billingEmail: resolvedCustomer.email ?? undefined
    },
    create: {
      userId: clerkUserId,
      provider: BillingProvider.stripe,
      stripeCustomerId: customerId,
      billingEmail: resolvedCustomer.email ?? null
    }
  });
}

async function ensureStripeCustomer(
  viewer: Viewer,
  billingAccount: BillingAccount
) {
  if (billingAccount.stripeCustomerId) {
    return billingAccount.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: viewer.email,
    name: viewer.displayName,
    metadata: {
      clerkUserId: viewer.id
    }
  });

  await prisma.billingAccount.update({
    where: { id: billingAccount.id },
    data: {
      stripeCustomerId: customer.id,
      billingEmail: viewer.email
    }
  });

  return customer.id;
}

function hasUsedTrialForPlan(
  billingAccount: BillingAccountWithHistory | null,
  planTier: PlanTier
) {
  return billingAccount?.trialLedgers.some((entry) => entry.planTier === planTier) ?? false;
}

function getTrialOffer(
  billingAccount: BillingAccountWithHistory | null,
  planTier: PlanTier
): TrialOffer | null {
  if (hasUsedTrialForPlan(billingAccount, planTier)) {
    return null;
  }

  const isPremiumUpsell =
    planTier === PlanTier.premium &&
    billingAccount?.currentSubscriptionStatus === BillingSubscriptionStatus.active &&
    (billingAccount.currentPlanTier === PlanTier.basic ||
      billingAccount.currentPlanTier === PlanTier.standard);

  if (isPremiumUpsell) {
    return {
      days: 14,
      source: "premium_paid_upsell"
    };
  }

  return {
    days: planTier === PlanTier.premium ? 7 : 14,
    source: "new_plan_trial"
  };
}

function assertPlanSelection(
  billingAccount: BillingAccountWithHistory | null,
  requestedPlanTier: PlanTier
) {
  if (
    billingAccount?.currentPlanTier === requestedPlanTier &&
    billingAccount.currentSubscriptionStatus &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(billingAccount.currentSubscriptionStatus)
  ) {
    throw new Error(`You are already on the ${requestedPlanTier} plan.`);
  }

  if (
    billingAccount?.currentPlanTier &&
    billingAccount.currentPlanTier !== requestedPlanTier &&
    billingAccount.currentSubscriptionStatus &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(billingAccount.currentSubscriptionStatus)
  ) {
    throw new Error(
      "Plan changes for active subscriptions will use the billing portal once it is enabled."
    );
  }
}

export async function getBillingOverviewForViewer(
  viewer: Viewer
): Promise<BillingOverview> {
  const stripeConfigured = isStripeConfigured();
  const planCatalog = buildPlanAvailability();

  try {
    const billingAccount = await findBillingAccountWithHistory(viewer.id);

    return {
      stripeConfigured,
      billingReady: true,
      billingErrorMessage: null,
      currentPlanTier: billingAccount?.currentPlanTier ?? null,
      currentPlanInterval: billingAccount?.currentPlanInterval ?? null,
      currentSubscriptionStatus: billingAccount?.currentSubscriptionStatus ?? null,
      currentTrialPlanTier: billingAccount?.currentTrialPlanTier ?? null,
      currentTrialEndsAt: billingAccount?.currentTrialEndsAt?.toISOString() ?? null,
      planCatalog,
      hasActiveSubscription: Boolean(
        billingAccount?.currentSubscriptionStatus &&
          ACTIVE_SUBSCRIPTION_STATUSES.has(billingAccount.currentSubscriptionStatus)
      )
    };
  } catch (error) {
    if (!isKnownBillingSetupError(error)) {
      throw error;
    }

    return {
      stripeConfigured,
      billingReady: false,
      billingErrorMessage:
        "Billing tables are not available yet. Apply the latest Prisma migration before testing billing flows.",
      currentPlanTier: null,
      currentPlanInterval: null,
      currentSubscriptionStatus: null,
      currentTrialPlanTier: null,
      currentTrialEndsAt: null,
      planCatalog,
      hasActiveSubscription: false
    };
  }
}

export async function createCheckoutSessionForViewer(
  viewer: Viewer,
  input: {
    planTier: PlanTier;
    interval: BillingInterval;
  }
) {
  const billingAccount = await ensureBillingAccount(viewer);
  const billingAccountWithHistory = await findBillingAccountWithHistory(viewer.id);
  assertPlanSelection(billingAccountWithHistory, input.planTier);

  const stripeCustomerId = await ensureStripeCustomer(viewer, billingAccount);
  const priceId = getStripePriceId(input.planTier, input.interval);
  const trialOffer = getTrialOffer(billingAccountWithHistory, input.planTier);
  const stripe = getStripeClient();
  const baseUrl = getBillingBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: viewer.id,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: `${baseUrl}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/app/billing?checkout=canceled`,
    allow_promotion_codes: true,
    metadata: {
      clerkUserId: viewer.id,
      requestedPlanTier: input.planTier,
      requestedInterval: input.interval,
      trialSource: trialOffer?.source ?? ""
    },
    subscription_data: {
      metadata: {
        clerkUserId: viewer.id,
        requestedPlanTier: input.planTier,
        requestedInterval: input.interval,
        trialSource: trialOffer?.source ?? ""
      },
      ...(trialOffer ? { trial_period_days: trialOffer.days } : {})
    }
  });

  if (!session.url) {
    throw new Error("Stripe checkout did not return a redirect URL.");
  }

  await prisma.billingSubscription.create({
    data: {
      billingAccountId: billingAccount.id,
      planTier: input.planTier,
      interval: input.interval,
      status: BillingSubscriptionStatus.incomplete,
      stripeCustomerId,
      stripePriceId: priceId,
      stripeCheckoutSessionId: session.id,
      metadataJson: {
        requestedPlanTier: input.planTier,
        requestedInterval: input.interval,
        trialDays: trialOffer?.days ?? null,
        trialSource: trialOffer?.source ?? null
      }
    }
  });

  return {
    url: session.url
  };
}

export async function beginStripeWebhookProcessing(
  event: Stripe.Event
): Promise<StripeWebhookProcessingState> {
  const existing = await prisma.billingWebhookEvent.findUnique({
    where: { stripeEventId: event.id }
  });

  if (
    existing &&
    (existing.status === BillingWebhookEventStatus.processed ||
      existing.status === BillingWebhookEventStatus.ignored)
  ) {
    await prisma.billingWebhookEvent.update({
      where: { id: existing.id },
      data: {
        lastReceivedAt: new Date(),
        processingRuns: { increment: 1 }
      }
    });

    return {
      alreadyFinalized: true
    };
  }

  const payloadJson = event as unknown as Prisma.InputJsonValue;

  if (existing) {
    await prisma.billingWebhookEvent.update({
      where: { id: existing.id },
      data: {
        stripeEventType: event.type,
        apiVersion: event.api_version ?? null,
        livemode: event.livemode,
        payloadJson,
        status: BillingWebhookEventStatus.processing,
        errorMessage: null,
        lastReceivedAt: new Date(),
        processingRuns: { increment: 1 }
      }
    });
  } else {
    await prisma.billingWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        apiVersion: event.api_version ?? null,
        livemode: event.livemode,
        payloadJson,
        status: BillingWebhookEventStatus.processing,
        processingRuns: 1
      }
    });
  }

  return {
    alreadyFinalized: false
  };
}

export async function completeStripeWebhookProcessing(
  eventId: string,
  status: BillingWebhookEventStatus
) {
  await prisma.billingWebhookEvent.update({
    where: { stripeEventId: eventId },
    data: {
      status,
      processedAt: new Date(),
      errorMessage: null
    }
  });
}

export async function failStripeWebhookProcessing(eventId: string, errorMessage: string) {
  await prisma.billingWebhookEvent.update({
    where: { stripeEventId: eventId },
    data: {
      status: BillingWebhookEventStatus.failed,
      errorMessage,
      processedAt: null
    }
  });
}

function coercePlanTier(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return Object.values(PlanTier).includes(value as PlanTier) ? (value as PlanTier) : null;
}

function coerceBillingInterval(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return Object.values(BillingInterval).includes(value as BillingInterval)
    ? (value as BillingInterval)
    : null;
}

function coerceSubscriptionStatus(value: string | null | undefined) {
  if (!value) {
    return BillingSubscriptionStatus.incomplete;
  }

  return Object.values(BillingSubscriptionStatus).includes(
    value as BillingSubscriptionStatus
  )
    ? (value as BillingSubscriptionStatus)
    : BillingSubscriptionStatus.incomplete;
}

function timestampToDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

async function findProvisionalBillingSubscription(
  billingAccountId: string,
  stripeCustomerId: string,
  planTier: PlanTier,
  interval: BillingInterval
) {
  return prisma.billingSubscription.findFirst({
    where: {
      billingAccountId,
      stripeCustomerId,
      stripeSubscriptionId: null,
      planTier,
      interval,
      status: BillingSubscriptionStatus.incomplete
    },
    orderBy: [{ createdAt: "desc" }]
  });
}

function currentPeriodRange(subscription: Stripe.Subscription) {
  const legacySubscription = subscription as unknown as Record<string, unknown>;
  const legacyStart =
    "current_period_start" in legacySubscription &&
    typeof legacySubscription.current_period_start === "number"
      ? (legacySubscription.current_period_start as number)
      : null;
  const legacyEnd =
    "current_period_end" in legacySubscription &&
    typeof legacySubscription.current_period_end === "number"
      ? (legacySubscription.current_period_end as number)
      : null;
  const starts = subscription.items.data
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === "number");
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  return {
    start: starts.length > 0 ? Math.min(...starts) : legacyStart,
    end: ends.length > 0 ? Math.max(...ends) : legacyEnd
  };
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const legacyInvoice = invoice as unknown as Record<string, unknown>;
  const legacySubscription =
    "subscription" in legacyInvoice
      ? legacyInvoice.subscription
      : null;

  if (typeof legacySubscription === "string") {
    return legacySubscription;
  }

  if (
    legacySubscription &&
    typeof legacySubscription === "object" &&
    "id" in legacySubscription &&
    typeof legacySubscription.id === "string"
  ) {
    return legacySubscription.id;
  }

  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details" || !parent.subscription_details) {
    return null;
  }

  const subscription = parent.subscription_details.subscription;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function planTierFromSubscription(
  subscription: Stripe.Subscription,
  existing?: BillingSubscription | null
) {
  return (
    coercePlanTier(subscription.metadata?.requestedPlanTier) ??
    coercePlanTier(existing?.planTier ?? null)
  );
}

function intervalFromSubscription(
  subscription: Stripe.Subscription,
  existing?: BillingSubscription | null
) {
  const item = subscription.items.data[0];
  const stripeInterval = item?.price?.recurring?.interval;

  if (stripeInterval === "month" || stripeInterval === "year") {
    return stripeInterval as BillingInterval;
  }

  return (
    coerceBillingInterval(subscription.metadata?.requestedInterval) ??
    coerceBillingInterval(existing?.interval ?? null) ??
    BillingInterval.month
  );
}

async function syncTrialLedgerForSubscription(
  billingAccountId: string,
  billingSubscriptionId: string,
  subscription: BillingSubscription
) {
  const startedAt = subscription.trialStartedAt;
  const endsAt = subscription.trialEndsAt;

  const latest = await prisma.billingTrialLedger.findFirst({
    where: {
      billingAccountId,
      billingSubscriptionId,
      planTier: subscription.planTier
    },
    orderBy: { createdAt: "desc" }
  });

  if (subscription.status === BillingSubscriptionStatus.trialing && startedAt && endsAt) {
    if (latest) {
      await prisma.billingTrialLedger.update({
        where: { id: latest.id },
        data: {
          status: BillingTrialStatus.active,
          startedAt,
          endsAt,
          canceledAt: null,
          expiredAt: null,
          convertedAt: null,
          metadataJson: {
            ...(typeof latest.metadataJson === "object" && latest.metadataJson ? latest.metadataJson : {}),
            source: latest.source
          }
        }
      });
      return;
    }

    await prisma.billingTrialLedger.create({
      data: {
        billingAccountId,
        billingSubscriptionId,
        planTier: subscription.planTier,
        source:
          typeof subscription.metadataJson === "object" &&
          subscription.metadataJson &&
          "trialSource" in subscription.metadataJson &&
          typeof subscription.metadataJson.trialSource === "string"
            ? subscription.metadataJson.trialSource
            : "stripe_trial",
        status: BillingTrialStatus.active,
        startedAt,
        endsAt,
        metadataJson: subscription.metadataJson ?? undefined
      }
    });
    return;
  }

  if (!latest) {
    return;
  }

  if (subscription.status === BillingSubscriptionStatus.active) {
    await prisma.billingTrialLedger.update({
      where: { id: latest.id },
      data: {
        status: BillingTrialStatus.converted,
        convertedAt: latest.convertedAt ?? new Date(),
        expiredAt: null,
        canceledAt: null
      }
    });
    return;
  }

  if (endsAt && endsAt.getTime() <= Date.now()) {
    await prisma.billingTrialLedger.update({
      where: { id: latest.id },
      data: {
        status: BillingTrialStatus.expired,
        expiredAt: latest.expiredAt ?? new Date(),
        canceledAt: null
      }
    });
    return;
  }

  if (
    subscription.status === BillingSubscriptionStatus.canceled ||
    subscription.status === BillingSubscriptionStatus.incomplete_expired ||
    subscription.status === BillingSubscriptionStatus.unpaid
  ) {
    await prisma.billingTrialLedger.update({
      where: { id: latest.id },
      data: {
        status: BillingTrialStatus.canceled,
        canceledAt: latest.canceledAt ?? new Date()
      }
    });
  }
}

async function refreshBillingAccountSnapshot(billingAccountId: string) {
  const subscriptions = await prisma.billingSubscription.findMany({
    where: { billingAccountId },
    orderBy: [{ createdAt: "desc" }]
  });

  const current =
    subscriptions.find((entry) => ACTIVE_SUBSCRIPTION_STATUSES.has(entry.status)) ??
    subscriptions[0] ??
    null;

  const trial = await prisma.billingTrialLedger.findFirst({
    where: {
      billingAccountId,
      status: BillingTrialStatus.active
    },
    orderBy: { endsAt: "desc" }
  });

  await prisma.billingAccount.update({
    where: { id: billingAccountId },
    data: {
      currentPlanTier: current?.planTier ?? null,
      currentPlanInterval: current?.interval ?? null,
      currentSubscriptionStatus: current?.status ?? null,
      currentTrialPlanTier: trial?.planTier ?? null,
      currentTrialStartedAt: trial?.startedAt ?? null,
      currentTrialEndsAt: trial?.endsAt ?? null,
      currentPeriodStart: current?.currentPeriodStart ?? null,
      currentPeriodEnd: current?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: current?.cancelAtPeriodEnd ?? false,
      lastSyncedAt: new Date()
    }
  });
}

export async function reconcileStripeCheckoutSession(
  session: Stripe.Checkout.Session
) {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!customerId) {
    throw new Error("Checkout session is missing a Stripe customer.");
  }

  const billingAccount = await ensureBillingAccountForStripeCustomer(customerId);
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;
  const provisional = await prisma.billingSubscription.findFirst({
    where: {
      billingAccountId: billingAccount.id,
      stripeCheckoutSessionId: session.id
    },
    orderBy: [{ createdAt: "desc" }]
  });
  const existing =
    stripeSubscriptionId
      ? await prisma.billingSubscription.findUnique({
          where: { stripeSubscriptionId }
        })
      : null;

  const status =
    session.payment_status === "paid"
      ? BillingSubscriptionStatus.active
      : BillingSubscriptionStatus.incomplete;

  if (existing) {
    await prisma.billingSubscription.update({
      where: { id: existing.id },
      data: {
        stripeCustomerId: customerId,
        stripeCheckoutSessionId: session.id,
        status
      }
    });

    if (provisional && provisional.id !== existing.id) {
      await prisma.billingSubscription.delete({
        where: { id: provisional.id }
      });
    }
  } else if (provisional) {
    await prisma.billingSubscription.update({
      where: { id: provisional.id },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId,
        status
      }
    });
  } else if (stripeSubscriptionId) {
    await prisma.billingSubscription.create({
      data: {
        billingAccountId: billingAccount.id,
        provider: BillingProvider.stripe,
        planTier:
          coercePlanTier(session.metadata?.requestedPlanTier) ?? PlanTier.basic,
        interval:
          coerceBillingInterval(session.metadata?.requestedInterval) ??
          BillingInterval.month,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId,
        stripeCheckoutSessionId: session.id,
        metadataJson: session.metadata ?? undefined
      }
    });
  }

  await prisma.billingAccount.update({
    where: { id: billingAccount.id },
    data: {
      stripeCustomerId: customerId,
      lastSyncedAt: new Date()
    }
  });
}

export async function reconcileStripeSubscription(
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    throw new Error("Subscription is missing a Stripe customer.");
  }

  const billingAccount = await ensureBillingAccountForStripeCustomer(customerId);
  const existing = subscription.id
    ? await prisma.billingSubscription.findUnique({
        where: { stripeSubscriptionId: subscription.id }
      })
    : null;

  const planTier = planTierFromSubscription(subscription, existing);
  if (!planTier) {
    throw new Error("Could not determine plan tier from Stripe subscription metadata.");
  }

  const interval = intervalFromSubscription(subscription, existing);
  const period = currentPeriodRange(subscription);
  const priceId = subscription.items.data[0]?.price?.id ?? existing?.stripePriceId ?? null;
  const productId =
    typeof subscription.items.data[0]?.price?.product === "string"
      ? subscription.items.data[0]?.price?.product
      : existing?.stripeProductId ?? null;
  const provisional =
    existing ??
    (await findProvisionalBillingSubscription(
      billingAccount.id,
      customerId,
      planTier,
      interval
    ));
  const saved = provisional
    ? await prisma.billingSubscription.update({
        where: { id: provisional.id },
        data: {
          billingAccountId: billingAccount.id,
          provider: BillingProvider.stripe,
          planTier,
          interval,
          status: coerceSubscriptionStatus(subscription.status),
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
          stripeProductId: productId,
          stripePriceId: priceId,
          startedAt: timestampToDate(subscription.start_date),
          currentPeriodStart: timestampToDate(period.start),
          currentPeriodEnd: timestampToDate(period.end),
          trialStartedAt: timestampToDate(subscription.trial_start),
          trialEndsAt: timestampToDate(subscription.trial_end),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: timestampToDate(subscription.canceled_at),
          endedAt: timestampToDate(subscription.ended_at),
          latestInvoiceId:
            typeof subscription.latest_invoice === "string"
              ? subscription.latest_invoice
              : subscription.latest_invoice?.id ?? null,
          metadataJson: subscription.metadata
        }
      })
    : await prisma.billingSubscription.create({
        data: {
          billingAccountId: billingAccount.id,
          provider: BillingProvider.stripe,
          planTier,
          interval,
          status: coerceSubscriptionStatus(subscription.status),
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
          stripeProductId: productId,
          stripePriceId: priceId,
          startedAt: timestampToDate(subscription.start_date),
          currentPeriodStart: timestampToDate(period.start),
          currentPeriodEnd: timestampToDate(period.end),
          trialStartedAt: timestampToDate(subscription.trial_start),
          trialEndsAt: timestampToDate(subscription.trial_end),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: timestampToDate(subscription.canceled_at),
          endedAt: timestampToDate(subscription.ended_at),
          latestInvoiceId:
            typeof subscription.latest_invoice === "string"
              ? subscription.latest_invoice
              : subscription.latest_invoice?.id ?? null,
          metadataJson: subscription.metadata
        }
      });

  await syncTrialLedgerForSubscription(billingAccount.id, saved.id, saved);
  await refreshBillingAccountSnapshot(billingAccount.id);

  return saved;
}

export async function reconcileStripeInvoicePaymentFailure(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    return null;
  }

  const existing = await prisma.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId }
  });

  if (!existing) {
    return null;
  }

  const saved = await prisma.billingSubscription.update({
    where: { id: existing.id },
    data: {
      status: BillingSubscriptionStatus.past_due,
      latestInvoiceId: invoice.id,
      metadataJson: {
        ...(typeof existing.metadataJson === "object" && existing.metadataJson ? existing.metadataJson : {}),
        lastPaymentFailureAt: new Date().toISOString()
      }
    }
  });

  await refreshBillingAccountSnapshot(saved.billingAccountId);
  return saved;
}
