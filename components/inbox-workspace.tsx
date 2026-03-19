"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DealRecord, EmailThreadDetail, EmailThreadListItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function providerLabel(provider: string) {
  return provider === "gmail" ? "Gmail" : "Outlook";
}

export function InboxWorkspace({
  threads,
  selectedThread,
  deals,
  selectedFilters
}: {
  threads: EmailThreadListItem[];
  selectedThread: EmailThreadDetail | null;
  deals: DealRecord[];
  selectedFilters: {
    q: string;
    provider: string;
    accountId: string;
    dealId: string;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState(selectedFilters.q);
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [summary, setSummary] = useState<string | null>(selectedThread?.thread.aiSummary ?? null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSummary(selectedThread?.thread.aiSummary ?? null);
    setDraft(null);
    setErrorMessage(null);
    setSelectedDealId(selectedThread?.links[0]?.dealId ?? "");
  }, [selectedThread]);

  const selectedThreadId = selectedThread?.thread.id ?? "";
  const linkedDealIds = useMemo(
    () => new Set(selectedThread?.links.map((link) => link.dealId) ?? []),
    [selectedThread]
  );

  function applyFilters(
    next: Partial<typeof selectedFilters> & { thread?: string } = {}
  ) {
    const params = new URLSearchParams();
    const values = {
      ...selectedFilters,
      q: query.trim(),
      ...next
    };

    for (const [key, value] of Object.entries(values)) {
      if (value) {
        params.set(key, value);
      }
    }

    if (selectedThreadId && !next.thread) {
      params.set("thread", selectedThreadId);
    }

    router.push(`/app/inbox${params.size > 0 ? `?${params.toString()}` : ""}`);
  }

  async function summarizeThread() {
    if (!selectedThreadId) {
      return;
    }

    setIsSummarizing(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/email/threads/${selectedThreadId}/summarize`, {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not summarize email thread.");
      }
      setSummary(payload.summary ?? null);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not summarize email thread.");
    } finally {
      setIsSummarizing(false);
    }
  }

  async function draftReply() {
    if (!selectedThreadId) {
      return;
    }

    setIsDrafting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/email/threads/${selectedThreadId}/draft`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          dealId: selectedDealId || null
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not generate reply draft.");
      }
      setDraft(payload.draft ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not generate reply draft.");
    } finally {
      setIsDrafting(false);
    }
  }

  async function linkSelectedDeal() {
    if (!selectedThreadId || !selectedDealId) {
      return;
    }

    setIsLinking(true);
    setErrorMessage(null);
    try {
      const endpoint = linkedDealIds.has(selectedDealId) ? "unlink" : "link";
      const response = await fetch(`/api/email/threads/${selectedThreadId}/${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          dealId: selectedDealId
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update deal link.");
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update deal link.");
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1320px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/8 pb-6 dark:border-white/10">
          <div>
            <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-foreground lg:text-[40px]">
              Inbox
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Browse synced inbox threads, link them to deals, and generate grounded
              summaries and reply drafts.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters({ thread: "" });
            }}
            className="flex w-full max-w-3xl flex-wrap gap-3"
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search sender, subject, brand, or deal"
              className="min-w-[220px] flex-1 border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
            <select
              defaultValue={selectedFilters.provider}
              onChange={(event) => applyFilters({ provider: event.currentTarget.value, thread: "" })}
              className="border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
            >
              <option value="">All providers</option>
              <option value="gmail">Gmail</option>
              <option value="outlook">Outlook</option>
            </select>
            <select
              defaultValue={selectedFilters.dealId}
              onChange={(event) => applyFilters({ dealId: event.currentTarget.value, thread: "" })}
              className="border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
            >
              <option value="">All deals</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.campaignName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border border-black/10 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-black/20"
            >
              Search
            </button>
          </form>
        </div>

        {errorMessage ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="border border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03]">
            <div className="border-b border-black/8 px-5 py-4 dark:border-white/10">
              <h2 className="text-lg font-semibold text-foreground">Threads</h2>
            </div>

            <div className="max-h-[72vh] overflow-auto">
              {threads.length === 0 ? (
                <div className="px-5 py-6 text-sm text-muted-foreground">
                  No synced threads match the current filters.
                </div>
              ) : (
                threads.map((item) => {
                  const active = item.thread.id === selectedThreadId;
                  const params = new URLSearchParams();
                  if (selectedFilters.q) params.set("q", selectedFilters.q);
                  if (selectedFilters.provider) params.set("provider", selectedFilters.provider);
                  if (selectedFilters.accountId) params.set("accountId", selectedFilters.accountId);
                  if (selectedFilters.dealId) params.set("dealId", selectedFilters.dealId);
                  params.set("thread", item.thread.id);

                  return (
                    <Link
                      key={item.thread.id}
                      href={`/app/inbox?${params.toString()}`}
                      className={`block border-b border-black/8 px-5 py-4 transition dark:border-white/8 ${
                        active ? "bg-secondary/45" : "hover:bg-secondary/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.thread.subject}
                          </p>
                          <p className="mt-1 truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">
                            {providerLabel(item.account.provider)} · {item.account.emailAddress}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.thread.lastMessageAt)}
                        </p>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {item.thread.snippet || "No preview available."}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.links.map((link) => (
                          <span
                            key={link.id}
                            className="border border-border px-2 py-1 text-xs font-medium text-foreground"
                          >
                            {link.campaignName}
                          </span>
                        ))}
                        {item.thread.aiSummary ? (
                          <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            AI summarized
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          <section className="border border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03]">
            {!selectedThread ? (
              <div className="px-6 py-10 text-sm text-muted-foreground">
                Select a thread to see the full conversation.
              </div>
            ) : (
              <div className="space-y-6 px-6 py-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/8 pb-5 dark:border-white/10">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {providerLabel(selectedThread.account.provider)} · {selectedThread.account.emailAddress}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                      {selectedThread.thread.subject}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Participants:{" "}
                      {selectedThread.thread.participants.map((participant) => participant.email).join(", ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={summarizeThread}
                      disabled={isSummarizing}
                      className="border border-black/10 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSummarizing ? "Summarizing..." : "Generate summary"}
                    </button>
                    <button
                      type="button"
                      onClick={draftReply}
                      disabled={isDrafting}
                      className="border border-black/10 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDrafting ? "Drafting..." : "Draft reply"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    {summary ? (
                      <section className="border border-emerald-200 bg-emerald-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">
                          AI summary
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                          {summary}
                        </p>
                      </section>
                    ) : null}

                    {draft ? (
                      <section className="border border-black/8 px-4 py-4 dark:border-white/10">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          Draft reply
                        </p>
                        <p className="mt-3 text-sm font-semibold text-foreground">
                          {draft.subject}
                        </p>
                        <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {draft.body}
                        </pre>
                      </section>
                    ) : null}

                    <section className="space-y-4">
                      {selectedThread.messages.map((message) => (
                        <article
                          key={message.id}
                          className="border border-black/8 px-4 py-4 dark:border-white/10"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {message.from?.name || message.from?.email || "Unknown sender"}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {message.from?.email || ""}
                              </p>
                            </div>
                            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                              {formatDate(message.receivedAt || message.sentAt)}
                            </p>
                          </div>

                          <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
                            {message.textBody || "No text body available."}
                          </div>

                          {message.attachments.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.attachments.map((attachment) => (
                                <span
                                  key={attachment.id}
                                  className="border border-border px-2 py-1 text-xs text-muted-foreground"
                                >
                                  {attachment.filename}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </section>
                  </div>

                  <aside className="space-y-4">
                    <section className="border border-black/8 px-4 py-4 dark:border-white/10">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Deal links
                      </p>
                      <div className="mt-4 space-y-3">
                        {selectedThread.links.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            This thread is not linked to a deal yet.
                          </p>
                        ) : (
                          selectedThread.links.map((link) => (
                            <div
                              key={link.id}
                              className="border border-border px-3 py-3"
                            >
                              <p className="text-sm font-semibold text-foreground">
                                {link.campaignName}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {link.brandName}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-4 space-y-3">
                        <select
                          value={selectedDealId}
                          onChange={(event) => setSelectedDealId(event.currentTarget.value)}
                          className="w-full border border-border bg-white px-3 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                        >
                          <option value="">Select a deal</option>
                          {deals.map((deal) => (
                            <option key={deal.id} value={deal.id}>
                              {deal.campaignName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={linkSelectedDeal}
                          disabled={!selectedDealId || isLinking}
                          className="w-full border border-black/10 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLinking
                            ? "Updating..."
                            : linkedDealIds.has(selectedDealId)
                              ? "Unlink from deal"
                              : "Link to deal"}
                        </button>
                      </div>
                    </section>
                  </aside>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
