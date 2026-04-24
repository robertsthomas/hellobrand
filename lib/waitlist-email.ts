import { createElement } from "react";
import { render } from "react-email";

import WaitlistConfirmationEmailTemplate from "@/emails/marketing/waitlist-confirmation-email";
import { buildEmailSubscriptionHeaders } from "@/lib/email-subscriptions";
import { getNotificationEmailConfig } from "@/lib/notification-email";
import { createResendClient } from "@/lib/resend-client";

export async function sendWaitlistConfirmationEmail(email: string) {
  const config = getNotificationEmailConfig();
  if (!config.apiKey) {
    console.warn("Missing RESEND_API_KEY, skipping waitlist confirmation email.");
    return null;
  }

  const resend = await createResendClient(config.apiKey);
  const { headers, unsubscribeUrl } = buildEmailSubscriptionHeaders({
    email,
    category: "product_updates"
  });
  const react = createElement(WaitlistConfirmationEmailTemplate, { unsubscribeUrl });
  const text = await render(react, { plainText: true });

  const response = await resend.emails.send({
    from: config.fromEmail,
    to: [email],
    subject: "You're on the HelloBrand waitlist!",
    headers,
    react,
    text
  });

  if (response.error) {
    console.error("Failed to send waitlist confirmation email:", response.error.message);
    return null;
  }

  return response.data;
}
