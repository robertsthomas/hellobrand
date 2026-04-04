import { inngest } from "@/lib/inngest/client";

export const notificationEmailSendFunction = inngest.createFunction(
  { id: "notification-email-send" },
  { event: "notification/email.send.requested" },
  async ({ event, step }) => {
    const appNotificationId = String(event.data.appNotificationId ?? "");
    const eventType = String(event.data.eventType ?? "");

    if (!appNotificationId) {
      throw new Error("Missing appNotificationId.");
    }

    // Delay workspace-ready emails by 3 minutes so the user has a chance
    // to confirm on their own before we nudge them via email.
    if (eventType === "workspace.ready_for_review") {
      await step.sleep("wait-before-workspace-ready-email", "3m");

      // Check if the notification is still active (user hasn't confirmed yet).
      // If the session was confirmed, the notification gets superseded to "resolved".
      const { isStillActive } = await step.run("check-still-pending", async () => {
        const { prisma } = await import("@/lib/prisma");
        const notification = await prisma.appNotification.findUnique({
          where: { id: appNotificationId },
          select: { status: true }
        });
        return { isStillActive: notification?.status === "active" };
      });

      if (!isStillActive) {
        return { ok: true, appNotificationId, status: "skipped_confirmed" };
      }
    }

    if (eventType !== "workspace.ready_for_review") {
      const localSendDelayMs = await step.run("check-local-send-window", async () => {
        const { getNotificationEmailSendDelayMs } = await import(
          "@/lib/notification-email"
        );
        return getNotificationEmailSendDelayMs(appNotificationId);
      });

      if (localSendDelayMs > 0) {
        const waitMinutes = Math.max(1, Math.ceil(localSendDelayMs / (60 * 1000)));
        await step.sleep("wait-until-local-morning", `${waitMinutes}m`);
      }
    }

    const delivery = await step.run("send-notification-email", async () => {
      const { sendNotificationEmailDelivery } = await import(
        "@/lib/notification-email"
      );
      return sendNotificationEmailDelivery(appNotificationId);
    });

    return {
      ok: true,
      appNotificationId,
      status: delivery?.status ?? null
    };
  }
);

export const workspaceReminderSweepFunction = inngest.createFunction(
  { id: "workspace-reminder-sweep" },
  { cron: "0 10 * * *" },
  async () => {
    const { sendPendingWorkspaceReminders } = await import(
      "@/lib/notification-email"
    );
    const result = await sendPendingWorkspaceReminders();

    return { ok: true, ...result };
  }
);

export const invoiceReminderSweepFunction = inngest.createFunction(
  { id: "invoice-reminder-sweep" },
  { cron: "0 9 * * *" },
  async () => {
    const { runInvoiceReminderSweep } = await import("@/lib/invoices");
    const result = await runInvoiceReminderSweep();

    return {
      ok: true,
      ...result
    };
  }
);

export const workspaceNudgeSweepFunction = inngest.createFunction(
  { id: "workspace-nudge-sweep" },
  { cron: "0 11 * * *" },
  async () => {
    const { runWorkspaceNudgeSweep } = await import(
      "@/lib/notification-service"
    );
    const result = await runWorkspaceNudgeSweep();

    return { ok: true, ...result };
  }
);
