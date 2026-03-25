"use server";

import { clerkClient } from "@clerk/nextjs/server";

import { sendWaitlistConfirmationEmail } from "@/lib/waitlist-email";

export async function joinWaitlist(emailAddress: string) {
  try {
    const client = await clerkClient();
    await client.waitlistEntries.create({ emailAddress });

    // Send confirmation email (non-blocking, don't fail the waitlist join if email fails)
    sendWaitlistConfirmationEmail(emailAddress).catch((err) => {
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
