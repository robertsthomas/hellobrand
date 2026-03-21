"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ConnectedEmailAccountRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type SafeEmailAccount = Omit<
  ConnectedEmailAccountRecord,
  "accessTokenEncrypted" | "refreshTokenEncrypted" | "userId"
>;

function statusLabel(status: SafeEmailAccount["status"]) {
  switch (status) {
    case "connected":
      return "Connected";
    case "syncing":
      return "Syncing";
    case "reconnect_required":
      return "Reconnect required";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
    default:
      return status;
  }
}

function providerLabel(provider: SafeEmailAccount["provider"]) {
  return provider === "gmail" ? "Gmail" : "Outlook";
}

function providerConnectPath(provider: SafeEmailAccount["provider"]) {
  return provider === "gmail"
    ? "/api/email/google/connect"
    : "/api/email/outlook/connect";
}

export function EmailConnectionsPanel({
  accounts,
  statusMessage,
  errorMessage
}: {
  accounts: SafeEmailAccount[];
  statusMessage?: string | null;
  errorMessage?: string | null;
}) {
  const router = useRouter();
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  const grouped = useMemo(
    () => ({
      gmail: accounts.filter((account) => account.provider === "gmail"),
      outlook: accounts.filter((account) => account.provider === "outlook")
    }),
    [accounts]
  );

  async function disconnectAccount(accountId: string) {
    setPendingAccountId(accountId);
    setPanelError(null);

    try {
      const response = await fetch(`/api/email/accounts/${accountId}/disconnect`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not disconnect email account.");
      }

      router.refresh();
    } catch (error) {
      setPanelError(
        error instanceof Error ? error.message : "Could not disconnect email account."
      );
    } finally {
      setPendingAccountId(null);
    }
  }

  return (
    <section className="border-b border-border py-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
          Email Connections
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Connect Gmail or Outlook to sync inbox threads, attach them to partnerships, and
          draft replies from your workspace context.
        </p>
      </div>

      {statusMessage ? (
        <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      ) : null}
      {errorMessage || panelError ? (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage || panelError}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {(["gmail", "outlook"] as const).map((provider) => {
          const records = grouped[provider];

          return (
            <div
              key={provider}
              className="border border-border bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {providerLabel(provider)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    {provider === "gmail" ? "Google Gmail" : "Microsoft Outlook"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {provider === "gmail"
                      ? "Use your Google account to sync recent inbox threads and Gmail watch notifications."
                      : "Use your Microsoft account to sync inbox threads and Graph webhook updates."}
                  </p>
                </div>

                <a
                  href={providerConnectPath(provider)}
                  className="border border-black/10 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20"
                >
                  {records.some((record) => ["connected", "syncing", "error", "reconnect_required"].includes(record.status))
                    ? "Reconnect"
                    : "Connect"}
                </a>
              </div>

              <div className="mt-5 space-y-3">
                {records.length === 0 ? (
                  <div className="border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                    No {providerLabel(provider)} accounts connected yet.
                  </div>
                ) : (
                  records.map((account) => (
                    <div
                      key={account.id}
                      className="border border-border px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {account.displayName || account.emailAddress}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {account.emailAddress}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            {statusLabel(account.status)}
                          </span>
                          <button
                            type="button"
                            onClick={() => disconnectAccount(account.id)}
                            disabled={pendingAccountId === account.id}
                            className="text-sm font-medium text-foreground underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingAccountId === account.id ? "Disconnecting..." : "Disconnect"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <p>Last sync: {formatDate(account.lastSyncAt) || "Not yet synced"}</p>
                        <p>Token expiry: {formatDate(account.tokenExpiresAt) || "Unknown"}</p>
                      </div>

                      {account.lastErrorMessage ? (
                        <p className="mt-3 text-sm text-red-600">{account.lastErrorMessage}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
