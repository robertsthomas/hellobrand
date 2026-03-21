import { inngest } from "@/lib/inngest/client";
import { renewExpiringEmailSubscriptions, syncEmailAccount } from "@/lib/email/service";

export const emailInitialSyncFunction = inngest.createFunction(
  { id: "email-account-initial-sync" },
  { event: "email/account.initial_sync.requested" },
  async ({ event, step }) => {
    const accountId = String(event.data.accountId ?? "");

    if (!accountId) {
      throw new Error("Missing accountId.");
    }

    await step.run("sync-email-account-initial", async () =>
      syncEmailAccount(accountId, {
        mode: "initial",
        recentLimit:
          typeof event.data.recentLimit === "number"
            ? event.data.recentLimit
            : undefined
      })
    );

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

    await step.run("sync-email-account-incremental", async () =>
      syncEmailAccount(accountId, {
        mode: "incremental",
        gmailHistoryId:
          typeof event.data.gmailHistoryId === "string"
            ? event.data.gmailHistoryId
            : null,
        outlookMessageIds: Array.isArray(event.data.outlookMessageIds)
          ? event.data.outlookMessageIds
              .filter((entry: unknown): entry is string => typeof entry === "string")
          : []
      })
    );

    return { ok: true, accountId };
  }
);

export const emailRenewalSweepFunction = inngest.createFunction(
  { id: "email-renewal-sweep" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const renewedCount = await step.run("renew-expiring-email-subscriptions", async () =>
      renewExpiringEmailSubscriptions()
    );

    return { ok: true, renewedCount };
  }
);
