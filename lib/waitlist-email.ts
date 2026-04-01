import { Resend } from "resend";

import { buildEmailSubscriptionHeaders } from "@/lib/email-subscriptions";
import { getNotificationEmailConfig } from "@/lib/notification-email";

export async function sendWaitlistConfirmationEmail(email: string) {
  const config = getNotificationEmailConfig();
  if (!config.apiKey) {
    console.warn("Missing RESEND_API_KEY, skipping waitlist confirmation email.");
    return null;
  }

  const resend = new Resend(config.apiKey);
  const { headers, unsubscribeUrl } = buildEmailSubscriptionHeaders({
    email,
    category: "product_updates"
  });

  const response = await resend.emails.send({
    from: config.fromEmail,
    to: [email],
    subject: "You're on the HelloBrand waitlist!",
    headers,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f6f3ee; padding: 32px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 0; border: 1px solid #e7dfd3;">
          <div style="border-top: 2px solid #1f1a14; padding: 32px;">
            <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.2; color: #1f1a14;">You're on the list!</h1>
            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4a4034;">Thanks for joining the HelloBrand waitlist. We're building the operating layer for creator partnerships, and we'll let you know as soon as we're ready to welcome you in.</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #7f6f5a;">Stay tuned, we'll be in touch soon.</p>
            <p style="margin: 24px 0 0; font-size: 12px; line-height: 1.6; color: #7f6f5a;">Prefer not to get future HelloBrand product updates? <a href="${unsubscribeUrl}" style="color: #7f6f5a;">Unsubscribe</a>.</p>
          </div>
        </div>
      </div>
    `.trim(),
    text: `You're on the list!\n\nThanks for joining the HelloBrand waitlist. We're building the operating layer for creator partnerships, and we'll let you know as soon as we're ready to welcome you in.\n\nStay tuned, we'll be in touch soon.\n\nPrefer not to get future HelloBrand product updates? Unsubscribe: ${unsubscribeUrl}`
  });

  if (response.error) {
    console.error("Failed to send waitlist confirmation email:", response.error.message);
    return null;
  }

  return response.data;
}
