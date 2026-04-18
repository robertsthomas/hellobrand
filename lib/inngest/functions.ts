import { inngest } from "@/lib/inngest/client";

export const notificationEmailSendFunction = inngest.createFunction(
  {
    id: "notification-email-send",
    idempotency: "event.data.appNotificationId",
    triggers: [{ event: "notification/email.send.requested" }],
  },
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
          select: { status: true },
        });
        return { isStillActive: notification?.status === "active" };
      });

      if (!isStillActive) {
        return { ok: true, appNotificationId, status: "skipped_confirmed" };
      }
    }

    if (eventType !== "workspace.ready_for_review") {
      const localSendDelayMs = await step.run("check-local-send-window", async () => {
        const { getNotificationEmailSendDelayMs } = await import("@/lib/notification-email");
        return getNotificationEmailSendDelayMs(appNotificationId);
      });

      if (localSendDelayMs > 0) {
        const waitMinutes = Math.max(1, Math.ceil(localSendDelayMs / (60 * 1000)));
        await step.sleep("wait-until-local-morning", `${waitMinutes}m`);
      }
    }

    const delivery = await step.run("send-notification-email", async () => {
      const { sendNotificationEmailDelivery } = await import("@/lib/notification-email");
      return sendNotificationEmailDelivery(appNotificationId);
    });

    return {
      ok: true,
      appNotificationId,
      status: delivery?.status ?? null,
    };
  }
);

export const workspaceReminderSweepFunction = inngest.createFunction(
  {
    id: "workspace-reminder-sweep",
    triggers: [{ cron: "0 10 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("send-pending-workspace-reminders", async () => {
      const { sendPendingWorkspaceReminders } = await import("@/lib/notification-email");
      return sendPendingWorkspaceReminders();
    });

    return { ok: true, ...result };
  }
);

export const invoiceReminderSweepFunction = inngest.createFunction(
  {
    id: "invoice-reminder-sweep",
    triggers: [{ cron: "0 9 * * *" }],
  },
  async ({ step }) => {
    const isEnabled = await step.run("check-invoice-reminders-flag", async () => {
      const { invoiceRemindersEnabled } = await import("@/flags");
      return invoiceRemindersEnabled();
    });

    if (isEnabled !== true) {
      return { ok: true, processedDeals: 0, notified: 0 };
    }

    const result = await step.run("run-invoice-reminder-sweep", async () => {
      const { runInvoiceReminderSweep } = await import("@/lib/invoices");
      return runInvoiceReminderSweep();
    });

    return {
      ok: true,
      ...result,
    };
  }
);

export const workspaceNudgeSweepFunction = inngest.createFunction(
  {
    id: "workspace-nudge-sweep",
    triggers: [{ cron: "0 11 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("run-workspace-nudge-sweep", async () => {
      const { runWorkspaceNudgeSweep } = await import("@/lib/notification-service");
      return runWorkspaceNudgeSweep();
    });

    return { ok: true, ...result };
  }
);

export const noDocumentsUploadedSweepFunction = inngest.createFunction(
  {
    id: "no-documents-uploaded-sweep",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("run-no-documents-uploaded-sweep", async () => {
      const { runNoDocumentsUploadedSweep } = await import("@/lib/notification-service");
      return runNoDocumentsUploadedSweep();
    });

    return { ok: true, ...result };
  }
);
