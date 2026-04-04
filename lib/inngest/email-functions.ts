import { inngest } from "@/lib/inngest/client";

export const emailInitialSyncFunction = inngest.createFunction(
  { id: "email-account-initial-sync" },
  { event: "email/account.initial_sync.requested" },
  async ({ event }) => {
    const accountId = String(event.data.accountId ?? "");

    if (!accountId) {
      throw new Error("Missing accountId.");
    }

    const { syncEmailAccount } = await import("@/lib/email/service");
    await syncEmailAccount(accountId, {
      mode: "initial",
      recentLimit:
        typeof event.data.recentLimit === "number"
          ? event.data.recentLimit
          : undefined
    });

    return { ok: true, accountId };
  }
);

export const emailIncrementalSyncFunction = inngest.createFunction(
  { id: "email-account-incremental-sync" },
  { event: "email/account.incremental_sync.requested" },
  async ({ event }) => {
    const accountId = String(event.data.accountId ?? "");

    if (!accountId) {
      throw new Error("Missing accountId.");
    }

    const { syncEmailAccount } = await import("@/lib/email/service");
    await syncEmailAccount(accountId, {
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

    return { ok: true, accountId };
  }
);

export const emailRenewalSweepFunction = inngest.createFunction(
  { id: "email-renewal-sweep" },
  { cron: "*/15 * * * *" },
  async () => {
    const { renewExpiringEmailSubscriptions } = await import(
      "@/lib/email/service"
    );
    const renewedCount = await renewExpiringEmailSubscriptions();

    return { ok: true, renewedCount };
  }
);

export const emailActionItemDeadlineCheckFunction = inngest.createFunction(
  { id: "email-action-item-deadline-check" },
  { cron: "0 9 * * *" },
  async () => {
    const upcomingDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { listUpcomingActionItemDeadlines } = await import(
      "@/lib/email/repository"
    );
    const items = await listUpcomingActionItemDeadlines(upcomingDeadline);

    return { ok: true, upcomingCount: items.length, items: items.map((i) => ({ id: i.id, action: i.action, dueDate: i.dueDate })) };
  }
);

export const emailPaymentOverdueCheckFunction = inngest.createFunction(
  { id: "email-payment-overdue-check" },
  { cron: "0 10 * * 1" },
  async () => {
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
