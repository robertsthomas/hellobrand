import { createElement } from "react";

import WaitlistConfirmationEmailTemplate from "@/emails/marketing/waitlist-confirmation-email";
import { renderEmailText } from "@/emails/shared/render";
import { buildEmailSubscriptionHeaders } from "@/lib/email-subscriptions";
import { getNotificationEmailConfig } from "@/lib/notification-email";
import { createResendClient } from "@/lib/resend-client";

type WaitlistConfirmationEmailOptions = {
  idempotencyKey?: string | null;
};

export async function sendWaitlistConfirmationEmail(
  email: string,
  options: WaitlistConfirmationEmailOptions = {}
) {
  const config = getNotificationEmailConfig();
  if (!config.apiKey) {
    console.warn("Missing RESEND_API_KEY, skipping waitlist confirmation email.");
    return null;
  }

  const resend = await createResendClient(config.apiKey);
  const { headers, unsubscribeUrl } = buildEmailSubscriptionHeaders({
    email,
    category: "product_updates",
  });
  const react = createElement(WaitlistConfirmationEmailTemplate, { unsubscribeUrl });
  const text = await renderEmailText(react);

  const payload = {
    from: config.fromEmail,
    to: [email],
    subject: "You're on the HelloBrand waitlist!",
    headers,
    react,
    text,
  };

  const response = options.idempotencyKey
    ? await resend.emails.send(payload, { idempotencyKey: options.idempotencyKey })
    : await resend.emails.send(payload);

  if (response.error) {
    console.error("Failed to send waitlist confirmation email:", response.error.message);
    return null;
  }

  return response.data;
}
