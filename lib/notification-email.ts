import { emailDeliveryEnabled } from "@/flags";
import { getAppSettings } from "@/lib/admin-settings";
import { getAppBaseUrl } from "@/lib/email/config";
import { resolveEmailNotificationsEnabled } from "@/lib/email-notification-preference";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { createResendClient } from "@/lib/resend-client";

type NotificationEmailStatus = "pending" | "sent" | "failed" | "skipped";

type EmailEligibleEventType =
  | "workspace.ready_for_review"
  | "workspace.failed"
  | "workspace.deleted"
  | "workspace.missing_payment"
  | "workspace.missing_deliverables"
  | "workspace.missing_usage_rights"
  | "workspace.no_documents_uploaded"
  | "email.resync_required"
  | "invoice.generate_prompt"
  | "invoice.send_prompt";

type NotificationEmailCopy = {
  subject: string;
  preview: string;
  headline: string;
  body: string;
  ctaLabel: string;
};

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
      timeZone: string | null;
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

function extractMailbox(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/<([^>]+)>/);
  return normalizeEmail(match ? match[1] : value);
}

function formatNotificationFromEmail(value: string) {
  const mailbox = extractMailbox(value);
  if (!mailbox) {
    return value;
  }

  if (value.includes("<") && value.includes(">")) {
    return value.trim();
  }

  return `HelloBrand <${mailbox}>`;
}

function normalizeTimeZone(value: string | null | undefined) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return null;
  }
}

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function getNotificationEmailLocalSendDelayMs(
  timeZone: string | null | undefined,
  now = new Date()
) {
  const normalized = normalizeTimeZone(timeZone);
  if (!normalized) {
    return 0;
  }

  const parts = getZonedDateParts(now, normalized);
  if (parts.hour >= 9) {
    return 0;
  }

  const nowLocalMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const targetLocalMs = Date.UTC(parts.year, parts.month - 1, parts.day, 9, 0, 0);

  return Math.max(0, targetLocalMs - nowLocalMs);
}

export async function getNotificationEmailSendDelayMs(appNotificationId: string) {
  const notification = await loadNotificationWithEmailContext(appNotificationId);
  return getNotificationEmailLocalSendDelayMs(notification?.user.profile?.timeZone ?? null);
}

export function resolveNotificationRecipient(
  userEmail: string,
  contactEmail: string | null | undefined
) {
  return normalizeEmail(contactEmail) ?? normalizeEmail(userEmail);
}

export function getNotificationEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const rawFromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const mailbox = extractMailbox(rawFromEmail);
  const testToEmail = normalizeEmail(process.env.RESEND_TEST_TO_EMAIL);
  const testMode = mailbox?.endsWith("@resend.dev") ?? false;

  return {
    apiKey,
    fromEmail: formatNotificationFromEmail(rawFromEmail),
    testToEmail,
    testMode,
  };
}

export function canSendNotificationEmailInCurrentMode(input: {
  fromEmail: string;
  testToEmail: string | null;
  recipientEmail: string;
}) {
  const fromEmail = extractMailbox(input.fromEmail);
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  const testMode = fromEmail?.endsWith("@resend.dev") ?? false;

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

function truncateEntityName(name: string, maxLength: number): string {
  if (name.length <= maxLength) {
    return name;
  }
  return name.slice(0, maxLength - 1).trimEnd() + "\u2026";
}

function buildSubjectWithEntity(prefix: string, entity: string) {
  const maxEntityLength = Math.max(8, 60 - prefix.length);
  return `${prefix}${truncateEntityName(entity, maxEntityLength)}`;
}

function truncatePreviewText(value: string, maxLength = 90) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}\u2026`;
}

function resolveInvoiceEmailCopy(
  eventType: EmailEligibleEventType,
  title: string,
  body: string
): Omit<NotificationEmailCopy, "ctaLabel"> | null {
  if (eventType !== "invoice.generate_prompt" && eventType !== "invoice.send_prompt") {
    return null;
  }

  const patterns =
    eventType === "invoice.generate_prompt"
      ? [
          {
            pattern:
              /^Today is the final posting milestone for (.+?)\. Generate the workspace invoice now\.$/,
            subjectPrefix: "Generate invoice for ",
            headline: "Generate your invoice",
            preview: "Final posting milestone is today. Generate the invoice now in HelloBrand.",
            bodyForCampaign: (campaign: string) =>
              `${campaign} reached its final posting milestone today. Generate the invoice now so it is ready to send and track in your workspace.`,
          },
          {
            pattern:
              /^You still have not generated the invoice for (.+?)\. Review the workspace invoice tab and send it when ready\.$/,
            subjectPrefix: "Reminder: generate invoice for ",
            headline: "Invoice reminder",
            preview: "Your workspace invoice is still waiting to be generated.",
            bodyForCampaign: (campaign: string) =>
              `You have not generated the invoice for ${campaign} yet. Open the workspace invoice tab to create it and send it when ready.`,
          },
          {
            pattern:
              /^It has been \d+ days since the final posting milestone for (.+?)\. Generate or attach the invoice if it is still outstanding\.$/,
            subjectPrefix: "Invoice still not generated for ",
            headline: "Invoice reminder",
            preview: "Your invoice reminder is still open in HelloBrand.",
            bodyForCampaign: (campaign: string) =>
              `The invoice for ${campaign} still appears outstanding. Generate or attach it now if the brand has not been billed yet.`,
          },
        ]
      : [
          {
            pattern:
              /^Your invoice for (.+?) is finalized\. Send it from the linked inbox thread or export it now\.$/,
            subjectPrefix: "Send invoice for ",
            headline: "Send your invoice",
            preview: "Your finalized invoice is ready to send.",
            bodyForCampaign: (campaign: string) =>
              `Your invoice for ${campaign} is finalized and ready to send. Open the linked inbox thread or export it from the workspace now.`,
          },
          {
            pattern:
              /^Your finalized invoice for (.+?) still has not been sent\. Open the workspace invoice tab or linked inbox to send it\.$/,
            subjectPrefix: "Reminder: send invoice for ",
            headline: "Invoice reminder",
            preview: "Your finalized invoice is still waiting to be sent.",
            bodyForCampaign: (campaign: string) =>
              `Your finalized invoice for ${campaign} still has not been sent. Open the workspace or linked inbox now to send it.`,
          },
          {
            pattern:
              /^It has been \d+ days since the invoice for (.+?) was finalized\. Send or resend it if payment is still pending\.$/,
            subjectPrefix: "Invoice still not sent for ",
            headline: "Invoice reminder",
            preview: "Follow up on the invoice if payment is still pending.",
            bodyForCampaign: (campaign: string) =>
              `Your invoice for ${campaign} still appears unsent. Send or resend it now if payment is still pending.`,
          },
        ];

  for (const candidate of patterns) {
    const match = body.match(candidate.pattern);
    if (!match) {
      continue;
    }

    const campaignName = match[1];
    return {
      subject: buildSubjectWithEntity(candidate.subjectPrefix, campaignName),
      preview: truncatePreviewText(candidate.preview),
      headline: candidate.headline,
      body: candidate.bodyForCampaign(campaignName),
    };
  }

  return {
    subject: truncateEntityName(title, 60),
    preview: truncatePreviewText(body),
    headline: title,
    body,
  };
}

function buildSubjectForEvent(eventType: EmailEligibleEventType, title: string): string {
  switch (eventType) {
    case "workspace.ready_for_review": {
      const entity = title.replace(/ workspace is ready for review$/i, "") || "Your";
      const truncated = truncateEntityName(entity, 22);
      return `${truncated} workspace is ready for review`;
    }
    case "workspace.failed": {
      const entity = title.replace(/ workspace processing failed$/i, "") || "Your";
      const truncated = truncateEntityName(entity, 18);
      return `${truncated} workspace could not be processed`;
    }
    case "workspace.deleted": {
      const entity = title.replace(/^Workspace deleted: /i, "") || "A";
      const truncated = truncateEntityName(entity, 22);
      return `${truncated} workspace has been deleted`;
    }
    case "workspace.missing_payment": {
      const entity = title.replace(/^Payment amount missing from /i, "") || "This campaign";
      const truncated = truncateEntityName(entity, 21);
      return `${truncated} is missing a payment amount`;
    }
    case "workspace.missing_deliverables": {
      const entity = title.replace(/^No deliverables found in /i, "") || "this campaign";
      const truncated = truncateEntityName(entity, 25);
      return `No deliverables found in ${truncated}`;
    }
    case "workspace.missing_usage_rights": {
      const entity = title.replace(/^Usage rights not specified in /i, "") || "this campaign";
      const truncated = truncateEntityName(entity, 22);
      return `Usage rights missing from ${truncated}`;
    }
    case "workspace.no_documents_uploaded": {
      const entity = title.replace(/ has no documents yet$/i, "") || "Your workspace";
      const truncated = truncateEntityName(entity, 22);
      return `${truncated} needs documents uploaded`;
    }
    case "email.resync_required": {
      const entity = title.replace(/ inbox needs resync$/i, "") || "Your";
      return `Your ${entity} inbox needs to reconnect`;
    }
    case "invoice.generate_prompt": {
      return truncateEntityName(title, 60);
    }
    case "invoice.send_prompt": {
      return truncateEntityName(title, 60);
    }
  }
}

function resolveCtaLabel(eventType: EmailEligibleEventType): string {
  switch (eventType) {
    case "workspace.ready_for_review":
      return "Review workspace";
    case "workspace.failed":
      return "View error details";
    case "workspace.deleted":
      return "Go to dashboard";
    case "workspace.missing_payment":
      return "Add payment amount";
    case "workspace.missing_deliverables":
      return "Add deliverables";
    case "workspace.missing_usage_rights":
      return "Add usage rights";
    case "workspace.no_documents_uploaded":
      return "Upload documents";
    case "email.resync_required":
      return "Reconnect inbox";
    case "invoice.generate_prompt":
      return "Generate invoice";
    case "invoice.send_prompt":
      return "Send invoice";
  }
}

const EMAIL_ELIGIBLE_EVENT_TYPES = new Set<string>([
  "workspace.ready_for_review",
  "workspace.failed",
  "workspace.deleted",
  "workspace.missing_payment",
  "workspace.missing_deliverables",
  "workspace.missing_usage_rights",
  "workspace.no_documents_uploaded",
  "email.resync_required",
  "invoice.generate_prompt",
  "invoice.send_prompt",
]);

function isEmailEligibleEventType(eventType: string): eventType is EmailEligibleEventType {
  return EMAIL_ELIGIBLE_EVENT_TYPES.has(eventType);
}

/**
 * Resolves email-specific copy (subject, headline, body, CTA) for a notification.
 *
 * Copy rules for adding new notification event types:
 * - Subject must be under 60 characters (9 words). No "HelloBrand:" prefix,
 *   the brand shows in the From name.
 * - CTA label should name the specific action (e.g., "Review workspace"),
 *   never "Open in HelloBrand".
 * - No em dashes or en dashes in any copy.
 * - Lead with the entity name when the user needs to act on it. Lead with
 *   the data gap for nudge notifications.
 * - Headline should not repeat the subject verbatim when possible.
 * - Body should be 1-2 sentences, no "we'll notify you" language.
 *
 * To add a new event type: add it to `EmailEligibleEventType`, then add
 * branches in `buildSubjectForEvent` and `resolveCtaLabel`. The TypeScript
 * exhaustiveness check will enforce this at compile time.
 */
export function resolveNotificationEmailCopy(input: {
  eventType: string;
  title: string;
  body: string;
}): NotificationEmailCopy {
  if (isEmailEligibleEventType(input.eventType)) {
    const invoiceCopy = resolveInvoiceEmailCopy(input.eventType, input.title, input.body);
    if (invoiceCopy) {
      return {
        ...invoiceCopy,
        ctaLabel: resolveCtaLabel(input.eventType),
      };
    }

    return {
      subject: buildSubjectForEvent(input.eventType, input.title),
      preview: truncatePreviewText(input.body),
      headline: input.title,
      body: input.body,
      ctaLabel: resolveCtaLabel(input.eventType),
    };
  }

  return {
    subject: input.title,
    preview: truncatePreviewText(input.body),
    headline: input.title,
    body: input.body,
    ctaLabel: "Open in HelloBrand",
  };
}

export function buildNotificationEmailPayload(input: {
  eventType: string;
  title: string;
  body: string;
  href: string;
}) {
  const copy = resolveNotificationEmailCopy({
    eventType: input.eventType,
    title: input.title,
    body: input.body,
  });
  const absoluteHref = toAbsoluteHref(input.href);
  const escapedPreview = escapeHtml(copy.preview);
  const escapedHeadline = escapeHtml(copy.headline);
  const escapedBody = escapeHtml(copy.body);
  const escapedCtaLabel = escapeHtml(copy.ctaLabel);

  const settingsHref = toAbsoluteHref("/app/settings/notifications");

  return {
    subject: copy.subject,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f6f3ee; padding: 32px;">
        <div style="display: none; overflow: hidden; line-height: 1px; opacity: 0; max-height: 0; max-width: 0; mso-hide: all;">
          ${escapedPreview}
        </div>
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 0; border: 1px solid #e7dfd3;">
          <div style="border-top: 2px solid #1f1a14; padding: 32px;">
            <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.2; color: #1f1a14;">${escapedHeadline}</h1>
            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4a4034;">${escapedBody}</p>
            <a href="${absoluteHref}" style="display: inline-block; background: #1f1a14; color: #ffffff; text-decoration: none; padding: 12px 18px; font-size: 14px;">${escapedCtaLabel}</a>
          </div>
          <div style="padding: 16px 32px; border-top: 1px solid #e7dfd3;">
            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7f6f5a;">You're receiving this because you have email notifications enabled in <a href="${settingsHref}" style="color: #7f6f5a;">HelloBrand</a>.</p>
          </div>
        </div>
      </div>
    `.trim(),
    text: `${copy.headline}\n\n${copy.body}\n\n${copy.ctaLabel}: ${absoluteHref}\n\nYou're receiving this because you have email notifications enabled in HelloBrand.`,
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
              timeZone: true,
              emailNotificationsEnabled: true,
              createdAt: true,
            },
          },
        },
      },
    },
  }) as Promise<NotificationWithEmailContext | null>;
}

function shouldSendNotificationEmail(notification: NotificationWithEmailContext) {
  if (notification.category === "workspace" && notification.eventType.startsWith("workspace.")) {
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
    return (
      notification.eventType === "invoice.generate_prompt" ||
      notification.eventType === "invoice.send_prompt"
    );
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
      sentAt: input?.sentAt ?? null,
    },
  });
}

export async function enqueueNotificationEmailDelivery(appNotificationId: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const appSettings = await getAppSettings();
  if (!appSettings.emailDeliveryEnabled || (await emailDeliveryEnabled()) === false) {
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
    where: { appNotificationId },
  });

  if (
    existing?.status === "sent" ||
    existing?.status === "skipped" ||
    existing?.status === "pending"
  ) {
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
          sentAt: null,
        },
      })
    : await prisma.notificationEmailDelivery.create({
        data: {
          appNotificationId,
          userId: notification.userId,
          recipientEmail,
          provider: "resend",
          status: "pending",
        },
      });

  if (hasInngestEventKey()) {
    await inngest.send({
      id: `notification-email-send-requested-${appNotificationId}`,
      name: "notification/email.send.requested",
      data: { appNotificationId, eventType: notification.eventType },
    });
    return delivery;
  }

  await sendNotificationEmailDelivery(appNotificationId);
  return prisma.notificationEmailDelivery.findUnique({
    where: { id: delivery.id },
  });
}

// fallow-ignore-next-line complexity
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
          href: true,
        },
      },
    },
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
        profile: null,
      },
    }) ||
    notification.status !== "active"
  ) {
    return markDeliveryStatus(delivery.id, "skipped", {
      errorMessage: "Notification is no longer eligible for email delivery.",
    });
  }

  const config = getNotificationEmailConfig();
  if (!config.apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (
    !canSendNotificationEmailInCurrentMode({
      fromEmail: config.fromEmail,
      testToEmail: config.testToEmail,
      recipientEmail: delivery.recipientEmail,
    })
  ) {
    return markDeliveryStatus(delivery.id, "skipped", {
      errorMessage:
        config.testMode && !config.testToEmail
          ? "Missing RESEND_TEST_TO_EMAIL for resend.dev test mode."
          : "Recipient is not allowed while resend.dev test mode is enabled.",
    });
  }

  const notificationWithContext = await loadNotificationWithEmailContext(appNotificationId);
  const localSendDelayMs = getNotificationEmailLocalSendDelayMs(
    notificationWithContext?.user.profile?.timeZone ?? null
  );
  if (localSendDelayMs > 0) {
    return delivery;
  }

  const resend = await createResendClient(config.apiKey);
  const email = buildNotificationEmailPayload({
    eventType: notification.eventType,
    title: notification.title,
    body: notification.body,
    href: notification.href,
  });

  const response = await resend.emails.send({
    from: config.fromEmail,
    to: [delivery.recipientEmail],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (response.error) {
    const failed = await markDeliveryStatus(delivery.id, "failed", {
      errorMessage: response.error.message,
    });

    if (isTerminalResendError(response.error)) {
      return failed;
    }

    throw new Error(response.error.message);
  }

  return markDeliveryStatus(delivery.id, "sent", {
    providerMessageId: response.data?.id ?? null,
    sentAt: new Date(),
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
      status: "active",
    },
    select: {
      id: true,
      userId: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);

  for (const notification of pendingNotifications) {
    const existingDelivery = await prisma.notificationEmailDelivery.findUnique({
      where: { appNotificationId: notification.id },
      select: { status: true, sentAt: true },
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
        data: { status: "pending", errorMessage: null, sentAt: null },
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
