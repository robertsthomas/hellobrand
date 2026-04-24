"use server";

/**
 * This file handles the waitlist signup action.
 * It accepts the action request here and then calls the email and identity helpers that finish the signup flow.
 */
import { clerkClient } from "@clerk/nextjs/server";

import { sendWaitlistConfirmationEmail } from "@/lib/waitlist-email";

function getWaitlistEntryId(value: unknown) {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
    ? value.id
    : null;
}

export async function joinWaitlist(emailAddress: string) {
  try {
    const client = await clerkClient();
    const waitlistEntry = await client.waitlistEntries.create({ emailAddress });
    const waitlistEntryId = getWaitlistEntryId(waitlistEntry);

    // Send confirmation email (non-blocking, don't fail the waitlist join if email fails)
    sendWaitlistConfirmationEmail(emailAddress, {
      idempotencyKey: waitlistEntryId
        ? `waitlist-confirmation/${waitlistEntryId}`
        : `waitlist-confirmation/${emailAddress.trim().toLowerCase()}`,
    }).catch((err) => {
      console.error("Waitlist confirmation email error:", err);
    });

    return { success: true, error: null };
  } catch (err: any) {
    const message =
      err?.errors?.[0]?.longMessage ||
      err?.errors?.[0]?.message ||
      "Something went wrong. Please try again.";
    return { success: false, error: message };
  }
}
