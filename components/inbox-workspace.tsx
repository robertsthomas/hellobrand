"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  File,
  FileImage,
  FileText,
  FileVideo,
  MoreHorizontal,
  Paperclip,
  X
} from "lucide-react";

import type {
  DealRecord,
  EmailAttachmentRecord,
  EmailMessageRecord,
  EmailParticipant,
  EmailThreadDetail,
  EmailThreadListItem
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

function providerLabel(provider: string) {
  return provider === "gmail" ? "Gmail" : "Outlook";
}

function InboxSelect({
  value,
  onChange,
  children,
  className = ""
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-12 w-full appearance-none border border-border bg-white px-4 pr-14 text-[13px] text-foreground outline-none transition focus:border-primary"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          backgroundImage: "none"
        }}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center border-l border-border/80">
        <span className="h-0 w-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-muted-foreground" />
      </div>
    </div>
  );
}

function participantLabel(participant: EmailParticipant | null | undefined) {
  if (!participant) {
    return "Unknown sender";
  }

  return participant.name?.trim() || participant.email;
}

function initialsFromParticipant(participant: EmailParticipant | null | undefined) {
  const label = participantLabel(participant);
  const words = label
    .replace(/<.*?>/g, "")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "?";
  }

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function formatAttachmentSize(sizeBytes: number) {
  if (!sizeBytes || sizeBytes <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted =
    value >= 10 || unitIndex === 0 ? Math.round(value).toString() : value.toFixed(1);

  return `${formatted}${units[unitIndex]}`;
}

function attachmentIcon(attachment: EmailAttachmentRecord) {
  if (attachment.mimeType.startsWith("image/")) {
    return FileImage;
  }

  if (attachment.mimeType.startsWith("video/")) {
    return FileVideo;
  }

  if (
    attachment.mimeType.includes("pdf") ||
    attachment.mimeType.includes("document") ||
    attachment.mimeType.includes("sheet") ||
    attachment.mimeType.includes("text")
  ) {
    return FileText;
  }

  return File;
}

function messagePreview(message: EmailMessageRecord) {
  const body = message.textBody?.trim();
  if (!body) {
    return "No preview available.";
  }

  return body.replace(/\s+/g, " ").slice(0, 140);
}

function AttachmentShelf({ attachments }: { attachments: EmailAttachmentRecord[] }) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 border border-black/8 bg-[#fbfbf8] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-white text-foreground shadow-sm dark:bg-white/10 dark:text-white">
            <Paperclip className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">Attachments</p>
            <p className="text-[11px] text-muted-foreground">
              {attachments.length} file{attachments.length === 1 ? "" : "s"} in this message
            </p>
          </div>
        </div>
        <span className="bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground shadow-sm dark:bg-white/10">
          Synced
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.map((attachment) => {
          const Icon = attachmentIcon(attachment);

          return (
            <div
              key={attachment.id}
              className="border border-black/8 bg-white p-3 shadow-[0_1px_0_rgba(17,24,39,0.04)] dark:border-white/10 dark:bg-[#161a20]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-secondary/50 text-foreground dark:bg-white/10 dark:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {attachment.filename}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatAttachmentSize(attachment.sizeBytes)} ·{" "}
                    {attachment.mimeType.split("/")[1] || "file"}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-[#31513b] dark:text-white/80">
                    Provider attachment
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageStrip({
  message,
  isOutbound
}: {
  message: EmailMessageRecord;
  isOutbound: boolean;
}) {
  return (
    <div className="border border-black/8 bg-white px-4 py-3 shadow-[0_4px_16px_rgba(17,24,39,0.03)] dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center text-xs font-semibold ${
            isOutbound ? "bg-foreground text-background" : "bg-secondary/60 text-foreground"
          }`}
        >
          {isOutbound ? "You" : initialsFromParticipant(message.from)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">
              {isOutbound ? "You" : participantLabel(message.from)}
            </p>
            <span className="bg-secondary/65 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
              {isOutbound ? "Sent" : "Received"}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
            {messagePreview(message)}
          </p>
        </div>
        <p className="ml-auto shrink-0 text-[11px] text-muted-foreground">
          {formatDate(message.receivedAt || message.sentAt)}
        </p>
      </div>
    </div>
  );
}

export function InboxWorkspace({
  threads,
  selectedThread: initialSelectedThread,
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
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const threadCacheRef = useRef<Record<string, EmailThreadDetail>>({});
  const threadRequestRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState(selectedFilters.q);
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [selectedThread, setSelectedThread] = useState<EmailThreadDetail | null>(initialSelectedThread);
  const [activeThreadId, setActiveThreadId] = useState(initialSelectedThread?.thread.id ?? threads[0]?.thread.id ?? "");
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(initialSelectedThread?.thread.aiSummary ?? null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedThread(initialSelectedThread);
    setActiveThreadId(initialSelectedThread?.thread.id ?? threads[0]?.thread.id ?? "");
    if (initialSelectedThread) {
      threadCacheRef.current[initialSelectedThread.thread.id] = initialSelectedThread;
    }
  }, [initialSelectedThread, threads]);

  useEffect(() => {
    setSummary(selectedThread?.thread.aiSummary ?? null);
    setDraft(null);
    setErrorMessage(null);
    setSelectedDealId(selectedThread?.links[0]?.dealId ?? "");
    setIsActionMenuOpen(false);
    setIsLinkModalOpen(false);
  }, [selectedThread]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setIsActionMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedThreadId = selectedThread?.thread.id ?? "";
  const linkedDealIds = useMemo(
    () => new Set(selectedThread?.links.map((link) => link.dealId) ?? []),
    [selectedThread]
  );
  const selectedMessages = selectedThread?.messages ?? [];
  const latestMessage = selectedMessages[selectedMessages.length - 1] ?? null;
  const earlierMessages = latestMessage ? selectedMessages.slice(0, -1) : [];

  function buildInboxUrl(
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

    if (values.thread) {
      params.set("thread", values.thread);
    }

    return `/app/inbox${params.size > 0 ? `?${params.toString()}` : ""}`;
  }

  function applyFilters(
    next: Partial<typeof selectedFilters> & { thread?: string } = {}
  ) {
    router.push(buildInboxUrl({ ...next, thread: next.thread ?? selectedThreadId }));
  }

  async function loadThread(threadId: string) {
    if (!threadId || threadId === selectedThreadId) {
      return;
    }

    setActiveThreadId(threadId);
    setErrorMessage(null);
    window.history.replaceState(null, "", buildInboxUrl({ thread: threadId }));

    const cached = threadCacheRef.current[threadId];
    if (cached) {
      setSelectedThread(cached);
      return;
    }

    threadRequestRef.current?.abort();
    const controller = new AbortController();
    threadRequestRef.current = controller;

    setIsThreadLoading(true);
    try {
      const response = await fetch(`/api/email/threads/${threadId}`, {
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load email thread.");
      }

      const detail = payload.thread as EmailThreadDetail;
      threadCacheRef.current[threadId] = detail;
      setSelectedThread(detail);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : "Could not load email thread.");
    } finally {
      if (threadRequestRef.current === controller) {
        threadRequestRef.current = null;
      }
      setIsThreadLoading(false);
    }
  }

  async function prefetchThread(threadId: string) {
    if (!threadId || threadCacheRef.current[threadId]) {
      return;
    }

    try {
      const response = await fetch(`/api/email/threads/${threadId}`);
      const payload = await response.json();
      if (!response.ok || !payload.thread) {
        return;
      }

      threadCacheRef.current[threadId] = payload.thread as EmailThreadDetail;
    } catch {
      // Ignore prefetch failures. Selection will fall back to the normal fetch path.
    }
  }

  async function summarizeThread() {
    if (!selectedThreadId) {
      return;
    }

    setIsSummarizing(true);
    setIsActionMenuOpen(false);
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
    setIsActionMenuOpen(false);
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
      setIsLinkModalOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update deal link.");
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-5 py-4 lg:px-8 lg:py-5">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] flex-col gap-4">
          <div className="border-b border-black/8 pb-4 dark:border-white/10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[31px] font-semibold tracking-[-0.05em] text-foreground lg:text-[36px]">
                  Inbox
                </h1>
                <p className="mt-1 max-w-3xl text-[13px] leading-6 text-muted-foreground">
                  Browse synced inbox threads, link them to deals, and generate grounded
                  summaries and reply drafts.
                </p>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  applyFilters({ thread: "" });
                }}
                className="grid w-full gap-3 lg:grid-cols-[minmax(0,1.5fr)_170px_240px_auto]"
              >
                <input
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search sender, subject, brand, or deal"
                  className="h-12 min-w-0 border border-border bg-white px-4 text-[13px] text-foreground outline-none transition focus:border-primary"
                />
                <InboxSelect
                  value={selectedFilters.provider}
                  onChange={(value) => applyFilters({ provider: value, thread: "" })}
                >
                  <option value="">All providers</option>
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option>
                </InboxSelect>
                <InboxSelect
                  value={selectedFilters.dealId}
                  onChange={(value) => applyFilters({ dealId: value, thread: "" })}
                >
                  <option value="">All deals</option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.campaignName}
                    </option>
                  ))}
                </InboxSelect>
                <button
                  type="submit"
                  className="h-12 border border-black/10 px-5 text-[13px] font-semibold text-foreground transition hover:border-black/20"
                >
                  Search
                </button>
              </form>
            </div>
          </div>

          {errorMessage ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 overflow-hidden gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden border border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              <div className="shrink-0 border-b border-black/8 px-5 py-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[17px] font-semibold text-foreground">Threads</h2>
                  <span className="bg-secondary/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {threads.length}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#fcfcfa] dark:bg-transparent">
                {threads.length === 0 ? (
                  <div className="px-5 py-6 text-[13px] text-muted-foreground">
                    No synced threads match the current filters.
                  </div>
                ) : (
                  threads.map((item) => {
                    const active = item.thread.id === activeThreadId;

                    return (
                      <button
                        key={item.thread.id}
                        type="button"
                        onClick={() => void loadThread(item.thread.id)}
                        onMouseEnter={() => void prefetchThread(item.thread.id)}
                        onFocus={() => void prefetchThread(item.thread.id)}
                        className={`block w-full border-b border-black/6 px-4 py-3 text-left transition dark:border-white/8 ${
                          active ? "bg-secondary/30" : "hover:bg-secondary/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-secondary/50 text-sm font-semibold text-foreground">
                            {initialsFromParticipant(item.thread.participants[0])}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[14px] font-semibold leading-5 text-foreground">
                                  {participantLabel(item.thread.participants[0])}
                                </p>
                                <p className="truncate text-[13px] text-foreground/90">
                                  {item.thread.subject}
                                </p>
                              </div>
                              <p className="shrink-0 text-right text-[11px] text-muted-foreground">
                                {formatDate(item.thread.lastMessageAt)}
                              </p>
                            </div>

                            <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                              {item.thread.snippet || "No preview available."}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="bg-white px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                                {providerLabel(item.account.provider)}
                              </span>
                              {item.links.map((link) => (
                                <span
                                  key={link.id}
                                  className="bg-[#f4efe4] px-2.5 py-1 text-[10px] font-medium text-[#8a5c12]"
                                >
                                  {link.campaignName}
                                </span>
                              ))}
                              {item.thread.aiSummary ? (
                                <span className="bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
                                  AI summary
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden border border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              {!selectedThread ? (
                <div className="px-6 py-10 text-[13px] text-muted-foreground">
                  Select a thread to see the full conversation.
                </div>
              ) : (
                <>
                  <div className="shrink-0 border-b border-black/8 px-6 py-5 dark:border-white/10 dark:bg-white/[0.02]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground shadow-sm dark:bg-white/10">
                            {providerLabel(selectedThread.account.provider)}
                          </span>
                          <span className="bg-white px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm dark:bg-white/10">
                            {selectedThread.account.emailAddress}
                          </span>
                          {selectedThread.thread.aiSummary ? (
                            <span className="bg-emerald-50 px-3 py-1 text-[10px] font-medium text-emerald-700">
                              Summary ready
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-3 max-w-4xl text-[23px] font-semibold tracking-[-0.04em] text-foreground">
                          {selectedThread.thread.subject}
                        </h2>
                      </div>

                      <div className="relative shrink-0" ref={actionMenuRef}>
                        <button
                          type="button"
                          onClick={() => setIsActionMenuOpen((current) => !current)}
                          className="inline-flex h-9 w-9 items-center justify-center border border-black/10 text-foreground transition hover:border-black/20"
                          aria-label="Thread actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {isActionMenuOpen ? (
                          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 border border-black/8 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#161a20]">
                            <button
                              type="button"
                              onClick={() => void summarizeThread()}
                              disabled={isSummarizing}
                              className="block w-full px-3 py-2 text-left text-[13px] text-foreground transition hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSummarizing ? "Summarizing..." : "Generate summary"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void draftReply()}
                              disabled={isDrafting}
                              className="block w-full px-3 py-2 text-left text-[13px] text-foreground transition hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDrafting ? "Drafting..." : "Draft reply"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsActionMenuOpen(false);
                                setIsLinkModalOpen(true);
                              }}
                              className="block w-full px-3 py-2 text-left text-[13px] text-foreground transition hover:bg-secondary/40"
                            >
                              Link deal
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden p-5">
                    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-[#161a20]">
                      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <div className="space-y-5">
                          {isThreadLoading ? (
                            <div className="border border-black/8 px-5 py-4 text-[13px] text-muted-foreground dark:border-white/10">
                              Loading thread...
                            </div>
                          ) : null}

                          {summary ? (
                            <section className="border border-emerald-200 bg-emerald-50 px-5 py-4">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">
                                AI summary
                              </p>
                              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-emerald-900">
                                {summary}
                              </p>
                            </section>
                          ) : null}

                          {draft ? (
                            <section className="border border-black/8 px-5 py-4 dark:border-white/10">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                Draft reply
                              </p>
                              <p className="mt-3 text-[13px] font-semibold text-foreground">
                                {draft.subject}
                              </p>
                              <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-foreground">
                                {draft.body}
                              </pre>
                            </section>
                          ) : null}

                          {earlierMessages.length > 0 ? (
                            <section className="space-y-3">
                              {earlierMessages.map((message) => (
                                <MessageStrip
                                  key={message.id}
                                  message={message}
                                  isOutbound={message.direction === "outbound"}
                                />
                              ))}
                            </section>
                          ) : null}

                          {latestMessage ? (
                            <section className="bg-white dark:bg-[#161a20]">
                              <div className="border-b border-black/8 px-6 py-3 dark:border-white/10">
                                <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                  <div
                                    className={`flex h-12 w-12 shrink-0 items-center justify-center text-sm font-semibold ${
                                      latestMessage.direction === "outbound"
                                        ? "bg-foreground text-background"
                                        : "bg-secondary/60 text-foreground"
                                    }`}
                                  >
                                    {latestMessage.direction === "outbound"
                                      ? "You"
                                      : initialsFromParticipant(latestMessage.from)}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className="text-[15px] font-semibold text-foreground">
                                      {latestMessage.direction === "outbound"
                                        ? "You"
                                        : participantLabel(latestMessage.from)}
                                    </p>
                                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                                      {latestMessage.direction === "outbound"
                                        ? `To: ${latestMessage.to.map(participantLabel).join(", ")}`
                                        : latestMessage.from?.email || ""}
                                    </p>
                                  </div>
                                </div>
                                </div>
                              </div>

                              <div className="px-8 py-7">
                                <div
                                  className="whitespace-pre-wrap text-[14px] leading-8 text-foreground"
                                >
                                  {latestMessage.textBody || "No text body available."}
                                </div>

                                <AttachmentShelf attachments={latestMessage.attachments} />
                              </div>
                            </section>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {selectedThread && isLinkModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md border border-black/8 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#161a20]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Link deal
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  Attach thread to a deal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center border border-black/10 text-foreground transition hover:border-black/20"
                aria-label="Close link deal modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Select a deal to link or unlink this thread from your workspace context.
            </p>

            <div className="mt-5 space-y-4">
              <InboxSelect
                value={selectedDealId}
                onChange={setSelectedDealId}
              >
                <option value="">Select a deal</option>
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.campaignName}
                  </option>
                ))}
              </InboxSelect>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="h-11 border border-black/10 px-4 text-sm font-semibold text-foreground transition hover:border-black/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void linkSelectedDeal()}
                  disabled={!selectedDealId || isLinking}
                  className="h-11 border border-black/10 px-4 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLinking
                    ? "Updating..."
                    : linkedDealIds.has(selectedDealId)
                      ? "Unlink from deal"
                      : "Link to deal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
