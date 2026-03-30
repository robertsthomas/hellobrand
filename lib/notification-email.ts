import { Resend } from "resend";

import { getAppSettings } from "@/lib/admin-settings";
import { resolveEmailNotificationsEnabled } from "@/lib/email-notification-preference";
import { getAppBaseUrl } from "@/lib/email/config";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

type NotificationEmailStatus = "pending" | "sent" | "failed" | "skipped";

type NotificationWithEmailContext = {
  id: string;
  category: string;
  eventType: string;
  status: string;
  title: string;
  body: string;
  href: string;
  userId: string;
  user: {
    email: string;
    profile: {
      id: string;
      contactEmail: string | null;
      emailNotificationsEnabled: boolean;
      createdAt: Date;
    } | null;
  };
};

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

function normalizeEmail(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolveNotificationRecipient(
  userEmail: string,
  contactEmail: string | null | undefined
) {
  return normalizeEmail(contactEmail) ?? normalizeEmail(userEmail);
}

export function getNotificationEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const testToEmail = normalizeEmail(process.env.RESEND_TEST_TO_EMAIL);
  const testMode = fromEmail.toLowerCase().endsWith("@resend.dev");

  return {
    apiKey,
    fromEmail,
    testToEmail,
    testMode
  };
}

export function canSendNotificationEmailInCurrentMode(input: {
  fromEmail: string;
  testToEmail: string | null;
  recipientEmail: string;
}) {
  const fromEmail = input.fromEmail.trim().toLowerCase();
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  const testMode = fromEmail.endsWith("@resend.dev");

  if (!testMode) {
    return true;
  }

  if (!input.testToEmail) {
    return false;
  }

  return recipientEmail === input.testToEmail.trim().toLowerCase();
}

function toAbsoluteHref(href: string) {
  const baseUrl = getAppBaseUrl();
  return new URL(href, `${baseUrl}/`).toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildNotificationEmailPayload(input: {
  title: string;
  body: string;
  href: string;
}) {
  const absoluteHref = toAbsoluteHref(input.href);
  const escapedTitle = escapeHtml(input.title);
  const escapedBody = escapeHtml(input.body);

  return {
    subject: `HelloBrand: ${input.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f6f3ee; padding: 32px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border: 1px solid #e7dfd3;">
          <p style="margin: 0 0 12px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #7f6f5a;">HelloBrand</p>
          <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.2; color: #1f1a14;">${escapedTitle}</h1>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4a4034;">${escapedBody}</p>
          <a href="${absoluteHref}" style="display: inline-block; background: #1f1a14; color: #ffffff; text-decoration: none; padding: 12px 18px; font-size: 14px;">Open in HelloBrand</a>
        </div>
      </div>
    `.trim(),
    text: `${input.title}\n\n${input.body}\n\nOpen in HelloBrand: ${absoluteHref}`
  };
}

async function loadNotificationWithEmailContext(appNotificationId: string) {
  return prisma.appNotification.findUnique({
    where: { id: appNotificationId },
    select: {
      id: true,
      category: true,
      eventType: true,
      status: true,
      title: true,
      body: true,
      href: true,
      userId: true,
      user: {
        select: {
          email: true,
          profile: {
            select: {
              id: true,
              contactEmail: true,
              emailNotificationsEnabled: true,
              createdAt: true
            }
          }
        }
      }
    }
  }) as Promise<NotificationWithEmailContext | null>;
}

function shouldSendNotificationEmail(notification: NotificationWithEmailContext) {
  if (
    notification.category === "workspace" &&
    notification.eventType.startsWith("workspace.")
  ) {
    return (
      notification.eventType === "workspace.ready_for_review" ||
      notification.eventType === "workspace.failed" ||
      notification.eventType === "workspace.missing_payment" ||
      notification.eventType === "workspace.missing_deliverables" ||
      notification.eventType === "workspace.missing_usage_rights"
    );
  }

  if (notification.category === "inbox") {
    return notification.eventType === "email.resync_required";
  }

  if (notification.category === "payments") {
    return notification.eventType === "invoice.generate_prompt";
  }

  return false;
}

function isTerminalResendError(error: unknown) {
  const status =
    typeof error === "object" && error !== null
      ? Number(
          "statusCode" in error
            ? (error as { statusCode?: unknown }).statusCode
            : "status" in error
              ? (error as { status?: unknown }).status
              : NaN
        )
      : NaN;

  return Number.isFinite(status) && [400, 401, 403, 404, 409, 422].includes(status);
}

async function markDeliveryStatus(
  deliveryId: string,
  status: NotificationEmailStatus,
  input?: {
    errorMessage?: string | null;
    providerMessageId?: string | null;
    sentAt?: Date | null;
  }
) {
  return prisma.notificationEmailDelivery.update({
    where: { id: deliveryId },
    data: {
      status,
      errorMessage: input?.errorMessage ?? null,
      providerMessageId: input?.providerMessageId ?? null,
      sentAt: input?.sentAt ?? null
    }
  });
}

export async function enqueueNotificationEmailDelivery(appNotificationId: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const appSettings = await getAppSettings();
  if (!appSettings.emailDeliveryEnabled) {
    return null;
  }

  const notification = await loadNotificationWithEmailContext(appNotificationId);
  if (
    !notification ||
    !shouldSendNotificationEmail(notification) ||
    notification.status !== "active"
  ) {
    return null;
  }

  const profile = notification.user.profile;
  const emailNotificationsEnabled = await resolveEmailNotificationsEnabled(profile);
  if (!emailNotificationsEnabled) {
    return null;
  }

  const recipientEmail = resolveNotificationRecipient(
    notification.user.email,
    profile?.contactEmail ?? null
  );

  if (!recipientEmail) {
    return null;
  }

  const existing = await prisma.notificationEmailDelivery.findUnique({
    where: { appNotificationId }
  });

  if (existing?.status === "sent" || existing?.status === "skipped" || existing?.status === "pending") {
    return existing;
  }

  const delivery = existing
    ? await prisma.notificationEmailDelivery.update({
        where: { id: existing.id },
        data: {
          recipientEmail,
          provider: "resend",
          status: "pending",
          errorMessage: null,
          providerMessageId: null,
          sentAt: null
        }
      })
    : await prisma.notificationEmailDelivery.create({
        data: {
          appNotificationId,
          userId: notification.userId,
          recipientEmail,
          provider: "resend",
          status: "pending"
        }
      });

  if (hasInngestEventKey()) {
    await inngest.send({
      name: "notification/email.send.requested",
      data: { appNotificationId, eventType: notification.eventType }
    });
    return delivery;
  }

  await sendNotificationEmailDelivery(appNotificationId);
  return prisma.notificationEmailDelivery.findUnique({
    where: { id: delivery.id }
  });
}

export async function sendNotificationEmailDelivery(appNotificationId: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const delivery = await prisma.notificationEmailDelivery.findUnique({
    where: { appNotificationId },
    include: {
      appNotification: {
        select: {
          id: true,
          category: true,
          eventType: true,
          status: true,
          title: true,
          body: true,
          href: true
        }
      }
    }
  });

  if (!delivery) {
    return null;
  }

  if (delivery.status === "sent" || delivery.status === "skipped") {
    return delivery;
  }

  const notification = delivery.appNotification;
  if (
    !notification ||
    !shouldSendNotificationEmail({
      ...notification,
      userId: delivery.userId,
      user: {
        email: "",
        profile: null
      }
    }) ||
    notification.status !== "active"
  ) {
    return markDeliveryStatus(delivery.id, "skipped", {
      errorMessage: "Notification is no longer eligible for email delivery."
    });
  }

  const config = getNotificationEmailConfig();
  if (!config.apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!canSendNotificationEmailInCurrentMode({
    fromEmail: config.fromEmail,
    testToEmail: config.testToEmail,
    recipientEmail: delivery.recipientEmail
  })) {
    return markDeliveryStatus(delivery.id, "skipped", {
      errorMessage:
        config.testMode && !config.testToEmail
          ? "Missing RESEND_TEST_TO_EMAIL for resend.dev test mode."
          : "Recipient is not allowed while resend.dev test mode is enabled."
    });
  }

  const resend = new Resend(config.apiKey);
  const email = buildNotificationEmailPayload({
    title: notification.title,
    body: notification.body,
    href: notification.href
  });

  const response = await resend.emails.send({
    from: config.fromEmail,
    to: [delivery.recipientEmail],
    subject: email.subject,
    html: email.html,
    text: email.text
  });

  if (response.error) {
    const failed = await markDeliveryStatus(delivery.id, "failed", {
      errorMessage: response.error.message
    });

    if (isTerminalResendError(response.error)) {
      return failed;
    }

    throw new Error(response.error.message);
  }

  return markDeliveryStatus(delivery.id, "sent", {
    providerMessageId: response.data?.id ?? null,
    sentAt: new Date()
  });
}

/**
 * Daily sweep: finds workspace-ready notifications that are still active
 * (user hasn't confirmed) and re-sends the reminder email. Only sends
 * if the last email for this notification was sent more than 20 hours ago
 * to avoid double-sends on the same day.
 */
export async function sendPendingWorkspaceReminders() {
  if (!process.env.DATABASE_URL) {
    return { sent: 0, skipped: 0 };
  }

  const pendingNotifications = await prisma.appNotification.findMany({
    where: {
      eventType: "workspace.ready_for_review",
      status: "active"
    },
    select: {
      id: true,
      userId: true
    }
  });

  let sent = 0;
  let skipped = 0;
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);

  for (const notification of pendingNotifications) {
    const existingDelivery = await prisma.notificationEmailDelivery.findUnique({
      where: { appNotificationId: notification.id },
      select: { status: true, sentAt: true }
    });

    // Skip if we already sent an email less than 20 hours ago
    if (
      existingDelivery?.status === "sent" &&
      existingDelivery.sentAt &&
      existingDelivery.sentAt > twentyHoursAgo
    ) {
      skipped++;
      continue;
    }

    // Reset the delivery status so it can be re-sent
    if (existingDelivery) {
      await prisma.notificationEmailDelivery.update({
        where: { appNotificationId: notification.id },
        data: { status: "pending", errorMessage: null, sentAt: null }
      });
    }

    try {
      await enqueueNotificationEmailDelivery(notification.id);
      sent++;
    } catch {
      skipped++;
    }
  }

  return { sent, skipped, total: pendingNotifications.length };
}
