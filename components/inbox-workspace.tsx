"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleDot,
  File,
  FileImage,
  MailSearch,
  FileText,
  FileVideo,
  Inbox,
  Info,
  LoaderCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  X,
  XCircle
} from "lucide-react";

import { AppTooltip } from "@/components/app-tooltip";
import { AttachmentDocumentPreview } from "@/components/attachment-document-preview";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { captureAppEvent } from "@/lib/posthog/events";
import { useInboxCandidateDiscovery } from "@/components/use-inbox-candidate-discovery";
import { useInboxReplyComposer } from "@/components/use-inbox-reply-composer";
import { useInboxThreadDetailState } from "@/components/use-inbox-thread-detail-state";
import { useInboxThreadSelection } from "@/components/use-inbox-thread-selection";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildReplySuggestionThreadVersion } from "@/lib/email/reply-suggestion-version";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  DealRecord,
  EmailActionItemRecord,
  EmailAttachmentRecord,
  EmailDealEventRecord,
  EmailMessageRecord,
  EmailParticipant,
  EmailThreadDetail,
  EmailThreadListItem,
  EmailThreadPreviewStateRecord,
  NegotiationStance
} from "@/lib/types";
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

function threadSearchText(item: EmailThreadListItem) {
  return [
    item.thread.subject,
    item.thread.snippet,
    item.account.emailAddress,
    item.account.provider,
    ...item.thread.participants.flatMap((participant) => [
      participant.name ?? "",
      participant.email,
    ]),
    ...item.links.map((link) => link.campaignName),
  ]
    .join(" ")
    .toLowerCase();
}

function latestUpdatedAt(items: Array<{ updatedAt: string }>) {
  return items.reduce<string | null>((latest, item) => {
    if (!latest || item.updatedAt > latest) {
      return item.updatedAt;
    }

    return latest;
  }, null);
}

function hasUnseenPreviewSection(latestAt: string | null, seenAt: string | null | undefined) {
  if (!latestAt) {
    return false;
  }

  return !seenAt || latestAt > seenAt;
}

function isPreviewSectionCleared(latestAt: string | null, clearedAt: string | null | undefined) {
  if (!latestAt || !clearedAt) {
    return false;
  }

  return latestAt <= clearedAt;
}

type PreviewUpdateEntry = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
  href?: string;
  ctaLabel?: string;
};

type DraftPromptSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

type DraftPromptSuggestionCacheEntry = {
  version: string;
  suggestions: DraftPromptSuggestion[];
};

const DRAFT_REFINEMENT_OPTIONS = {
  length: [
    {
      label: "Shorter",
      instruction: "Revise the current draft to be shorter and tighter while preserving the same intent and asks."
    },
    {
      label: "Longer",
      instruction: "Revise the current draft to be a bit fuller and more detailed while preserving the same intent and asks."
    }
  ],
  tone: [
    {
      label: "Formal",
      instruction: "Revise the current draft to sound more formal and polished while keeping the same message."
    },
    {
      label: "Relaxed",
      instruction: "Revise the current draft to sound more relaxed and conversational while keeping it professional."
    },
    {
      label: "Warm",
      instruction: "Revise the current draft to feel warmer and more personable while keeping the same core message."
    }
  ],
  focus: [
    {
      label: "Clarify asks",
      instruction: "Revise the current draft to focus more clearly on the questions or clarifications you need from the brand."
    },
    {
      label: "Protect terms",
      instruction: "Revise the current draft to focus more on protecting boundaries, scope, timing, and commercial terms."
    },
    {
      label: "Close next steps",
      instruction: "Revise the current draft to end with clearer next steps and a stronger call to action."
    }
  ]
} as const;

const DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY =
  "hellobrand:inbox:draft-prompt-suggestions";

function loadDraftPromptSuggestionCache() {
  if (typeof window === "undefined") {
    return {} as Record<string, DraftPromptSuggestionCacheEntry>;
  }

  try {
    const raw = window.sessionStorage.getItem(DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY);
    if (!raw) {
      return {} as Record<string, DraftPromptSuggestionCacheEntry>;
    }

    const parsed = JSON.parse(raw) as Record<
      string,
      Partial<DraftPromptSuggestionCacheEntry> | undefined
    >;

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        return (
          Boolean(value?.version) &&
          Array.isArray(value?.suggestions)
        );
      })
    ) as Record<string, DraftPromptSuggestionCacheEntry>;
  } catch {
    return {} as Record<string, DraftPromptSuggestionCacheEntry>;
  }
}

function stancePromptSuggestion(stance: NegotiationStance | ""): DraftPromptSuggestion {
  switch (stance) {
    case "firm":
      return {
        id: "tone-firm",
        label: "Keep it direct",
        prompt:
          "Write the reply in a firm, direct tone. Protect our current position, avoid unnecessary concessions, and only make commitments already supported by the linked workspace context.",
      };
    case "exploratory":
      return {
        id: "tone-exploratory",
        label: "Lead with questions",
        prompt:
          "Write the reply in an exploratory tone. Ask clarifying questions where the thread or workspace context is incomplete, and avoid locking in details that are not yet confirmed.",
      };
    case "collaborative":
    default:
      return {
        id: "tone-collaborative",
        label: "Keep it balanced",
        prompt:
          "Write the reply in a collaborative tone. Keep it constructive, move the conversation forward, and align the response with the linked workspace context and current thread.",
      };
  }
}

function replyStyleLabel(stance: NegotiationStance) {
  switch (stance) {
    case "firm":
      return "Direct";
    case "exploratory":
      return "Clarifying";
    case "collaborative":
    default:
      return "Balanced";
  }
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
        className="h-11 w-full appearance-none border border-border bg-white px-4 pr-12 text-[13px] text-foreground outline-none transition focus:border-primary"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          backgroundImage: "none"
        }}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center border-l border-border/80">
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

function attachmentPreviewMode(attachment: EmailAttachmentRecord) {
  if (attachment.mimeType.startsWith("image/")) {
    return "image" as const;
  }

  if (attachment.mimeType.startsWith("video/")) {
    return "video" as const;
  }

  if (
    attachment.mimeType.includes("pdf") ||
    attachment.filename.toLowerCase().endsWith(".pdf")
  ) {
    return "pdf" as const;
  }

  if (
    attachment.mimeType.startsWith("text/") ||
    attachment.filename.toLowerCase().endsWith(".txt")
  ) {
    return "text" as const;
  }

  return "download" as const;
}

function AttachmentShelf({ attachments }: { attachments: EmailAttachmentRecord[] }) {
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachmentRecord | null>(null);

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
            <button
              key={attachment.id}
              type="button"
              onClick={() => setPreviewAttachment(attachment)}
              className="border border-black/8 bg-white p-3 text-left shadow-[0_1px_0_rgba(17,24,39,0.04)] transition hover:border-black/20 hover:bg-secondary/20 dark:border-white/10 dark:bg-[#161a20] dark:hover:border-white/20"
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
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <AttachmentPreviewDialog
        attachment={previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
          }
        }}
      />
    </div>
  );
}

function AttachmentPreviewDialog({
  attachment,
  onOpenChange
}: {
  attachment: EmailAttachmentRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const mode = attachment ? attachmentPreviewMode(attachment) : null;
  const previewUrl = attachment
    ? `/api/email/attachments/${attachment.id}`
    : "";
  const downloadUrl = attachment
    ? `/api/email/attachments/${attachment.id}?download=1`
    : "";

  return (
    <Dialog open={Boolean(attachment)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-3rem)] max-w-[min(1100px,calc(100vw-2rem))] overflow-hidden p-0">
        {attachment ? (
          <div className="flex h-[min(82vh,900px)] flex-col">
            <DialogHeader className="shrink-0 border-b border-black/8 px-6 py-4 text-left">
              <DialogTitle className="pr-10 text-base">{attachment.filename}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-[12px]">
                <span>{attachment.mimeType}</span>
                <span>·</span>
                <span>{formatAttachmentSize(attachment.sizeBytes)}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 bg-[#f6f6f1]">
              {mode === "image" ? (
                <div className="flex h-full items-center justify-center p-4">
                  <img
                    src={previewUrl}
                    alt={attachment.filename}
                    className="max-h-full max-w-full object-contain shadow-lg"
                  />
                </div>
              ) : mode === "video" ? (
                <div className="flex h-full items-center justify-center p-4">
                  <video
                    controls
                    className="max-h-full max-w-full bg-black shadow-lg"
                    src={previewUrl}
                  />
                </div>
              ) : mode === "pdf" || mode === "text" ? (
                <AttachmentDocumentPreview
                  kind={mode}
                  previewUrl={previewUrl}
                  downloadUrl={downloadUrl}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="max-w-md text-sm text-muted-foreground">
                    This file type may not render inline in the browser. Open it in a new tab to preview or download it.
                  </p>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
            </div>

            {mode !== "download" ? (
              <div className="shrink-0 border-t border-black/8 px-6 py-3">
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[12px] font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Open in new tab
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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

function ActionItemRow({ item }: { item: EmailActionItemRecord }) {
  const [status, setStatus] = useState(item.status);
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateStatus(newStatus: "completed" | "dismissed") {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/email/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        setStatus(newStatus);
      }
    } catch {
      // silently fail
    } finally {
      setIsUpdating(false);
    }
  }

  if (status !== "pending") {
    return null;
  }

  return (
    <div className="flex items-start gap-3 border-l-2 border-[#b42318]/30 pl-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-foreground">{item.action}</p>
        {item.dueDate ? (
          <p className="mt-1 text-[11px] text-[#b42318]">Due: {formatDate(item.dueDate)}</p>
        ) : null}
        {item.sourceText ? (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            &ldquo;{item.sourceText}&rdquo;
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className={`px-2 py-0.5 text-[9px] font-medium uppercase ${
          item.urgency === "high"
            ? "bg-[#fecaca] text-[#991b1b]"
            : item.urgency === "medium"
            ? "bg-[#fef3c7] text-[#92400e]"
            : "bg-[#e0e7ff] text-[#3730a3]"
        }`}>
          {item.urgency}
        </span>
        <button
          type="button"
          onClick={() => void updateStatus("completed")}
          disabled={isUpdating}
          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition hover:text-[#16a34a] disabled:opacity-50"
          aria-label="Complete"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void updateStatus("dismissed")}
          disabled={isUpdating}
          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function InboxWorkspace({
  threads,
  selectedThread: initialSelectedThread,
  threadPreviewStates: initialThreadPreviewStates,
  deals,
  hasConnectedAccounts,
  connectedProviders,
  selectedFilters
}: {
  threads: EmailThreadListItem[];
  selectedThread: EmailThreadDetail | null;
  threadPreviewStates: Record<string, EmailThreadPreviewStateRecord>;
  deals: DealRecord[];
  hasConnectedAccounts: boolean;
  connectedProviders: string[];
  selectedFilters: {
    q: string;
    provider: string;
    accountId: string;
    dealId: string;
  };
}) {
  const router = useRouter();
  const posthog = usePostHog();
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const aiReplyControlRef = useRef<HTMLDivElement | null>(null);
  const promptActionControlRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState(selectedFilters.q);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(!!initialSelectedThread);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiSuggestionCache, setAiSuggestionCache] = useState<
    Record<string, DraftPromptSuggestionCacheEntry>
  >(loadDraftPromptSuggestionCache);
  const [loadingSuggestionThreadIds, setLoadingSuggestionThreadIds] = useState<
    Record<string, true>
  >({});
  const [aiReplyMenuWidth, setAiReplyMenuWidth] = useState<number | null>(null);
  const [promptActionMenuWidth, setPromptActionMenuWidth] = useState<number | null>(null);
  const aiSuggestionCacheRef = useRef(aiSuggestionCache);
  const suggestionRequestVersionsRef = useRef<Record<string, string>>({});
  const {
    candidateGroups,
    cancelDiscovery,
    closeCandidateModal,
    discoverCandidates,
    dismissCandidate,
    isCandidateModalOpen,
    isDiscovering,
    isReviewingCandidates,
    reviewCandidates,
    selectedCandidateIds,
    toggleCandidate
  } = useInboxCandidateDiscovery({
    onErrorMessage: setErrorMessage,
    onRefresh: () => router.refresh()
  });
  const {
    activeThreadId,
    isThreadLoading,
    loadThread: loadSelectedThread,
    prefetchThread,
    selectedThread,
    selectedThreadId
  } = useInboxThreadSelection({
    initialSelectedThread,
    onErrorMessage: setErrorMessage,
    threads
  });
  const linkedDealIds = useMemo(
    () => new Set(selectedThread?.links.map((link) => link.dealId) ?? []),
    [selectedThread]
  );
  const {
    areActionItemsOpen,
    arePreviewUpdatesOpen,
    clearPreviewUpdates,
    handleActionItemsOpenChange,
    handlePreviewUpdatesOpenChange,
    isLinkModalOpen,
    isLinking,
    isSummarizing,
    isSummaryDialogOpen,
    linkSelectedDeal,
    selectedDealId,
    setLinkModalOpen,
    setSelectedDealId,
    setSummaryDialogOpen,
    summarizeThread,
    summary,
    threadPreviewStates
  } = useInboxThreadDetailState({
    initialSelectedThread,
    initialThreadPreviewStates,
    linkedDealIds,
    onErrorMessage: setErrorMessage,
    onRefresh: () => router.refresh(),
    selectedThread,
    selectedThreadId
  });
  const {
    draft,
    replySubject,
    replyBody,
    replyJourney,
    isDrafting,
    replyStance,
    isPromptCommandOpen,
    draftInstructions,
    openRefinementPopover,
    trimmedDraftInstructions,
    shouldHighlightAiReply,
    canRefineGeneratedReply,
    canClearReplyText,
    canSendReply,
    replyBodyRef,
    setReplyStance,
    setPromptCommandOpen,
    setDraftInstructions,
    setOpenRefinementPopover,
    handleReplyBodyChange,
    applyPromptToNextDraft,
    clearPromptDialog,
    draftReply,
    usePromptForDraft,
    cancelDraftReply,
    clearDraftComposer,
    refineGeneratedDraft
  } = useInboxReplyComposer({
    selectedDealId,
    selectedThread,
    setErrorMessage
  });

  useEffect(() => {
    setErrorMessage(null);
    setIsActionMenuOpen(false);
  }, [selectedThread]);

  useEffect(() => {
    const control = aiReplyControlRef.current;
    if (!control) {
      return;
    }

    const updateWidth = () => {
      setAiReplyMenuWidth(control.getBoundingClientRect().width);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(control);

    return () => {
      observer.disconnect();
    };
  }, [replyJourney, isDrafting]);

  useEffect(() => {
    const control = promptActionControlRef.current;
    if (!control) {
      return;
    }

    const updateWidth = () => {
      setPromptActionMenuWidth(control.getBoundingClientRect().width);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(control);

    return () => {
      observer.disconnect();
    };
  }, [draftInstructions, isDrafting]);

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

  useEffect(() => {
    aiSuggestionCacheRef.current = aiSuggestionCache;

    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY,
      JSON.stringify(aiSuggestionCache)
    );
  }, [aiSuggestionCache]);

  const selectedMessages = selectedThread?.messages ?? [];
  const latestMessage = selectedMessages[selectedMessages.length - 1] ?? null;
  const earlierMessages = latestMessage ? selectedMessages.slice(0, -1) : [];
  const hasLinkedThreads = threads.length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredThreads = useMemo(() => {
    if (!normalizedQuery) {
      return threads;
    }

    return threads.filter((item) => threadSearchText(item).includes(normalizedQuery));
  }, [normalizedQuery, threads]);
  const selectedThreadDeals = useMemo(() => {
    const byId = new Map(deals.map((deal) => [deal.id, deal]));
    return selectedThread?.links
      .map((link) => byId.get(link.dealId))
      .filter((entry): entry is DealRecord => Boolean(entry)) ?? [];
  }, [deals, selectedThread]);
  const selectedThreadSuggestionVersion = useMemo(
    () =>
      selectedThread ? buildReplySuggestionThreadVersion(selectedThread.thread) : null,
    [
      selectedThread?.thread.updatedAt,
      selectedThread?.thread.lastMessageAt,
      selectedThread?.thread.messageCount
    ]
  );
  const selectedThreadPreviewState = selectedThread
    ? threadPreviewStates[selectedThread.thread.id] ?? null
    : null;
  const selectedThreadUpdates = useMemo<PreviewUpdateEntry[]>(() => {
    if (!selectedThread) {
      return [];
    }

    const eventUpdates = selectedThread.importantEvents.map((event) => ({
      id: `event:${event.id}`,
      title: event.title,
      body: event.body,
      updatedAt: event.updatedAt
    }));

    const termUpdates = selectedThread.termSuggestions.map((suggestion) => ({
      id: `term:${suggestion.id}`,
      title: suggestion.title,
      body: suggestion.summary,
      updatedAt: suggestion.updatedAt,
      href: `/app/p/${suggestion.dealId}?tab=terms`,
      ctaLabel: "Review terms"
    }));

    return [...eventUpdates, ...termUpdates].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }, [selectedThread]);
  const latestPreviewUpdateAt = useMemo(
    () => latestUpdatedAt(selectedThreadUpdates),
    [selectedThreadUpdates]
  );
  const latestActionItemAt = useMemo(
    () => latestUpdatedAt(selectedThread?.actionItems ?? []),
    [selectedThread?.actionItems]
  );
  const hasUnseenPreviewUpdates = hasUnseenPreviewSection(
    latestPreviewUpdateAt,
    selectedThreadPreviewState?.previewUpdatesSeenAt
  );
  const arePreviewUpdatesCleared = isPreviewSectionCleared(
    latestPreviewUpdateAt,
    selectedThreadPreviewState?.previewUpdatesClearedAt
  );
  const shouldShowPreviewUpdates =
    selectedThreadUpdates.length > 0 && !arePreviewUpdatesCleared;
  const hasUnseenActionItems = hasUnseenPreviewSection(
    latestActionItemAt,
    selectedThreadPreviewState?.actionItemsSeenAt
  );

  const prefetchThreadSuggestions = useCallback(
    async (
      thread: Pick<
        EmailThreadDetail["thread"],
        "id" | "updatedAt" | "lastMessageAt" | "messageCount"
      >
    ) => {
      const version = buildReplySuggestionThreadVersion(thread);
      const cached = aiSuggestionCacheRef.current[thread.id];

      if (cached?.version === version && cached.suggestions.length > 0) {
        return;
      }

      if (suggestionRequestVersionsRef.current[thread.id] === version) {
        return;
      }

      suggestionRequestVersionsRef.current[thread.id] = version;
      setLoadingSuggestionThreadIds((current) => ({
        ...current,
        [thread.id]: true
      }));

      try {
        const response = await fetch(`/api/email/threads/${thread.id}/suggestions`);
        const payload = await response.json();

        if (!response.ok || !Array.isArray(payload.suggestions)) {
          return;
        }

        setAiSuggestionCache((current) => {
          const existing = current[thread.id];
          if (existing?.version === version && existing.suggestions.length > 0) {
            return current;
          }

          return {
            ...current,
            [thread.id]: {
              version,
              suggestions: payload.suggestions as DraftPromptSuggestion[]
            }
          };
        });
      } catch {
        // Keep fallback suggestions when prefetch fails.
      } finally {
        if (suggestionRequestVersionsRef.current[thread.id] === version) {
          delete suggestionRequestVersionsRef.current[thread.id];
        }

        setLoadingSuggestionThreadIds((current) => {
          if (!current[thread.id]) {
            return current;
          }

          const next = { ...current };
          delete next[thread.id];
          return next;
        });
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedThread || !selectedThreadSuggestionVersion) {
      return;
    }

    const cached = aiSuggestionCacheRef.current[selectedThread.thread.id];
    if (!cached || cached.version === selectedThreadSuggestionVersion) {
      return;
    }

    setAiSuggestionCache((current) => {
      const existing = current[selectedThread.thread.id];
      if (!existing || existing.version === selectedThreadSuggestionVersion) {
        return current;
      }

      const next = { ...current };
      delete next[selectedThread.thread.id];
      return next;
    });
  }, [selectedThread, selectedThreadSuggestionVersion]);

  useEffect(() => {
    if (!selectedThread) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void prefetchThreadSuggestions(selectedThread.thread);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [
    prefetchThreadSuggestions,
    selectedThread?.thread.id,
    selectedThread?.thread.updatedAt,
    selectedThread?.thread.lastMessageAt,
    selectedThread?.thread.messageCount
  ]);

  useEffect(() => {
    if (!isPromptCommandOpen || !selectedThread) {
      return;
    }

    void prefetchThreadSuggestions(selectedThread.thread);
  }, [isPromptCommandOpen, prefetchThreadSuggestions, selectedThread]);

  const currentAiSuggestions = useMemo(() => {
    if (!selectedThread || !selectedThreadSuggestionVersion) {
      return [];
    }

    const cached = aiSuggestionCache[selectedThread.thread.id];
    if (!cached || cached.version !== selectedThreadSuggestionVersion) {
      return [];
    }

    return cached.suggestions;
  }, [aiSuggestionCache, selectedThread, selectedThreadSuggestionVersion]);

  const linkableDeals = useMemo(
    () => deals.filter((deal) => deal.status !== "completed" && deal.status !== "paid"),
    [deals]
  );

  const isLoadingSuggestions = Boolean(
    selectedThread && loadingSuggestionThreadIds[selectedThread.thread.id]
  );

  const promptSuggestions = useMemo(() => {
    if (currentAiSuggestions.length > 0) {
      return currentAiSuggestions;
    }

    // Static fallbacks while AI suggestions load
    return [
      { id: "fallback-0", label: "Ask for more details on deliverables", prompt: "Ask the brand to clarify the deliverables, timeline, or creative direction." },
      { id: "fallback-1", label: "Push back on the terms politely", prompt: "Politely push back on terms that feel unfavorable. Suggest alternatives." },
      { id: "fallback-2", label: "Confirm availability and interest", prompt: "Write a brief reply confirming availability and interest without overcommitting." },
    ].slice(0, 3);
  }, [currentAiSuggestions]);
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
      setMobileDetailOpen(true);
      return;
    }

    window.history.replaceState(null, "", buildInboxUrl({ thread: threadId }));
    setMobileDetailOpen(true);
    await loadSelectedThread(threadId);
  }

  if (deals.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col px-5 py-4 lg:px-8 lg:py-5">
        <div className="mx-auto w-full max-w-[1520px]">
          <h1 className="text-[31px] font-semibold tracking-[-0.05em] text-foreground lg:text-[36px]">
            Inbox
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Your inbox will show email threads linked to your partnerships.
          </p>
          <div className="mt-12 flex flex-col items-center text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-foreground">
              No workspaces yet
            </p>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Create a workspace first, then connect your email to start matching threads to your deals.
            </p>
            <Link
              href="/app/intake/new"
              onClick={() =>
                captureAppEvent(posthog, "workspace_entry_cta_clicked", {
                  source: "inbox_empty_state"
                })
              }
              className="mt-5 inline-flex h-10 items-center gap-2 bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New workspace
            </Link>
          </div>
        </div>
      </div>
    );
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
               
              </div>

              <div className="flex items-center gap-3">
                {hasConnectedAccounts && hasLinkedThreads ? (
                  <AppTooltip
                    content="Find emails"
                    sideOffset={8}
                  >
                    <button
                      type="button"
                      onClick={() => void discoverCandidates()}
                      disabled={isDiscovering}
                      aria-label={isDiscovering ? "Finding emails" : "Find emails"}
                      className="inline-flex h-11 items-center justify-center px-1 text-foreground transition hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-white/70"
                    >
                      <MailSearch
                        strokeWidth={1.5}
                        className={`h-5 w-5 shrink-0 ${isDiscovering ? "animate-pulse" : ""}`}
                      />
                    </button>
                  </AppTooltip>
                ) : null}
                <div className="w-full max-w-sm">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search linked emails"
                    aria-label="Search linked emails"
                    className="h-11 rounded-none border-black/10 bg-white text-[13px] shadow-none dark:border-white/10 dark:bg-[#161a1f]"
                  />
                </div>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {!hasLinkedThreads ? (
            <section className="flex min-h-0 flex-1 items-center justify-center border border-black/8 bg-white px-8 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <div className="max-w-xl">
                <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                  Smart inbox
                </p>
                <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                  Build your deal inbox
                </h2>
                <p className="mt-4 text-[14px] leading-7 text-muted-foreground">
                  Search connected inboxes, review likely matches, and keep this inbox focused on linked deal conversations.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {hasConnectedAccounts ? (
                    <AppTooltip
                      content="We search recent synced mail first, then keep expanding in the background."
                      sideOffset={8}
                    >
                      <button
                        type="button"
                        onClick={() => void discoverCandidates()}
                        disabled={isDiscovering}
                        aria-label="Find emails"
                        className="inline-flex h-12 min-w-[15rem] items-center justify-center gap-2 border border-black/10 px-6 text-[13px] font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>{isDiscovering ? "Finding emails..." : "Find emails"}</span>
                        <Info className="h-4 w-4 shrink-0 text-[#98a2b3]" />
                      </button>
                    </AppTooltip>
                  ) : (
                    <a
                      href="/app/settings"
                      onClick={() =>
                        captureAppEvent(posthog, "inbox_connect_email_clicked", {
                          source: "inbox_empty_state"
                        })
                      }
                      className="inline-flex h-12 items-center border border-black/10 px-6 text-[13px] font-semibold text-foreground transition hover:border-black/20"
                    >
                      Connect email accounts
                    </a>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <div className="grid min-h-0 flex-1 overflow-hidden gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <section className={`flex min-h-0 flex-col overflow-hidden border border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03] ${mobileDetailOpen ? "hidden xl:flex" : ""}`}>
                <div className="shrink-0 border-b border-black/8 px-5 py-4 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[17px] font-semibold text-foreground">Linked Threads</h2>
                    <span className="bg-secondary/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {filteredThreads.length}
                    </span>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                    }}
                    className="mt-4 grid gap-3 sm:grid-cols-2"
                  >
                    <InboxSelect
                      value={selectedFilters.provider}
                      onChange={(value) => applyFilters({ provider: value, thread: "" })}
                    >
                      <option value="">All providers</option>
                      <option value="gmail" disabled={!connectedProviders.includes("gmail")}>Gmail</option>
                      <option value="outlook" disabled={!connectedProviders.includes("outlook")}>Outlook</option>
                      <option value="yahoo" disabled={!connectedProviders.includes("yahoo")}>Yahoo</option>
                    </InboxSelect>
                    <InboxSelect
                      value={selectedFilters.dealId}
                      onChange={(value) => applyFilters({ dealId: value, thread: "" })}
                    >
                      <option value="">All partnerships</option>
                      {deals.map((deal) => {
                        const labels = getDisplayDealLabels(deal);

                        return (
                          <option key={deal.id} value={deal.id}>
                            {labels.campaignName ?? deal.campaignName}
                          </option>
                        );
                      })}
                    </InboxSelect>
                  </form>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-transparent">
                  {filteredThreads.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-muted-foreground">
                      No linked emails match your search.
                    </div>
                  ) : filteredThreads.map((item) => {
                    const active = item.thread.id === activeThreadId;
                    const itemPreviewState = threadPreviewStates[item.thread.id];
                    const threadHasUnseenUpdates =
                      item.importantEventCount > 0 &&
                      hasUnseenPreviewSection(
                        item.latestImportantEventAt,
                        itemPreviewState?.previewUpdatesSeenAt
                      );
                    const threadHasUnseenActionItems =
                      item.pendingActionItemCount > 0 &&
                      hasUnseenPreviewSection(
                        item.latestPendingActionItemAt,
                        itemPreviewState?.actionItemsSeenAt
                      );

                    return (
                      <button
                        key={item.thread.id}
                        type="button"
                        onClick={() => {
                          void prefetchThreadSuggestions(item.thread);
                          void loadThread(item.thread.id);
                        }}
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
                                <p className="truncate text-[13px] font-semibold leading-5 text-foreground">
                                  {participantLabel(item.thread.participants[0])}
                                </p>
                                <p className="truncate text-[12px] text-foreground/90">
                                  {item.thread.subject}
                                </p>
                              </div>
                              <p className="shrink-0 text-right text-[11px] text-muted-foreground">
                                {formatDate(item.thread.lastMessageAt)}
                              </p>
                            </div>

                            <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                              {item.thread.snippet || "No preview available."}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="bg-white px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                                {providerLabel(item.account.provider)}
                              </span>
                              {item.importantEventCount > 0 ? (
                                <span className="inline-flex items-center gap-1.5 bg-[#eef3ff] px-2.5 py-1 text-[10px] font-medium text-[#3152a3]">
                                  {threadHasUnseenUpdates ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#3152a3]" />
                                  ) : null}
                                  {item.importantEventCount} update{item.importantEventCount === 1 ? "" : "s"}
                                </span>
                              ) : null}
                              {item.pendingActionItemCount > 0 ? (
                                <span className="inline-flex items-center gap-1.5 bg-[#fef3f2] px-2.5 py-1 text-[10px] font-medium text-[#b42318]">
                                  {threadHasUnseenActionItems ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#b42318]" />
                                  ) : null}
                                  {item.pendingActionItemCount} action{item.pendingActionItemCount === 1 ? "" : "s"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={`flex min-h-0 flex-col overflow-hidden border border-black/8 bg-white xl:mr-28 dark:border-white/10 dark:bg-white/[0.03] ${!mobileDetailOpen ? "hidden xl:flex" : ""}`}>
                {!selectedThread ? (
                  <div className="px-6 py-10 text-[13px] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setMobileDetailOpen(false)}
                      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground xl:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to threads
                    </button>
                    <p>Select a thread to see the full conversation.</p>
                  </div>
                ) : (
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="shrink-0 border-b border-black/8 px-6 py-5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setMobileDetailOpen(false)}
                        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground xl:hidden"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to threads
                      </button>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground shadow-sm">
                              {providerLabel(selectedThread.account.provider)}
                            </span>
                            <span className="bg-white px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                              {selectedThread.account.emailAddress}
                            </span>
                          </div>
                          <h2 className="mt-3 max-w-4xl text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                            {selectedThread.thread.subject}
                          </h2>
                        </div>

                        <div className="relative shrink-0" ref={actionMenuRef}>
                          <button
                            type="button"
                            onClick={() => setIsActionMenuOpen((current) => !current)}
                            className="inline-flex h-8 w-8 items-center justify-center border border-black/10 text-foreground transition hover:border-black/20"
                            aria-label="Thread actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {isActionMenuOpen ? (
                            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 border border-black/8 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#161a20]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsActionMenuOpen(false);
                                    void summarizeThread();
                                  }}
                                  disabled={isSummarizing}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                {isSummarizing ? "Summarizing..." : "Generate summary"}
                              </button>
                              <div className="border-b border-black/6 pb-1 mb-1">
                                <p className="px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                  Reply style
                                </p>
                                <div className="flex gap-1 px-3 py-1">
                                  {(["firm", "collaborative", "exploratory"] as const).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setReplyStance(s)}
                                      className={`px-2 py-1 text-[10px] font-medium transition ${
                                        replyStance === s
                                          ? "bg-foreground text-background"
                                          : "bg-secondary/60 text-foreground hover:bg-secondary/85"
                                      }`}
                                    >
                                      {replyStyleLabel(s)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsActionMenuOpen(false);
                                    setLinkModalOpen(true);
                                  }}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80"
                                >
                                Link partnership
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                          <div className="space-y-5">
                            {isThreadLoading ? (
                              <div className="border border-black/8 px-5 py-4 text-[12px] text-muted-foreground">
                                Loading thread...
                              </div>
                            ) : null}

                            {shouldShowPreviewUpdates ? (
                              <Collapsible
                                open={arePreviewUpdatesOpen}
                                onOpenChange={(open) =>
                                  handlePreviewUpdatesOpenChange(
                                    open,
                                    hasUnseenPreviewUpdates,
                                    latestPreviewUpdateAt
                                  )
                                }
                              >
                                <section className="border border-black/6 px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <CollapsibleTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center justify-between text-left"
                                        aria-label={
                                          arePreviewUpdatesOpen
                                            ? "Collapse preview updates"
                                            : "Expand preview updates"
                                        }
                                      >
                                        <div className="flex items-center gap-2">
                                          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                            Updates
                                          </p>
                                          {hasUnseenPreviewUpdates ? (
                                            <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                                          ) : null}
                                        </div>
                                        <ChevronDown
                                          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${arePreviewUpdatesOpen ? "rotate-180" : ""}`}
                                        />
                                      </button>
                                    </CollapsibleTrigger>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void clearPreviewUpdates(latestPreviewUpdateAt)
                                      }
                                      disabled={hasUnseenPreviewUpdates}
                                      className="shrink-0 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <CollapsibleContent className="mt-2 space-y-2">
                                    {selectedThreadUpdates.map((update) => (
                                      <div key={update.id} className="border-l-2 border-black/8 pl-3">
                                        <p className="text-[12px] font-medium text-foreground">{update.title}</p>
                                        <p className="text-[11px] text-muted-foreground">{update.body}</p>
                                        {update.href && update.ctaLabel ? (
                                          <a
                                            href={update.href}
                                            className="mt-1 inline-flex text-[11px] font-medium text-foreground underline-offset-4 hover:underline"
                                          >
                                            {update.ctaLabel}
                                          </a>
                                        ) : null}
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </section>
                              </Collapsible>
                            ) : null}

                            {selectedThread.actionItems.length > 0 ? (
                              <Collapsible
                                open={areActionItemsOpen}
                                onOpenChange={(open) =>
                                  handleActionItemsOpenChange(
                                    open,
                                    hasUnseenActionItems,
                                    latestActionItemAt
                                  )
                                }
                              >
                                <section className="border border-black/6 px-4 py-3">
                                  <CollapsibleTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between text-left"
                                      aria-label={areActionItemsOpen ? "Collapse action items" : "Expand action items"}
                                    >
                                      <div className="flex items-center gap-2">
                                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                          Action items ({selectedThread.actionItems.length})
                                        </p>
                                        {hasUnseenActionItems ? (
                                          <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                                        ) : null}
                                      </div>
                                      <ChevronDown
                                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${areActionItemsOpen ? "rotate-180" : ""}`}
                                      />
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-2 space-y-2">
                                    {selectedThread.actionItems.map((item) => (
                                      <ActionItemRow key={item.id} item={item} />
                                    ))}
                                  </CollapsibleContent>
                                </section>
                              </Collapsible>
                            ) : null}

                            {selectedThread.promiseDiscrepancies.length > 0 ? (
                              <section className="border border-black/6 px-4 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                  Discrepancies
                                </p>
                                <div className="mt-2 space-y-2">
                                  {selectedThread.promiseDiscrepancies.map((d, i) => (
                                    <div key={`${d.field}-${i}`} className="border-l-2 border-amber-300 pl-3">
                                      <p className="text-[12px] font-medium text-foreground">
                                        {d.field}: email says &ldquo;{d.emailClaim}&rdquo;
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        Contract says &ldquo;{d.contractValue}&rdquo;
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            ) : null}

                            {selectedThread.crossDealConflicts.length > 0 ? (
                              <section className="border border-[#fecaca]/60 bg-[#fef2f2] px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <ShieldAlert className="h-4 w-4 text-[#dc2626]" />
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#dc2626]">
                                    Cross-deal conflicts
                                  </p>
                                </div>
                                <div className="mt-3 space-y-3">
                                  {selectedThread.crossDealConflicts.map((conflict, i) => (
                                    <div key={`conflict-${i}`} className="border-l-2 border-[#ef4444] pl-3">
                                      <div className="flex items-center gap-2">
                                        <p className="text-[12px] font-semibold text-foreground">
                                          {conflict.title}
                                        </p>
                                        <span className={`px-2 py-0.5 text-[10px] font-medium ${
                                          conflict.severity === "high"
                                            ? "bg-[#fecaca] text-[#991b1b]"
                                            : conflict.severity === "medium"
                                            ? "bg-[#fef3c7] text-[#92400e]"
                                            : "bg-[#e0e7ff] text-[#3730a3]"
                                        }`}>
                                          {conflict.severity}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-[12px] text-muted-foreground">
                                        {conflict.detail}
                                      </p>
                                    </div>
                                  ))}
                                </div>
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
                              <section className="bg-white">
                                <div className="border-b border-black/8 px-6 py-3">
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
                                      <p className="text-[14px] font-semibold text-foreground">
                                        {latestMessage.direction === "outbound"
                                          ? "You"
                                          : participantLabel(latestMessage.from)}
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {latestMessage.direction === "outbound"
                                          ? `To: ${latestMessage.to.map(participantLabel).join(", ")}`
                                          : latestMessage.from?.email || ""}
                                      </p>
                                    </div>

                                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                                      {formatDate(latestMessage.receivedAt || latestMessage.sentAt)}
                                    </p>
                                  </div>
                                </div>

                                <div className="px-8 py-7">
                                  <div className="whitespace-pre-wrap text-[13px] leading-8 text-foreground">
                                    {latestMessage.textBody || "No text body available."}
                                  </div>

                                  <AttachmentShelf attachments={latestMessage.attachments} />
                                </div>
                              </section>
                            ) : null}
                          </div>
                        </div>

                        {/* Reply composer — pinned to bottom */}
                        <div className="border-t border-black/8 bg-white px-5 py-4">
                          <div className="space-y-3">
                            <div className="border border-black/8 bg-foreground/[0.02] px-4 py-3 text-sm text-muted-foreground">
                              <div>
                                <Textarea
                                  ref={replyBodyRef}
                                  rows={1}
                                  value={replyBody}
                                  onChange={(event) => {
                                    handleReplyBodyChange(
                                      event.currentTarget.value,
                                      event.currentTarget
                                    );
                                  }}
                                  placeholder={
                                    replyJourney === "ai_set"
                                      ? 'Refine your prompt, then click "Generate"...'
                                      : 'Type a reply or click "AI Reply" to generate one...'
                                  }
                                  className="h-6 min-h-0 overflow-hidden border-0 bg-transparent px-0 py-0 text-[12px] leading-6 text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 disabled:opacity-100"
                                />
                                {isDrafting ? (
                                  <span className="mt-2 flex items-center gap-2 text-[11px] text-primary">
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    Writing draft...
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div ref={aiReplyControlRef} className="flex items-stretch">
                                  <button
                                    type="button"
                                    onClick={() => void draftReply()}
                                    disabled={isDrafting}
                                    className={`inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition disabled:opacity-60 ${
                                      shouldHighlightAiReply
                                        ? "animate-pulse border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                                        : "border-black/10 text-foreground hover:bg-black/[0.03]"
                                    }`}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {isDrafting
                                      ? "Replying..."
                                      : replyJourney === "ai_generated"
                                        ? "Regenerate"
                                      : replyJourney === "ai_set"
                                        ? "Generate"
                                        : "AI Reply"}
                                  </button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        aria-label="Open AI reply options"
                                        className="inline-flex h-9 w-8 items-center justify-center border border-l-0 border-black/10 text-muted-foreground transition hover:bg-black/[0.03] hover:text-foreground"
                                      >
                                        <ChevronDown className="h-3 w-3" />
                                      </button>
                                    </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    side="top"
                                    sideOffset={4}
                                    style={
                                      aiReplyMenuWidth ? { width: `${aiReplyMenuWidth}px` } : undefined
                                    }
                                    className="rounded-none border-black/10 p-0"
                                  >
                                    <DropdownMenuItem
                                      onSelect={() => setPromptCommandOpen(true)}
                                      className="w-full rounded-none px-3 py-2.5 text-[12px] font-medium"
                                    >
                                      Add prompt
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={clearDraftComposer}
                                      disabled={!canClearReplyText}
                                      className="w-full rounded-none px-3 py-2.5 text-[12px] font-medium"
                                    >
                                      Clear text
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                {isDrafting ? (
                                  <button
                                    type="button"
                                    onClick={cancelDraftReply}
                                    className="inline-flex h-9 items-center border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                                {canRefineGeneratedReply ? (
                                  <>
                                    <Popover
                                      open={openRefinementPopover === "length"}
                                      onOpenChange={(open) =>
                                        setOpenRefinementPopover(open ? "length" : null)
                                      }
                                    >
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 border border-black/10 bg-secondary/20 px-3 text-[12px] font-medium text-foreground transition hover:border-black/25 hover:bg-secondary/28"
                                        >
                                          Length
                                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        align="start"
                                        side="top"
                                        className="w-40 rounded-none border-black/10 p-1"
                                      >
                                        <div className="space-y-1">
                                          {DRAFT_REFINEMENT_OPTIONS.length.map((option) => (
                                            <button
                                              key={option.label}
                                              type="button"
                                              onClick={() => void refineGeneratedDraft(option.instruction)}
                                              className="block w-full rounded-none px-3 py-2 text-left text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                    <Popover
                                      open={openRefinementPopover === "tone"}
                                      onOpenChange={(open) =>
                                        setOpenRefinementPopover(open ? "tone" : null)
                                      }
                                    >
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 border border-black/10 bg-secondary/20 px-3 text-[12px] font-medium text-foreground transition hover:border-black/25 hover:bg-secondary/28"
                                        >
                                          Tone
                                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        align="start"
                                        side="top"
                                        className="w-40 rounded-none border-black/10 p-1"
                                      >
                                        <div className="space-y-1">
                                          {DRAFT_REFINEMENT_OPTIONS.tone.map((option) => (
                                            <button
                                              key={option.label}
                                              type="button"
                                              onClick={() => void refineGeneratedDraft(option.instruction)}
                                              className="block w-full rounded-none px-3 py-2 text-left text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                    <Popover
                                      open={openRefinementPopover === "focus"}
                                      onOpenChange={(open) =>
                                        setOpenRefinementPopover(open ? "focus" : null)
                                      }
                                    >
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 border border-black/10 bg-secondary/20 px-3 text-[12px] font-medium text-foreground transition hover:border-black/25 hover:bg-secondary/28"
                                        >
                                          Focus
                                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        align="start"
                                        side="top"
                                        className="w-44 rounded-none border-black/10 p-1"
                                      >
                                        <div className="space-y-1">
                                          {DRAFT_REFINEMENT_OPTIONS.focus.map((option) => (
                                            <button
                                              key={option.label}
                                              type="button"
                                              onClick={() => void refineGeneratedDraft(option.instruction)}
                                              className="block w-full rounded-none px-3 py-2 text-left text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                disabled={!canSendReply}
                                className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Send
                              </button>
                            </div>
                          </div>
                        </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      <CommandDialog
        open={isPromptCommandOpen}
        onOpenChange={setPromptCommandOpen}
        title="Add draft prompt"
        description="Add guidance for the AI draft reply."
      >
        <CommandInput
          value={draftInstructions}
          onValueChange={setDraftInstructions}
          placeholder="Tone, boundaries, points to mention..."
          aria-label="Additional prompt for AI draft"
        />
        <CommandList className="max-h-[240px]">
          <CommandEmpty>
            <p className="text-[13px] text-muted-foreground">Type a custom prompt or pick a suggestion below.</p>
          </CommandEmpty>
          <CommandGroup heading="Suggestions">
            {isLoadingSuggestions && promptSuggestions.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-muted-foreground">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Generating suggestions...
              </div>
            ) : (
              promptSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.id}
                  value={suggestion.label}
                  onSelect={() => setDraftInstructions(suggestion.prompt)}
                >
                  {suggestion.label}
                </CommandItem>
              ))
            )}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-between border-t border-black/8 px-4 py-3 dark:border-white/10">
          <p className="text-[12px] text-muted-foreground">
            Applies to the next draft only.
          </p>
          <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearPromptDialog}
              className="inline-flex h-8 items-center px-3 text-[12px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              Clear
            </button>
            <div ref={promptActionControlRef} className="flex items-stretch">
              <button
                type="button"
                onClick={applyPromptToNextDraft}
                disabled={!trimmedDraftInstructions}
                className="inline-flex h-8 items-center bg-primary px-4 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add prompt
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open prompt actions"
                    disabled={!trimmedDraftInstructions || isDrafting}
                    className="inline-flex h-8 w-8 items-center justify-center border-l border-white/15 bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  sideOffset={4}
                  style={
                    promptActionMenuWidth
                      ? { width: `${promptActionMenuWidth}px` }
                      : undefined
                  }
                  className="rounded-none border-black/10 p-0"
                >
                  <DropdownMenuItem
                    onSelect={() => void usePromptForDraft()}
                    className="w-full rounded-none px-3 py-2.5 text-[12px] font-medium"
                  >
                    Use prompt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CommandDialog>

      <Dialog open={isSummaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Summary</DialogTitle>
            <DialogDescription>
              Thread summary for this partnership conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <p className="whitespace-pre-wrap text-[13px] leading-7 text-foreground">
              {summary ?? "No summary available yet."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {isCandidateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden border border-black/8 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-black/8 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Deal matches found
                </h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Select threads to link to your partnerships.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCandidateModal}
                className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {candidateGroups.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No matches yet. We&apos;ll keep scanning as more mail syncs.
                  </p>
                  <button
                    type="button"
                    onClick={closeCandidateModal}
                    className="mt-4 h-10 border border-black/10 px-5 text-sm font-medium text-foreground transition hover:border-black/20"
                  >
                    Keep checking
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {candidateGroups.map((group) => {
                    const labels = getDisplayDealLabels(group.deal);

                    return (
                      <section key={group.deal.id} className="border border-black/8">
                        <div className="flex items-baseline justify-between border-b border-black/8 px-4 py-3">
                          <p className="text-sm font-semibold text-foreground">
                            {labels.campaignName ?? group.deal.campaignName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {labels.brandName ?? group.deal.brandName}
                          </p>
                        </div>

                        <div className="divide-y divide-black/6">
                          {group.matches.map((match) => {
                            const isSelected = selectedCandidateIds.includes(match.candidate.id);

                            return (
                              <div key={match.candidate.id} className="flex items-start gap-3 px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCandidate(match.candidate.id)}
                                  className="mt-0.5 h-4 w-4 border border-border"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[13px] font-medium text-foreground">
                                      {match.thread.subject}
                                    </p>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                      {Math.round(match.candidate.confidence * 100)}%
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {providerLabel(match.account.provider)} · {match.account.emailAddress}
                                  </p>
                                  {match.thread.snippet ? (
                                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground/70">
                                      {match.thread.snippet}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void dismissCandidate(match.candidate.id)}
                                  disabled={isReviewingCandidates}
                                  className="shrink-0 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                                >
                                  Dismiss
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/8 px-6 py-3">
              <button
                type="button"
                onClick={() => void reviewCandidates("reject_all")}
                disabled={candidateGroups.length === 0 || isReviewingCandidates}
                className="h-9 px-4 text-[13px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-60"
              >
                Dismiss all
              </button>
              <button
                type="button"
                onClick={closeCandidateModal}
                className="h-9 border border-black/10 px-4 text-[13px] font-medium text-foreground transition hover:border-black/20"
              >
                Keep checking
              </button>
              <button
                type="button"
                onClick={() => void reviewCandidates("confirm")}
                disabled={selectedCandidateIds.length === 0 || isReviewingCandidates}
                className="h-9 bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isReviewingCandidates ? "Linking..." : `Link ${selectedCandidateIds.length > 0 ? selectedCandidateIds.length : ""} selected`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDiscovering ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm border border-black/8 bg-white px-6 py-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-foreground" />
                <p className="text-[14px] font-medium text-foreground">
                  Fetching recent emails...
                </p>
              </div>
              <button
                type="button"
                onClick={cancelDiscovery}
                className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition hover:text-foreground"
                aria-label="Cancel email discovery"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedThread && isLinkModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm border border-black/8 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#161a20]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Link partnership
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  Pick a workspace
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center border border-black/10 text-foreground transition hover:border-black/20"
                aria-label="Close link partnership modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Choose an active workspace to link or unlink this thread from the preview context.
            </p>

            <div className="mt-5 space-y-4">
              <InboxSelect
                value={selectedDealId}
                onChange={setSelectedDealId}
              >
                <option value="">Select a workspace</option>
                {linkableDeals.map((deal) => {
                  const labels = getDisplayDealLabels(deal);

                  return (
                    <option key={deal.id} value={deal.id}>
                      {labels.campaignName ?? deal.campaignName}
                    </option>
                  );
                })}
              </InboxSelect>

              {linkableDeals.length === 0 ? (
                <p className="text-[12px] leading-5 text-muted-foreground">
                  No active workspaces are available to link right now.
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="h-11 border border-black/10 px-4 text-sm font-semibold text-foreground transition hover:border-black/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void linkSelectedDeal()}
                  disabled={!selectedDealId || isLinking || linkableDeals.length === 0}
                  className="h-11 border border-black/10 px-4 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLinking
                    ? "Updating..."
                    : linkedDealIds.has(selectedDealId)
                      ? "Unlink workspace"
                      : "Link workspace"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
