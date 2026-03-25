"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { EmailThreadListItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function providerLabel(provider: string) {
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

export function DealEmailPanel({
  dealId,
  linkedThreads,
  recentThreads,
  hasConnectedAccounts
}: {
  dealId: string;
  linkedThreads: EmailThreadListItem[];
  recentThreads: EmailThreadListItem[];
  hasConnectedAccounts: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmailThreadListItem[]>(recentThreads);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(recentThreads);
      return;
    }

    const controller = new AbortController();

    async function run() {
      setIsSearching(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          limit: "12"
        });
        const response = await fetch(`/api/email/threads?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not search email threads.");
        }
        setResults(payload.threads ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not search email threads."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [query, recentThreads]);

  async function toggleLink(threadId: string, currentlyLinked: boolean) {
    setPendingThreadId(threadId);
    setErrorMessage(null);

    try {
      const endpoint = currentlyLinked ? "unlink" : "link";
      const response = await fetch(`/api/email/threads/${threadId}/${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ dealId })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update thread link.");
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update thread link."
      );
    } finally {
      setPendingThreadId(null);
    }
  }

  return (
    <div className="space-y-6">
      {!hasConnectedAccounts ? (
        <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
                Emails
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
                Connect Gmail, Outlook, or Yahoo in Settings to sync inbox threads into this partnership workspace.
              </p>
            </div>
          </div>
          <a
            href="/app/settings"
            className="mt-5 inline-flex border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
          >
            Open settings
          </a>
        </section>
      ) : null}

      {errorMessage ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Linked Threads
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Linked email context appears here and in the shared inbox so you can track negotiations alongside partnership terms.
            </p>
          </div>
          <a
            href="/app/inbox"
            className="border border-black/10 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-black/20"
          >
            Open inbox
          </a>
        </div>

        <div className="mt-5 space-y-3">
          {linkedThreads.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No email threads are linked to this partnership yet.
            </div>
          ) : (
            linkedThreads.map((item) => (
              <div
                key={item.thread.id}
                className="border border-border px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.thread.subject}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {providerLabel(item.account.provider)} · {item.account.emailAddress}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      {formatDate(item.thread.lastMessageAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleLink(item.thread.id, true)}
                      disabled={pendingThreadId === item.thread.id}
                      className="text-sm font-medium text-foreground underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingThreadId === item.thread.id ? "Updating..." : "Unlink"}
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.thread.aiSummary || item.thread.snippet || "No preview available."}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
            Link More Threads
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Search recent synced inbox threads and attach relevant conversations to this partnership.
          </p>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search by sender, subject, or partnership context"
          className="w-full border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
        />

        <div className="mt-5 space-y-3">
          {isSearching ? (
            <div className="text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No threads match this search yet.
            </div>
          ) : (
            results.map((item) => {
              const currentlyLinked = item.links.some((link) => link.dealId === dealId);
              return (
                <div
                  key={item.thread.id}
                  className="border border-border px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.thread.subject}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {providerLabel(item.account.provider)} · {item.account.emailAddress}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleLink(item.thread.id, currentlyLinked)}
                      disabled={pendingThreadId === item.thread.id}
                      className="border border-black/10 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingThreadId === item.thread.id
                        ? "Updating..."
                        : currentlyLinked
                          ? "Unlink"
                          : "Link to partnership"}
                    </button>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.thread.snippet || "No preview available."}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
