import { inngest } from "@/lib/inngest/client";
import { processDocumentById } from "@/lib/deals";
import { runInvoiceReminderSweep } from "@/lib/invoices";
import {
  sendNotificationEmailDelivery,
  sendPendingWorkspaceReminders
} from "@/lib/notification-email";

export const processContractFunction = inngest.createFunction(
  { id: "process-deal-document" },
  { event: "documents/process.requested" },
  async ({ event, step }) => {
    const documentId = String(event.data.documentId ?? "");

    if (!documentId) {
      throw new Error("Missing documentId.");
    }

    const aggregate = await step.run("process-document", async () =>
      processDocumentById(documentId)
    );

    return {
      ok: true,
      documentId,
      dealId: aggregate?.deal.id ?? null
    };
  }
);

export const checkWorkspaceDuplicatesFunction = inngest.createFunction(
  { id: "check-workspace-duplicates" },
  { event: "workspace/check-duplicates.requested" },
  async ({ event, step }) => {
    const dealId = String(event.data.dealId ?? "");
    const userId = String(event.data.userId ?? "");
    const sessionId = String(event.data.sessionId ?? "");

    if (!dealId || !userId || !sessionId) {
      throw new Error("Missing dealId, userId, or sessionId.");
    }

    await step.run("mark-checking", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { emitWorkspaceNotificationForSession } = await import(
        "@/lib/notification-service"
      );
      await prisma.intakeSession.update({
        where: { id: sessionId },
        data: { duplicateCheckStatus: "checking" }
      });
      await emitWorkspaceNotificationForSession(
        sessionId,
        "workspace.duplicate_checking"
      );
    });

    const matches = await step.run("find-duplicates", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { findDuplicateDeals } = await import("@/lib/duplicate-detection");

      const documents = await prisma.document.findMany({
        where: { dealId },
        select: { rawText: true, normalizedText: true, fileName: true }
      });

      const rawTexts = documents
        .map((doc) => doc.normalizedText || doc.rawText || "")
        .filter(Boolean);
      const fileNames = documents.map((doc) => doc.fileName).filter(Boolean);

      if (rawTexts.length === 0) {
        return [];
      }

      const allMatches = await findDuplicateDeals(userId, {
        rawTexts,
        fileNames
      });

      // Exclude the current deal from matches
      return allMatches.filter((match) => match.dealId !== dealId);
    });

    await step.run("save-results", async () => {
      const { revalidateTag } = await import("next/cache");
      const {
        emitWorkspaceNotificationForSession,
        supersedeWorkspaceNotificationEvents
      } = await import("@/lib/notification-service");
      const { prisma } = await import("@/lib/prisma");
      await prisma.intakeSession.update({
        where: { id: sessionId },
        data: {
          duplicateCheckStatus: matches.length > 0 ? "duplicates_found" : "clean",
          duplicateMatchJson: matches.length > 0 ? JSON.parse(JSON.stringify(matches)) : undefined
        }
      });

      // Invalidate cached deals so the notification appears on the dashboard
      revalidateTag(`user-${userId}-deals`, "max");
      revalidateTag(`user-${userId}-notifications`, "max");

      if (matches.length > 0) {
        await emitWorkspaceNotificationForSession(
          sessionId,
          "workspace.duplicates_found"
        );
      } else {
        await supersedeWorkspaceNotificationEvents(userId, sessionId, [
          "workspace.duplicate_checking"
        ]);
      }
    });

    return {
      ok: true,
      dealId,
      sessionId,
      duplicatesFound: matches.length
    };
  }
);

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
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        try {
          const notification = await prisma.appNotification.findUnique({
            where: { id: appNotificationId },
            select: { status: true }
          });
          return { isStillActive: notification?.status === "active" };
        } finally {
          await prisma.$disconnect();
        }
      });

      if (!isStillActive) {
        return { ok: true, appNotificationId, status: "skipped_confirmed" };
      }
    }

    const delivery = await step.run("send-notification-email", async () =>
      sendNotificationEmailDelivery(appNotificationId)
    );

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
  async ({ step }) => {
    const result = await step.run("send-pending-workspace-reminders", async () =>
      sendPendingWorkspaceReminders()
    );

    return { ok: true, ...result };
  }
);

export const invoiceReminderSweepFunction = inngest.createFunction(
  { id: "invoice-reminder-sweep" },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const result = await step.run("run-invoice-reminder-sweep", async () =>
      runInvoiceReminderSweep()
    );

    return {
      ok: true,
      ...result
    };
  }
);
