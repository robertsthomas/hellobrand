/**
 * This file sends transactional welcome emails after account creation.
 * It keeps Resend-specific delivery details out of webhook route handlers.
 */
import { createElement } from "react";

import { resolveEmailLocale } from "@/emails/shared/locale";
import { renderEmailText } from "@/emails/shared/render";
import WelcomeEmailTemplate from "@/emails/transactional/welcome-email";
import { getAppBaseUrl } from "@/lib/email/config";
import {
  canSendNotificationEmailInCurrentMode,
  getNotificationEmailConfig,
} from "@/lib/notification-email";
import { createResendClient } from "@/lib/resend-client";

type WelcomeEmailInput = {
  userId: string;
  email: string;
  firstName?: string | null;
  locale?: string | null;
};

function normalizeFirstName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function buildWelcomeEmail(input: WelcomeEmailInput) {
  const firstName = normalizeFirstName(input.firstName);
  const locale = resolveEmailLocale(input.locale);
  const startWorkspaceUrl = new URL("/app/intake/new", `${getAppBaseUrl()}/`).toString();
  const react = createElement(WelcomeEmailTemplate, {
    firstName,
    locale,
    startWorkspaceUrl,
  });
  const text = await renderEmailText(react);

  return {
    subject: "Hello!",
    react,
    text,
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
  const email = await buildWelcomeEmail(input);
  const response = await resend.emails.send(
    {
      from: config.fromEmail,
      to: [input.email],
      subject: email.subject,
      react: email.react,
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
