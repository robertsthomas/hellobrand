import { inngest } from "@/lib/inngest/client";

export const emailInitialSyncFunction = inngest.createFunction(
  { id: "email-account-initial-sync" },
  { event: "email/account.initial_sync.requested" },
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
  { id: "email-account-incremental-sync" },
  { event: "email/account.incremental_sync.requested" },
  async ({ event, step }) => {
    const accountId = String(event.data.accountId ?? "");

    if (!accountId) {
      throw new Error("Missing accountId.");
    }

    await step.run("sync-email-account-incremental", async () => {
      const { syncEmailAccount } = await import("@/lib/email/service");
      return syncEmailAccount(accountId, {
        mode: "incremental",
        gmailHistoryId:
          typeof event.data.gmailHistoryId === "string"
            ? event.data.gmailHistoryId
            : null,
        outlookMessageIds: Array.isArray(event.data.outlookMessageIds)
          ? event.data.outlookMessageIds
              .filter((entry: unknown): entry is string => typeof entry === "string")
          : []
      });
    });

    return { ok: true, accountId };
  }
);

export const emailRenewalSweepFunction = inngest.createFunction(
  { id: "email-renewal-sweep" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const renewedCount = await step.run(
      "renew-expiring-email-subscriptions",
      async () => {
        const { renewExpiringEmailSubscriptions } = await import(
          "@/lib/email/service"
        );
        return renewExpiringEmailSubscriptions();
      }
    );

    return { ok: true, renewedCount };
  }
);

export const emailActionItemDeadlineCheckFunction = inngest.createFunction(
  { id: "email-action-item-deadline-check" },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const upcomingDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const items = await step.run("check-upcoming-deadlines", async () => {
      const { listUpcomingActionItemDeadlines } = await import(
        "@/lib/email/repository"
      );
      return listUpcomingActionItemDeadlines(upcomingDeadline);
    });

    return { ok: true, upcomingCount: items.length, items: items.map((i) => ({ id: i.id, action: i.action, dueDate: i.dueDate })) };
  }
);

export const emailPaymentOverdueCheckFunction = inngest.createFunction(
  { id: "email-payment-overdue-check" },
  { cron: "0 10 * * 1" },
  async ({ step }) => {
    const { prisma } = await import("@/lib/prisma");
    const overduePayments = await step.run("check-overdue-payments", async () => {
      const now = new Date();
      return prisma.paymentRecord.findMany({
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
    });

    for (const payment of overduePayments) {
      await step.run(`flag-overdue-${payment.id}`, async () => {
        await prisma.paymentRecord.update({
          where: { id: payment.id },
          data: { status: "late" }
        });
      });
    }

    return {
      ok: true,
      overdueCount: overduePayments.length,
      deals: overduePayments.map((p) => ({
        dealId: p.deal.id,
        brand: p.deal.brandName,
        campaign: p.deal.campaignName,
        dueDate: String(p.dueDate ?? "")
      }))
    };
  }
);
