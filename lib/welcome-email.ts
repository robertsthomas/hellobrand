/**
 * This file sends transactional welcome emails after account creation.
 * It keeps Resend-specific delivery details out of webhook route handlers.
 */
import {
  canSendNotificationEmailInCurrentMode,
  getNotificationEmailConfig,
} from "@/lib/notification-email";
import { createResendClient } from "@/lib/resend-client";

type WelcomeEmailInput = {
  userId: string;
  email: string;
  firstName?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeFirstName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildWelcomeEmail(input: WelcomeEmailInput) {
  const firstName = normalizeFirstName(input.firstName);
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";
  const textGreeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return {
    subject: "Welcome to HelloBrand",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f6f3ee; padding: 32px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 0; border: 1px solid #e7dfd3;">
          <div style="border-top: 2px solid #1f1a14; padding: 32px;">
            <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.2; color: #1f1a14;">Welcome to HelloBrand</h1>
            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4a4034;">${greeting}</p>
            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4a4034;">Thanks for creating your HelloBrand account. You can now start intake, upload partnership docs, and keep creator deals organized in one workspace.</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #7f6f5a;">We're glad you're here.</p>
          </div>
        </div>
      </div>
    `.trim(),
    text: `${textGreeting}\n\nThanks for creating your HelloBrand account. You can now start intake, upload partnership docs, and keep creator deals organized in one workspace.\n\nWe're glad you're here.`,
  };
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const config = getNotificationEmailConfig();
  if (!config.apiKey) {
    console.warn("Missing RESEND_API_KEY, skipping welcome email.");
    return null;
  }

  if (
    !canSendNotificationEmailInCurrentMode({
      fromEmail: config.fromEmail,
      testToEmail: config.testToEmail,
      recipientEmail: input.email,
    })
  ) {
    console.warn("Recipient is not allowed while Resend test mode is enabled.");
    return null;
  }

  const resend = await createResendClient(config.apiKey);
  const email = buildWelcomeEmail(input);
  const response = await resend.emails.send(
    {
      from: config.fromEmail,
      to: [input.email],
      subject: email.subject,
      html: email.html,
      text: email.text,
    },
    { idempotencyKey: `welcome-email/${input.userId}` }
  );

  if (response.error) {
    console.error("Failed to send welcome email:", response.error.message);
    return null;
  }

  return response.data;
}
