import type Stripe from "stripe";
import { BillingWebhookEventStatus } from "@prisma/client";

import { fail, ok } from "@/lib/http";
import {
  beginStripeWebhookProcessing,
  completeStripeWebhookProcessing,
  failStripeWebhookProcessing,
  getStripeSubscriptionById,
  getStripeWebhookEvent,
  reconcileStripeCheckoutSession,
  reconcileStripeInvoicePaymentFailure,
  reconcileStripeSubscription
} from "@/lib/billing/service";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return fail("Missing Stripe signature.", 400);
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeWebhookEvent(payload, signature);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not verify Stripe webhook.",
      400
    );
  }

  let processingState;
  try {
    processingState = await beginStripeWebhookProcessing(event);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not initialize Stripe webhook processing.",
      500,
      {
        error,
        area: "billing",
        name: "stripe_webhook_initialize",
        tags: {
          stripeEventType: event.type
        },
        extras: {
          eventId: event.id
        }
      }
    );
  }

  if (processingState.alreadyFinalized) {
    return ok({ received: true, duplicate: true });
  }

  let finalStatus: BillingWebhookEventStatus = BillingWebhookEventStatus.ignored;

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await reconcileStripeCheckoutSession(
          event.data.object as Stripe.Checkout.Session
        );
        finalStatus = BillingWebhookEventStatus.processed;
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await reconcileStripeSubscription(
          event.data.object as Stripe.Subscription
        );
        finalStatus = BillingWebhookEventStatus.processed;
        break;
      case "invoice.payment_failed":
        await reconcileStripeInvoicePaymentFailure(
          event.data.object as Stripe.Invoice
        );
        finalStatus = BillingWebhookEventStatus.processed;
        break;
      case "invoice.paid":
        {
          const invoice = event.data.object as Stripe.Invoice;
          const legacyInvoice = invoice as unknown as Record<string, unknown>;
          const legacySubscription =
            "subscription" in legacyInvoice
              ? legacyInvoice.subscription
              : null;
          const subscriptionDetails =
            invoice.parent?.type === "subscription_details"
              ? invoice.parent.subscription_details
              : null;
          const subscriptionId =
            typeof legacySubscription === "string"
              ? legacySubscription
              : legacySubscription &&
                  typeof legacySubscription === "object" &&
                  "id" in legacySubscription &&
                  typeof legacySubscription.id === "string"
                ? legacySubscription.id
                : subscriptionDetails
                  ? typeof subscriptionDetails.subscription === "string"
                    ? subscriptionDetails.subscription
                    : subscriptionDetails.subscription.id
                  : null;

          if (subscriptionId) {
            const subscription = await getStripeSubscriptionById(subscriptionId);
            if (subscription) {
              await reconcileStripeSubscription(subscription);
              finalStatus = BillingWebhookEventStatus.processed;
            }
          }
        }
        break;
      default:
        break;
    }

    await completeStripeWebhookProcessing(event.id, finalStatus);
    return ok({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe webhook processing failed.";

    try {
      await failStripeWebhookProcessing(event.id, message);
    } catch {}

    return fail(
      message,
      500,
      {
        error,
        area: "billing",
        name: "stripe_webhook_process",
        tags: {
          stripeEventType: event.type
        },
        extras: {
          eventId: event.id,
          finalStatus
        }
      }
    );
  }
}
