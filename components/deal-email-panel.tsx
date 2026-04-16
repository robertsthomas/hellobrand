"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

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
  hasConnectedAccounts,
}: {
  dealId: string;
  linkedThreads: EmailThreadListItem[];
  hasConnectedAccounts: boolean;
}) {
  const router = useRouter();
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function toggleLink(threadId: string, currentlyLinked: boolean) {
    setPendingThreadId(threadId);
    setErrorMessage(null);

    try {
      const endpoint = currentlyLinked ? "unlink" : "link";
      const response = await fetch(`/api/email/threads/${threadId}/${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ dealId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update thread link.");
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update thread link.");
    } finally {
      setPendingThreadId(null);
    }
  }

  return (
    <div className="space-y-6">
      {!hasConnectedAccounts ? (
        <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Emails</h2>
              <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
                Connect Gmail, Outlook, or Yahoo in Settings to sync inbox threads into this
                partnership workspace.
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
              This workspace only shows email threads already linked to this partnership. Open any
              thread in the inbox for the full conversation view.
            </p>
          </div>
          <Link
            href={`/app/inbox?dealId=${dealId}`}
            className="border border-black/10 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-black/20"
          >
            Open linked threads in inbox
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {linkedThreads.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No email threads are linked to this partnership yet.
            </div>
          ) : (
            linkedThreads.map((item) => (
              <div key={item.thread.id} className="border border-border px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.thread.subject}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {providerLabel(item.account.provider)} · {item.account.emailAddress}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/app/inbox?dealId=${dealId}&thread=${item.thread.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 transition hover:underline"
                    >
                      Open in inbox
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
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
    </div>
  );
}
