/**
 * This file receives Clerk webhook events and forwards app-level analytics.
 * It verifies the request boundary here and keeps provider-specific behavior out of components.
 */
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { capturePostHogServerEvent } from "@/lib/posthog/server";
import { sendWelcomeEmail } from "@/lib/welcome-email";

type ClerkUserEmail = {
  id: string;
  email_address: string;
};

type ClerkUserData = {
  id: string;
  email_addresses?: ClerkUserEmail[];
  first_name?: string | null;
  last_name?: string | null;
};

type ClerkWaitlistData = {
  id: string;
  email_address: string;
};

function getPrimaryEmail(emails?: ClerkUserEmail[]): string | null {
  if (!emails?.length) return null;
  return emails[0].email_address;
}

async function handleWaitlistCreated(data: ClerkWaitlistData) {
  await capturePostHogServerEvent({
    distinctId: data.email_address,
    event: "waitlist_joined",
    properties: {
      $set: { user_group: "Waitlist", source: "clerk_waitlist" },
    },
  });
}

async function handleUserCreated(data: ClerkUserData) {
  const email = getPrimaryEmail(data.email_addresses);
  if (!email) return;

  await sendWelcomeEmail({
    userId: data.id,
    email,
    firstName: data.first_name,
  });

  await capturePostHogServerEvent({
    distinctId: data.id,
    event: "user_created",
    properties: {
      email,
      $set: { user_group: "User", source: "clerk" },
    },
  });
}

// fallow-ignore-next-line complexity
export async function POST(request: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Webhook verification failed.", 400, {
      error,
      area: "webhooks",
      name: "clerk_webhook_verify",
    });
  }

  const { type, data } = evt;

  try {
    switch (type) {
      case "waitlistEntry.created":
        await handleWaitlistCreated(data as unknown as ClerkWaitlistData);
        break;
      case "user.created":
        await handleUserCreated(data as unknown as ClerkUserData);
        break;
      default:
        break;
    }

    return ok({ received: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Clerk webhook processing failed.", 500, {
      error,
      area: "webhooks",
      name: "clerk_webhook_process",
      tags: { eventType: type },
    });
  }
}
