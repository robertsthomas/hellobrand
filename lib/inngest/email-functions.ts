import { inngest } from "@/lib/inngest/client";
import {
  getIncrementalEmailSyncBatchConfig,
  runIncrementalEmailSync
} from "@/lib/email/service";

export const emailInitialSyncFunction = inngest.createFunction(
  {
    id: "email-account-initial-sync",
    concurrency: {
      limit: 1,
      key: "event.data.accountId"
    },
    triggers: [{ event: "email/account.initial_sync.requested" }]
  },
  async ({ event, step }) => {
    const accountId = String(event.data.accountId ?? "");

    if (!accountId) {
      throw new Error("Missing accountId.");
    }

    await step.run("sync-email-account-initial", async () => {
      const { syncEmailAccount } = await import("@/lib/email/service");
      return syncEmailAccount(accountId, {
        mode: "initial",
        recentLimit:
          typeof event.data.recentLimit === "number"
            ? event.data.recentLimit
            : undefined
      });
    });

    return { ok: true, accountId };
  }
);

export const emailIncrementalSyncFunction = inngest.createFunction(
  {
    id: "email-account-incremental-sync",
    concurrency: {
      limit: 1,
      key: "event.data.accountId"
    },
    batchEvents: {
      key: "event.data.accountId",
      ...getIncrementalEmailSyncBatchConfig()
    },
    triggers: [{ event: "email/account.incremental_sync.requested" }]
  },
  async ({ events, step }) => {
    const requests = events.map((event) => ({
      accountId: String(event.data.accountId ?? ""),
      gmailHistoryId:
        typeof event.data.gmailHistoryId === "string"
          ? event.data.gmailHistoryId
          : null,
      outlookMessageIds: Array.isArray(event.data.outlookMessageIds)
        ? event.data.outlookMessageIds
            .filter((entry: unknown): entry is string => typeof entry === "string")
        : []
    }));
    const accountId = String(requests[0]?.accountId ?? "");

    if (!accountId) {
      throw new Error("Missing accountId.");
    }

    return step.run("run-incremental-email-sync", async () => {
      return runIncrementalEmailSync(requests);
    });
  }
);

export const emailRenewalSweepFunction = inngest.createFunction(
  {
    id: "email-renewal-sweep",
    triggers: [{ cron: "*/15 * * * *" }]
  },
  async ({ step }) => {
    const renewedCount = await step.run("renew-expiring-email-subscriptions", async () => {
      const { renewExpiringEmailSubscriptions } = await import(
        "@/lib/email/service"
      );
      return renewExpiringEmailSubscriptions();
    });

    return { ok: true, renewedCount };
  }
);

export const emailActionItemDeadlineCheckFunction = inngest.createFunction(
  {
    id: "email-action-item-deadline-check",
    triggers: [{ cron: "0 9 * * *" }]
  },
  async ({ step }) => {
    const items = await step.run("list-upcoming-action-item-deadlines", async () => {
      const upcomingDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { listUpcomingActionItemDeadlines } = await import(
        "@/lib/email/repository"
      );
      return listUpcomingActionItemDeadlines(upcomingDeadline);
    });

    return {
      ok: true,
      upcomingCount: items.length,
      items: items.map((i) => ({ id: i.id, action: i.action, dueDate: i.dueDate }))
    };
  }
);

export const emailPaymentOverdueCheckFunction = inngest.createFunction(
  {
    id: "email-payment-overdue-check",
    triggers: [{ cron: "0 10 * * 1" }]
  },
  async ({ step }) => {
    const result = await step.run("mark-overdue-payments", async () => {
      const { prisma } = await import("@/lib/prisma");
      const now = new Date();
      const overduePayments = await prisma.paymentRecord.findMany({
        where: {
          status: { in: ["invoiced", "awaiting_payment"] },
          dueDate: { lte: now }
        },
        include: {
          deal: {
            select: {
              id: true,
              brandName: true,
              campaignName: true,
              userId: true
            }
          }
        },
        take: 50
      });

      if (overduePayments.length > 0) {
        await prisma.paymentRecord.updateMany({
          where: {
            id: {
              in: overduePayments.map((payment) => payment.id)
            }
          },
          data: { status: "late" }
        });
      }

      return {
        overdueCount: overduePayments.length,
        deals: overduePayments.map((p) => ({
          dealId: p.deal.id,
          brand: p.deal.brandName,
          campaign: p.deal.campaignName,
          dueDate: String(p.dueDate ?? "")
        }))
      };
    });

    return {
      ok: true,
      overdueCount: result.overdueCount,
      deals: result.deals
    };
  }
);
