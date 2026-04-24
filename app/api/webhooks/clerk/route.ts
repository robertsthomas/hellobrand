/**
 * This file receives Clerk webhook events and forwards app-level analytics.
 * It verifies the request boundary here and keeps provider-specific behavior out of components.
 */
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { inngest } from "@/lib/inngest/client";
import { capturePostHogServerEvent } from "@/lib/posthog/server";
import { addResendAudienceContact } from "@/lib/resend-audience";
import { sendWaitlistConfirmationEmail } from "@/lib/waitlist-email";
import { sendWelcomeEmail } from "@/lib/welcome-email";

type ClerkUserEmail = {
  id: string;
  email_address: string;
  verification?: {
    status?: string | null;
  } | null;
};

type ClerkUserData = {
  id: string;
  email_addresses?: ClerkUserEmail[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
};

type ClerkWaitlistData = {
  id: string;
  email_address: string;
};

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

function getPrimaryEmail(data: ClerkUserData): ClerkUserEmail | null {
  const emails = data.email_addresses;
  if (!emails?.length) return null;
  return emails.find((email) => email.id === data.primary_email_address_id) ?? emails[0];
}

function isVerifiedOrUnknown(email: ClerkUserEmail) {
  const status = email.verification?.status;
  return !status || status === "verified";
}

function getContactKey(kind: "users" | "waitlist", id: string, email: string) {
  return `${kind}:${id}:${email.toLowerCase()}`;
}

async function syncResendAudienceContact(input: {
  kind: "users" | "waitlist";
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  source: string;
  userId?: string | null;
}) {
  const contactKey = getContactKey(input.kind, input.id, input.email);

  if (hasInngestEventKey()) {
    await inngest.send({
      id: `resend-audience-contact-sync:${contactKey}`,
      name: "resend/audience.contact.sync.requested",
      data: {
        contactKey,
        kind: input.kind,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        source: input.source,
        userId: input.userId,
      },
    });
    return;
  }

  await addResendAudienceContact(input);
}

async function handleWaitlistCreated(data: ClerkWaitlistData) {
  await syncResendAudienceContact({
    kind: "waitlist",
    id: data.id,
    email: data.email_address,
    source: "clerk_waitlist",
  });

  await sendWaitlistConfirmationEmail(data.email_address, {
    idempotencyKey: `waitlist-confirmation/${data.id}`,
  });

  await capturePostHogServerEvent({
    distinctId: data.email_address,
    event: "waitlist_joined",
    properties: {
      $set: { user_group: "Waitlist", source: "clerk_waitlist" },
    },
  });
}

async function handleUserCreated(data: ClerkUserData) {
  const primaryEmail = getPrimaryEmail(data);
  if (!primaryEmail) return;

  await sendWelcomeEmail({
    userId: data.id,
    email: primaryEmail.email_address,
    firstName: data.first_name,
    locale: data.locale,
  });

  await handleUserAudienceSync(data);

  await capturePostHogServerEvent({
    distinctId: data.id,
    event: "user_created",
    properties: {
      email: primaryEmail.email_address,
      $set: { user_group: "User", source: "clerk" },
    },
  });
}

async function handleUserAudienceSync(data: ClerkUserData) {
  const primaryEmail = getPrimaryEmail(data);
  if (!primaryEmail || !isVerifiedOrUnknown(primaryEmail)) return;

  await syncResendAudienceContact({
    kind: "users",
    id: data.id,
    email: primaryEmail.email_address,
    firstName: data.first_name,
    lastName: data.last_name,
    source: "clerk",
    userId: data.id,
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
      case "user.updated":
        await handleUserAudienceSync(data as unknown as ClerkUserData);
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
