"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";

import { captureAppEvent } from "@/lib/posthog/events";
import type { ConnectedEmailAccountRecord } from "@/lib/types";
import type { EmailProviderFlagState } from "@/lib/email/config";
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
  switch (provider) {
    case "gmail":
      return "Gmail";
    case "outlook":
      return "Outlook";
    case "yahoo":
      return "Yahoo";
    default:
      return provider;
  }
}

function providerConnectPath(provider: SafeEmailAccount["provider"]) {
  switch (provider) {
    case "gmail":
      return "/api/email/google/connect";
    case "outlook":
      return "/api/email/outlook/connect";
    case "yahoo":
      return "/api/email/yahoo/connect";
    default:
      return null;
  }
}

function providerHeading(provider: SafeEmailAccount["provider"]) {
  switch (provider) {
    case "gmail":
      return "Google Gmail";
    case "outlook":
      return "Microsoft Outlook";
    case "yahoo":
      return "Yahoo Mail";
    default:
      return providerLabel(provider);
  }
}

function providerDescription(provider: SafeEmailAccount["provider"]) {
  switch (provider) {
    case "gmail":
      return "Use your Google account to sync recent inbox threads.";
    case "outlook":
      return "Use your Microsoft account to sync inbox threads.";
    case "yahoo":
      return "Connect via OAuth or use a Yahoo app password for IMAP and SMTP access.";
    default:
      return null;
  }
}

export function EmailConnectionsPanel({
  accounts,
  providerFlags,
  statusMessage,
  errorMessage,
}: {
  accounts: SafeEmailAccount[];
  providerFlags: EmailProviderFlagState;
  statusMessage?: string | null;
  errorMessage?: string | null;
}) {
  const router = useRouter();
  const posthog = usePostHog();
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelSuccess, setPanelSuccess] = useState<string | null>(null);
  const [isConnectingYahoo, setIsConnectingYahoo] = useState(false);
  const [yahooEmail, setYahooEmail] = useState(
    () => accounts.find((account) => account.provider === "yahoo")?.emailAddress ?? ""
  );
  const [yahooAppPassword, setYahooAppPassword] = useState("");
  const [isYahooCredentialsOpen, setIsYahooCredentialsOpen] = useState(false);

  const grouped = useMemo(
    () => ({
      gmail: accounts.filter((account) => account.provider === "gmail"),
      outlook: accounts.filter((account) => account.provider === "outlook"),
      yahoo: accounts.filter((account) => account.provider === "yahoo"),
    }),
    [accounts]
  );

  async function disconnectAccount(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);
    setPendingAccountId(accountId);
    setPanelError(null);
    captureAppEvent(posthog, "email_disconnect_clicked", {
      accountId,
      provider: account?.provider ?? "unknown",
      status: account?.status ?? "unknown",
    });

    try {
      const response = await fetch(`/api/email/accounts/${accountId}/disconnect`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not disconnect email account.");
      }

      router.refresh();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Could not disconnect email account.");
    } finally {
      setPendingAccountId(null);
    }
  }

  async function connectYahooAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsConnectingYahoo(true);
    setPanelError(null);
    setPanelSuccess(null);

    captureAppEvent(posthog, "email_connection_started", {
      provider: "yahoo",
      hasExistingAccount: grouped.yahoo.length > 0,
      surface: "settings_email_connections_app_password",
    });

    try {
      const response = await fetch("/api/email/yahoo/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emailAddress: yahooEmail,
          appPassword: yahooAppPassword,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not connect Yahoo Mail.");
      }

      setYahooAppPassword("");
      setPanelSuccess("Yahoo connected. IMAP and SMTP verified. Initial sync started.");
      router.refresh();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Could not connect Yahoo Mail.");
    } finally {
      setIsConnectingYahoo(false);
    }
  }

  const activeProviders = useMemo(() => {
    const providers: Array<"gmail" | "outlook" | "yahoo"> = [];
    if (providerFlags.gmail || grouped.gmail.length > 0) providers.push("gmail");
    if (providerFlags.outlook || grouped.outlook.length > 0) providers.push("outlook");
    if (providerFlags.yahoo || grouped.yahoo.length > 0) providers.push("yahoo");
    return providers;
  }, [providerFlags, grouped]);

  return (
    <section className="border-b border-border py-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">Email Connections</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Connect Gmail, Outlook, or Yahoo to sync inbox threads, attach them to partnerships, and
          draft replies from your workspace context.
        </p>
      </div>

      {statusMessage ? (
        <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      ) : null}
      {panelSuccess ? (
        <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {panelSuccess}
        </div>
      ) : null}
      {errorMessage || panelError ? (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage || panelError}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {activeProviders.map((provider) => {
          const records = grouped[provider];
          const isProviderFlagOn = providerFlags[provider];
          const connectPath = providerConnectPath(provider);

          return (
            <div key={provider} className="border border-border bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {providerLabel(provider)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    {providerHeading(provider)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {providerDescription(provider)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {!isProviderFlagOn ? null : provider === "yahoo" ? (
                    <>
                      {providerFlags.yahooOAuth ? (
                        <a
                          href={connectPath ?? ""}
                          onClick={() =>
                            captureAppEvent(posthog, "email_connection_started", {
                              provider,
                              hasExistingAccount: records.length > 0,
                              surface: "settings_email_connections",
                            })
                          }
                          className="border border-black/10 px-4 py-2 text-center text-sm font-semibold text-foreground transition hover:border-black/20"
                        >
                          {records.some((record) =>
                            ["connected", "syncing", "error", "reconnect_required"].includes(
                              record.status
                            )
                          )
                            ? "Reconnect OAuth"
                            : "Connect OAuth"}
                        </a>
                      ) : null}
                    </>
                  ) : connectPath ? (
                    <a
                      href={connectPath}
                      onClick={() =>
                        captureAppEvent(posthog, "email_connection_started", {
                          provider,
                          hasExistingAccount: records.length > 0,
                          surface: "settings_email_connections",
                        })
                      }
                      className="self-start border border-black/10 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20"
                    >
                      {records.some((record) =>
                        ["connected", "syncing", "error", "reconnect_required"].includes(
                          record.status
                        )
                      )
                        ? "Reconnect"
                        : "Connect"}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {provider === "yahoo" &&
                isYahooCredentialsOpen &&
                providerFlags.yahooAppPassword ? (
                  <details open className="border border-border bg-[#faf8f4]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground marker:hidden">
                      <span className="flex items-center justify-between gap-3">
                        <span>Enter Yahoo app password</span>
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          {isYahooCredentialsOpen ? "Hide" : "Show"}
                        </span>
                      </span>
                    </summary>

                    <form
                      onSubmit={connectYahooAccount}
                      className="space-y-3 border-t border-border px-4 py-4"
                    >
                      <div className="space-y-1">
                        <label
                          htmlFor="yahoo-email-address"
                          className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
                        >
                          Yahoo email
                        </label>
                        <input
                          id="yahoo-email-address"
                          type="email"
                          value={yahooEmail}
                          onChange={(event) => setYahooEmail(event.target.value)}
                          placeholder="name@yahoo.com"
                          className="w-full border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring"
                          autoComplete="email"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="yahoo-app-password"
                          className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
                        >
                          Yahoo app password
                        </label>
                        <input
                          id="yahoo-app-password"
                          type="password"
                          value={yahooAppPassword}
                          onChange={(event) => setYahooAppPassword(event.target.value)}
                          placeholder="Paste the app password from Yahoo"
                          className="w-full border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring"
                          autoComplete="current-password"
                          required
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          disabled={isConnectingYahoo}
                          className="border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isConnectingYahoo
                            ? "Verifying Yahoo..."
                            : records.length > 0
                              ? "Reconnect Yahoo"
                              : "Connect Yahoo"}
                        </button>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        We test both IMAP and SMTP before saving. Yahoo inbox updates are polled on
                        an interval instead of using webhooks.
                      </p>
                    </form>
                  </details>
                ) : null}

                {records.length === 0 ? (
                  <div className="border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                    {!isProviderFlagOn ? (
                      <p>Temporarily unavailable.</p>
                    ) : (
                      <p>No {providerLabel(provider)} accounts connected yet.</p>
                    )}
                    {provider === "yahoo" && isProviderFlagOn && providerFlags.yahooAppPassword ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsYahooCredentialsOpen(true)}
                          className="border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90"
                        >
                          Connect with app password
                        </button>
                        <a
                          href="https://help.yahoo.com/kb/SLN15241.html"
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-foreground underline underline-offset-4 transition hover:text-black/70"
                        >
                          How to create a Yahoo app password
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  records.map((account) => (
                    <div key={account.id} className="border border-border px-4 py-4">
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
                        <p>
                          {account.provider === "yahoo" && account.scopes.includes("app_password")
                            ? "Auth: Yahoo app password"
                            : `Token expiry: ${formatDate(account.tokenExpiresAt) || "Unknown"}`}
                        </p>
                      </div>

                      {account.provider === "yahoo" && !account.mailAuthConfigured ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Reconnect Yahoo with OAuth or an app password to start inbox sync.
                        </p>
                      ) : null}

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
