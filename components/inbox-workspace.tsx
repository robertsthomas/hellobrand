"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowLeft,
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
  SlidersHorizontal,
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
import { InboxActionItemRow } from "@/components/inbox-action-item-row";
import { InboxFilterDialog } from "@/components/inbox-filter-dialog";
import { InboxPrivateNotesDialog } from "@/components/inbox-private-notes-dialog";
import { InboxSelect } from "@/components/inbox-select";
import { InboxSortDialog } from "@/components/inbox-sort-dialog";
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
import { normalizeInboxSort, sortInboxThreadItems, type InboxSortOption } from "@/lib/email/inbox-sort";
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
  EmailThreadWorkflowState,
  NegotiationStance,
  ProfileRecord
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

function workflowStateLabel(state: EmailThreadWorkflowState) {
  switch (state) {
    case "unlinked":
      return "Needs linking";
    case "needs_review":
      return "Needs review";
    case "needs_reply":
      return "Needs reply";
    case "draft_ready":
      return "Draft ready";
    case "waiting_on_them":
      return "Waiting";
    case "closed":
      return "Closed";
    default:
      return state;
  }
}

function workflowBadgeClass(state: EmailThreadWorkflowState) {
  switch (state) {
    case "unlinked":
      return "bg-[#f5f3ff] text-[#5b21b6]";
    case "needs_review":
      return "bg-[#fff7ed] text-[#9a3412]";
    case "needs_reply":
      return "bg-[#eff6ff] text-[#1d4ed8]";
    case "draft_ready":
      return "bg-[#ecfdf3] text-[#047857]";
    case "waiting_on_them":
      return "bg-secondary/50 text-muted-foreground";
    case "closed":
      return "bg-secondary/40 text-muted-foreground";
    default:
      return "bg-secondary/40 text-muted-foreground";
  }
}

function inboxSortLabel(sort: InboxSortOption) {
  switch (sort) {
    case "oldest":
      return "Oldest first";
    case "subject":
      return "Subject A-Z";
    case "newest":
    default:
      return "Newest first";
  }
}

function buildActionItemReplyPrompt(item: EmailActionItemRecord) {
  const contextLines = [
    `Draft an email reply that addresses this action item: ${item.action}.`,
    item.dueDate ? `Target due date: ${formatDate(item.dueDate)}.` : null,
    item.sourceText ? `Relevant email context: "${item.sourceText}".` : null,
    `Use the linked workspace context for tone and facts, answer the request directly, and do not invent missing details.`
  ].filter(Boolean);

  return contextLines.join(" ");
}

function isLegacyThreadSummary(value: string | null | undefined) {
  const summary = value?.trim();
  if (!summary) {
    return false;
  }

  if (summary.length > 700) {
    return true;
  }

  return [
    "what they are asking you to do",
    "what the other side is committing",
    "unresolved or not specified in the thread",
    "suggested next steps for you"
  ].some((marker) => summary.toLowerCase().includes(marker));
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

function threadPreviewText(item: EmailThreadListItem) {
  return item.thread.snippet || "No preview available.";
}

function cleanWorkspaceText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function removeReplyPrefixes(subject: string) {
  return cleanWorkspaceText(subject.replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/gi, ""));
}

function stripWorkspaceSuffixes(subject: string) {
  return cleanWorkspaceText(
    removeReplyPrefixes(subject).replace(/\b(partnership|collaboration|campaign)\b/gi, "")
  );
}

function inferBrandNameFromParticipant(participant: EmailParticipant | null | undefined) {
  if (!participant) {
    return null;
  }

  const participantName = cleanWorkspaceText((participant.name ?? "").replace(/[<>]/g, ""));
  if (participantName && !participantName.includes("@")) {
    return participantName;
  }

  const domain = participant.email.split("@")[1] ?? "";
  const root = domain.split(".")[0] ?? "";
  if (!root) {
    return null;
  }

  return root
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function inferWorkspaceDraftFromThread(item: EmailThreadListItem) {
  const externalParticipant =
    item.thread.participants.find(
      (participant) =>
        participant.email.toLowerCase() !== item.account.emailAddress.toLowerCase()
    ) ?? item.thread.participants[0] ?? null;
  const brandName = (inferBrandNameFromParticipant(externalParticipant) ?? "Inbox lead").slice(
    0,
    120
  );
  const cleanedSubject = stripWorkspaceSuffixes(item.thread.subject);
  const campaignName =
    (cleanedSubject.length >= 2 ? cleanedSubject : `${brandName} partnership`).slice(0, 120);

  return {
    brandName,
    campaignName,
    notes: `Created from inbox thread: ${item.thread.subject}`.slice(0, 5000)
  };
}

function latestUpdatedAt(items: Array<{ updatedAt: string }>) {
  return items.reduce<string | null>((latest, item) => {
    if (!latest || item.updatedAt > latest) {
      return item.updatedAt;
    }

    return latest;
  }, null);
}

function missingReplySignatureFields(profile: ProfileRecord | null) {
  if (!profile) {
    return ["creator name", "business name or handle", "default sign-off"];
  }

  return [
    !profile.creatorLegalName?.trim() && "creator name",
    !profile.businessName?.trim() && "business name or handle",
    !profile.preferredSignature?.trim() && "default sign-off"
  ].filter(Boolean) as string[];
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

function normalizePreviewUpdateBody(body: string) {
  return cleanWorkspaceText(body).toLowerCase();
}

function combineEventUpdateTitles(titles: string[]) {
  const uniqueTitles = Array.from(new Set(titles));
  if (uniqueTitles.length <= 1) {
    return uniqueTitles[0] ?? "Email update";
  }

  const labels = uniqueTitles.map((title) => {
    switch (title) {
      case "Action requested from the creator":
        return "asks";
      case "Usage rights or exclusivity update":
        return "usage rights";
      case "Deliverable-related update":
        return "deliverables";
      case "Timeline or scheduling update":
        return "timeline";
      case "Payment-related update":
        return "payment";
      case "Approval status update":
        return "approval";
      case "New attachment added to linked thread":
        return "attachments";
      default:
        return title.toLowerCase();
    }
  });

  if (labels.length === 2) {
    return `Email mentions ${labels[0]} and ${labels[1]}`;
  }

  return `Email mentions ${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

type DraftPromptSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

type DraftPromptSuggestionCacheEntry = {
  version: string;
  suggestions: DraftPromptSuggestion[];
};

type ThreadCopilotInsightCacheEntry = {
  risks: RiskSuggestion[];
  documents: DocumentSuggestion[];
};

type RiskSuggestion = {
  id: string;
  label: string;
  detail: string;
};

type DocumentSuggestion = {
  id: string;
  fileName: string;
  documentKind: string;
};

type ThreadInvoiceAttachment = {
  dealId: string;
  documentId: string;
  fileName: string;
  invoiceNumber: string;
  status: string;
};

const DRAFT_REFINEMENT_OPTIONS = {
  length: [
    {
      label: "Shorter",
      instruction: "Revise the current draft to be materially shorter and tighter while preserving the same intent and asks. Cut roughly 25 to 40 percent of the length, remove repetition, and keep only the strongest points."
    },
    {
      label: "Longer",
      instruction: "Revise the current draft to be materially longer and more detailed while preserving the same intent and asks. Expand it by roughly 30 to 60 percent, add 2 to 4 meaningful sentences, and make the added detail specific and useful rather than filler."
    }
  ],
  tone: [
    {
      label: "Formal",
      instruction: "Revise the current draft to sound noticeably more formal and polished while keeping the same message. Use more precise business language, tighten casual phrasing, and make the tonal shift obvious."
    },
    {
      label: "Relaxed",
      instruction: "Revise the current draft to sound noticeably more relaxed and conversational while keeping it professional. Soften stiff phrasing and make the tone shift obvious."
    },
    {
      label: "Warm",
      instruction: "Revise the current draft to feel noticeably warmer and more personable while keeping the same core message. Add more human warmth and appreciation so the change is easy to feel."
    }
  ],
  focus: [
    {
      label: "Clarify asks",
      instruction: "Revise the current draft to focus much more clearly on the questions or clarifications you need from the brand. Make the asks explicit, easy to scan, and hard to miss."
    },
    {
      label: "Protect terms",
      instruction: "Revise the current draft to focus much more on protecting boundaries, scope, timing, and commercial terms. Make the protection of the creator's position noticeably stronger."
    },
    {
      label: "Close next steps",
      instruction: "Revise the current draft to end with much clearer next steps and a stronger call to action. The close should feel noticeably more decisive and action-oriented."
    }
  ]
} as const;

const DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY =
  "hellobrand:inbox:draft-prompt-suggestions";
const THREAD_ACTION_BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60";
const INBOX_SIGNATURE_BANNER_DISMISS_KEY =
  "hellobrand:inbox:signature-banner:dismissed";

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

function sanitizeEmailHtml(html: string) {
  if (typeof window === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const blockedSelectors = [
    "script",
    "style",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "link",
    "meta",
    "base"
  ];

  for (const selector of blockedSelectors) {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  }

  document.querySelectorAll("img").forEach((node) => node.remove());

  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "href") {
        if (!/^(https?:|mailto:|tel:|#)/i.test(value)) {
          element.removeAttribute(attribute.name);
        } else if (element.tagName.toLowerCase() === "a") {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noreferrer noopener");
        }
        continue;
      }

      if (name === "src") {
        if (!/^https?:/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
    }
  });

  return document.body.innerHTML.trim();
}

function EmailMessageBody({ message }: { message: EmailMessageRecord }) {
  const sanitizedHtml = useMemo(
    () => (message.htmlBody?.trim() ? sanitizeEmailHtml(message.htmlBody) : null),
    [message.htmlBody]
  );
  const textBody = message.textBody?.trim();

  if (sanitizedHtml) {
    return (
      <div
        className="max-w-none text-[13px] leading-6 text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-black/12 [&_blockquote]:pl-4 [&_br]:leading-6 [&_div]:max-w-full [&_hr]:my-5 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_table]:my-4 [&_table]:w-full [&_td]:align-top [&_th]:align-top [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  return (
    <div className="whitespace-pre-wrap text-[13px] leading-7 text-foreground">
      {textBody || "No text body available."}
    </div>
  );
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

function AttachmentShelf({
  attachments,
  onImportAttachment,
  importingAttachmentId
}: {
  attachments: EmailAttachmentRecord[];
  onImportAttachment?: (attachmentId: string) => void;
  importingAttachmentId?: string | null;
}) {
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
            <div
              key={attachment.id}
              className="border border-black/8 bg-white p-3 shadow-[0_1px_0_rgba(17,24,39,0.04)] dark:border-white/10 dark:bg-[#161a20]"
            >
              <button
                type="button"
                onClick={() => setPreviewAttachment(attachment)}
                className="w-full text-left transition hover:bg-secondary/20"
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
              {onImportAttachment ? (
                <div className="mt-3 border-t border-black/6 pt-3">
                  <button
                    type="button"
                    onClick={() => onImportAttachment(attachment.id)}
                    disabled={importingAttachmentId === attachment.id}
                    className="inline-flex h-8 items-center border border-black/10 px-3 text-[11px] font-medium text-foreground transition hover:bg-black/[0.03] disabled:opacity-40"
                  >
                    {importingAttachmentId === attachment.id
                      ? "Importing..."
                      : "Import to workspace"}
                  </button>
                </div>
              ) : null}
            </div>
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
  isOutbound,
  onImportAttachment,
  importingAttachmentId
}: {
  message: EmailMessageRecord;
  isOutbound: boolean;
  onImportAttachment?: (attachmentId: string) => void;
  importingAttachmentId?: string | null;
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
      {message.attachments.length > 0 ? (
        <AttachmentShelf
          attachments={message.attachments}
          onImportAttachment={onImportAttachment}
          importingAttachmentId={importingAttachmentId}
        />
      ) : null}
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
  profile,
  invoiceAttachmentsByDealId,
  autoAttachInvoice,
  selectedFilters
}: {
  threads: EmailThreadListItem[];
  selectedThread: EmailThreadDetail | null;
  threadPreviewStates: Record<string, EmailThreadPreviewStateRecord>;
  deals: DealRecord[];
  hasConnectedAccounts: boolean;
  connectedProviders: string[];
  profile: ProfileRecord | null;
  invoiceAttachmentsByDealId: Record<string, ThreadInvoiceAttachment>;
  autoAttachInvoice: boolean;
  selectedFilters: {
    q: string;
    provider: string;
    accountId: string;
    dealId: string;
    workflowState: string;
    sort: InboxSortOption;
  };
}) {
  const router = useRouter();
  const posthog = usePostHog();
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const aiReplyControlRef = useRef<HTMLDivElement | null>(null);
  const promptActionControlRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState(selectedFilters.q);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isSortDialogOpen, setIsSortDialogOpen] = useState(false);
  const [draftProviderFilter, setDraftProviderFilter] = useState(selectedFilters.provider);
  const [draftDealFilter, setDraftDealFilter] = useState(selectedFilters.dealId);
  const [draftWorkflowFilter, setDraftWorkflowFilter] = useState(selectedFilters.workflowState);
  const [draftSort, setDraftSort] = useState<InboxSortOption>(selectedFilters.sort);
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [manualAddDealId, setManualAddDealId] = useState(selectedFilters.dealId);
  const [manualAddQuery, setManualAddQuery] = useState("");
  const [manualAddThreads, setManualAddThreads] = useState<EmailThreadListItem[]>([]);
  const [manualAddSelectedThreadIds, setManualAddSelectedThreadIds] = useState<string[]>([]);
  const [isManualAddLoading, setIsManualAddLoading] = useState(false);
  const [isManualAddSubmitting, setIsManualAddSubmitting] = useState(false);
  const [isManualAddCreatingWorkspace, setIsManualAddCreatingWorkspace] = useState(false);
  const [isReplySignatureBannerVisible, setIsReplySignatureBannerVisible] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(!!initialSelectedThread);
  const [noteBody, setNoteBody] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [importingAttachmentId, setImportingAttachmentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiSuggestionCache, setAiSuggestionCache] = useState<
    Record<string, DraftPromptSuggestionCacheEntry>
  >(loadDraftPromptSuggestionCache);
  const [threadCopilotInsightCache, setThreadCopilotInsightCache] = useState<
    Record<string, ThreadCopilotInsightCacheEntry>
  >({});
  const [loadingSuggestionThreadIds, setLoadingSuggestionThreadIds] = useState<
    Record<string, true>
  >({});
  const [aiReplyMenuWidth, setAiReplyMenuWidth] = useState<number | null>(null);
  const [promptActionMenuWidth, setPromptActionMenuWidth] = useState<number | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isInvoiceAttached, setIsInvoiceAttached] = useState(false);
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
    choosePrimaryCandidate,
    primaryCandidateId,
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
  const linkableDeals = useMemo(
    () => deals.filter((deal) => deal.status !== "completed" && deal.status !== "paid"),
    [deals]
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
    isUpdatingWorkflow,
    linkSelectedDeal,
    selectedDealId,
    selectedLinkRole,
    setLinkModalOpen,
    setSelectedDealId,
    setSelectedLinkRole,
    setSummaryDialogOpen,
    summarizeThread,
    summary,
    threadPreviewStates,
    updateWorkflowState
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
    isSavingDraft,
    replyBodyRef,
    setReplyStance,
    setPromptCommandOpen,
    setDraftInstructions,
    setOpenRefinementPopover,
    handleReplyBodyChange,
    applyPromptToNextDraft,
    clearPromptDialog,
    saveDraft,
    draftReply,
    usePromptForDraft: runPromptForDraft,
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
    setIsNotesDialogOpen(false);
    setNoteBody("");
  }, [selectedThread]);

  useEffect(() => {
    if (!isFilterDialogOpen) {
      return;
    }

    setDraftProviderFilter(selectedFilters.provider);
    setDraftDealFilter(selectedFilters.dealId);
    setDraftWorkflowFilter(selectedFilters.workflowState);
  }, [
    isFilterDialogOpen,
    selectedFilters.dealId,
    selectedFilters.provider,
    selectedFilters.workflowState
  ]);

  useEffect(() => {
    if (!isSortDialogOpen) {
      return;
    }

    setDraftSort(selectedFilters.sort);
  }, [isSortDialogOpen, selectedFilters.sort]);

  useEffect(() => {
    if (!isManualAddModalOpen) {
      return;
    }

    if (selectedFilters.dealId) {
      setManualAddDealId(selectedFilters.dealId);
      return;
    }

    setManualAddDealId((current) => current || linkableDeals[0]?.id || "");
  }, [isManualAddModalOpen, linkableDeals, selectedFilters.dealId]);

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
    const nextThreads = normalizedQuery
      ? threads.filter((item) => threadSearchText(item).includes(normalizedQuery))
      : threads;

    return sortInboxThreadItems(nextThreads, normalizeInboxSort(selectedFilters.sort));
  }, [normalizedQuery, selectedFilters.sort, threads]);
  const activeFilterCount = [
    selectedFilters.provider,
    selectedFilters.dealId,
    selectedFilters.workflowState
  ].filter(Boolean).length;
  const selectedThreadDeals = useMemo(() => {
    const byId = new Map(deals.map((deal) => [deal.id, deal]));
    return selectedThread
      ? [
          selectedThread.primaryLink,
          ...selectedThread.referenceLinks
        ]
          .filter((link): link is NonNullable<typeof selectedThread.primaryLink> => Boolean(link))
          .map((link) => byId.get(link.dealId))
          .filter((entry): entry is DealRecord => Boolean(entry))
      : [];
  }, [deals, selectedThread]);
  const selectedThreadInvoiceAttachment = useMemo(() => {
    if (!selectedThread) {
      return null;
    }

    if (selectedDealId && invoiceAttachmentsByDealId[selectedDealId]) {
      return invoiceAttachmentsByDealId[selectedDealId] ?? null;
    }

    for (const link of [selectedThread.primaryLink, ...selectedThread.referenceLinks]) {
      if (!link) {
        continue;
      }

      const attachment = invoiceAttachmentsByDealId[link.dealId];
      if (attachment) {
        return attachment;
      }
    }

    return null;
  }, [invoiceAttachmentsByDealId, selectedDealId, selectedThread]);
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

    const eventGroups = new Map<
      string,
      {
        id: string;
        titles: string[];
        body: string;
        updatedAt: string;
      }
    >();

    for (const event of selectedThread.importantEvents) {
      const body = cleanWorkspaceText(event.body);
      const dedupeKey = `${event.messageId}:${normalizePreviewUpdateBody(body)}`;
      const existing = eventGroups.get(dedupeKey);

      if (existing) {
        existing.titles.push(event.title);
        if (event.updatedAt > existing.updatedAt) {
          existing.updatedAt = event.updatedAt;
        }
        continue;
      }

      eventGroups.set(dedupeKey, {
        id: `event:${event.id}`,
        titles: [event.title],
        body,
        updatedAt: event.updatedAt
      });
    }

    const eventUpdates = Array.from(eventGroups.values()).map((event) => ({
      id: event.id,
      title: combineEventUpdateTitles(event.titles),
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
  const replySignatureMissingFields = useMemo(
    () => missingReplySignatureFields(profile),
    [profile]
  );
  const replySignatureBannerStateKey = useMemo(
    () => replySignatureMissingFields.join("|"),
    [replySignatureMissingFields]
  );
  const canAttachInvoice =
    Boolean(selectedThreadInvoiceAttachment) && selectedThreadInvoiceAttachment?.status !== "voided";
  const hasThreadSummary = Boolean(summary?.trim()) && !isLegacyThreadSummary(summary);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!replySignatureBannerStateKey) {
      setIsReplySignatureBannerVisible(false);
      window.localStorage.removeItem(INBOX_SIGNATURE_BANNER_DISMISS_KEY);
      return;
    }

    const dismissedState = window.localStorage.getItem(INBOX_SIGNATURE_BANNER_DISMISS_KEY);
    setIsReplySignatureBannerVisible(dismissedState !== replySignatureBannerStateKey);
  }, [replySignatureBannerStateKey]);

  useEffect(() => {
    setIsInvoiceAttached(Boolean(autoAttachInvoice && canAttachInvoice));
  }, [autoAttachInvoice, canAttachInvoice, selectedThread?.thread.id]);

  const sendReply = useCallback(async () => {
    if (!selectedThread || !canSendReply) {
      return;
    }

    setIsSendingReply(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/email/threads/${selectedThread.thread.id}/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          dealId: isInvoiceAttached
            ? ((selectedThreadInvoiceAttachment?.dealId ?? selectedDealId) || null)
            : (selectedDealId || null),
          subject: replySubject,
          body: replyBody,
          attachmentDocumentIds:
            isInvoiceAttached && selectedThreadInvoiceAttachment
              ? [selectedThreadInvoiceAttachment.documentId]
              : []
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send reply.");
      }

      clearDraftComposer();
      setIsInvoiceAttached(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send reply.");
    } finally {
      setIsSendingReply(false);
    }
  }, [
    canSendReply,
    clearDraftComposer,
    isInvoiceAttached,
    replyBody,
    replySubject,
    router,
    selectedDealId,
    selectedThread,
    selectedThreadInvoiceAttachment
  ]);

  const markDraftReady = useCallback(async () => {
    await saveDraft("ready");
    router.refresh();
  }, [router, saveDraft]);

  const generateReplyFromActionItem = useCallback(
    async (item: EmailActionItemRecord) => {
      await runPromptForDraft(buildActionItemReplyPrompt(item));
      replyBodyRef.current?.focus();
    },
    [replyBodyRef, runPromptForDraft]
  );

  const savePrivateNote = useCallback(async () => {
    if (!selectedThread || !noteBody.trim()) {
      return;
    }

    setIsSavingNote(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/email/threads/${selectedThread.thread.id}/notes`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          body: noteBody.trim()
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save note.");
      }
      setNoteBody("");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save note.");
    } finally {
      setIsSavingNote(false);
    }
  }, [noteBody, router, selectedThread]);

  const importAttachmentToWorkspace = useCallback(
    async (attachmentId: string) => {
      if (!selectedThread || !selectedThread.primaryLink?.dealId) {
        return;
      }

      setImportingAttachmentId(attachmentId);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/email/attachments/${attachmentId}/import`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            dealId: selectedThread.primaryLink.dealId
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not import attachment.");
        }
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not import attachment."
        );
      } finally {
        setImportingAttachmentId(null);
      }
    },
    [router, selectedThread]
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
        setThreadCopilotInsightCache((current) => ({
          ...current,
          [thread.id]: {
            risks: Array.isArray(payload.riskSuggestions)
              ? (payload.riskSuggestions as RiskSuggestion[])
              : [],
            documents: Array.isArray(payload.documentSuggestions)
              ? (payload.documentSuggestions as DocumentSuggestion[])
              : []
          }
        }));
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

  const currentCopilotInsights = useMemo(() => {
    if (!selectedThread) {
      return {
        risks: [] as RiskSuggestion[],
        documents: [] as DocumentSuggestion[]
      };
    }

    return (
      threadCopilotInsightCache[selectedThread.thread.id] ?? {
        risks: [],
        documents: []
      }
    );
  }, [selectedThread, threadCopilotInsightCache]);

  const selectedManualThreadIdSet = useMemo(
    () => new Set(manualAddSelectedThreadIds),
    [manualAddSelectedThreadIds]
  );
  const selectedManualThreads = useMemo(
    () =>
      manualAddSelectedThreadIds
        .map((threadId) => manualAddThreads.find((entry) => entry.thread.id === threadId) ?? null)
        .filter((entry): entry is EmailThreadListItem => entry !== null),
    [manualAddSelectedThreadIds, manualAddThreads]
  );

  const fetchManualAddThreads = useCallback(
    async (nextQuery: string) => {
      if (!isManualAddModalOpen) {
        return;
      }

      setIsManualAddLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        const trimmed = nextQuery.trim();
        if (trimmed) {
          params.set("q", trimmed);
          params.set("limit", "1000");
        } else {
          params.set("limit", "20");
        }

        const response = await fetch(`/api/email/threads?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load inbox threads.");
        }

        const nextThreads = (payload.threads ?? []) as EmailThreadListItem[];
        setManualAddThreads(nextThreads);
        setManualAddSelectedThreadIds((current) =>
          current.filter((threadId) => nextThreads.some((thread) => thread.thread.id === threadId))
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load inbox threads."
        );
      } finally {
        setIsManualAddLoading(false);
      }
    },
    [isManualAddModalOpen]
  );

  useEffect(() => {
    if (!isManualAddModalOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchManualAddThreads(manualAddQuery);
    }, manualAddQuery.trim() ? 250 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchManualAddThreads, isManualAddModalOpen, manualAddQuery]);

  const toggleManualAddThread = useCallback((threadId: string) => {
    setManualAddSelectedThreadIds((current) =>
      current.includes(threadId)
        ? current.filter((id) => id !== threadId)
        : [...current, threadId]
    );
  }, []);

  useEffect(() => {
    if (!manualAddDealId) {
      return;
    }

    setManualAddSelectedThreadIds((current) =>
      current.filter((threadId) => {
        const thread = manualAddThreads.find((entry) => entry.thread.id === threadId);
        return !thread?.links.some((link) => link.dealId === manualAddDealId);
      })
    );
  }, [manualAddDealId, manualAddThreads]);

  const submitManualAddThreads = useCallback(async () => {
    if (!manualAddDealId || manualAddSelectedThreadIds.length === 0) {
      return;
    }

    setIsManualAddSubmitting(true);
    setErrorMessage(null);

    try {
      const threadIdsToLink = manualAddSelectedThreadIds.filter((threadId) => {
        const thread = manualAddThreads.find((entry) => entry.thread.id === threadId);
        return !thread?.links.some((link) => link.dealId === manualAddDealId);
      });

      if (threadIdsToLink.length === 0) {
        setIsManualAddModalOpen(false);
        setManualAddQuery("");
        setManualAddSelectedThreadIds([]);
        return;
      }

      const responses = await Promise.all(
        threadIdsToLink.map(async (threadId) => {
          const thread = manualAddThreads.find((entry) => entry.thread.id === threadId);
          const response = await fetch(`/api/email/threads/${threadId}/link`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              dealId: manualAddDealId,
              role: thread?.primaryLink ? "reference" : "primary"
            })
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Could not link email thread.");
          }

          return payload;
        })
      );

      if (responses.length > 0) {
        setIsManualAddModalOpen(false);
        setManualAddQuery("");
        setManualAddSelectedThreadIds([]);
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not link email threads."
      );
    } finally {
      setIsManualAddSubmitting(false);
    }
  }, [manualAddDealId, manualAddSelectedThreadIds, manualAddThreads, router]);

  const createWorkspaceFromSelectedThreads = useCallback(async () => {
    const seedThread = selectedManualThreads[0];
    if (!seedThread) {
      return;
    }

    setIsManualAddCreatingWorkspace(true);
    setErrorMessage(null);

    try {
      const createResponse = await fetch("/api/p", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(inferWorkspaceDraftFromThread(seedThread))
      });
      const createPayload = await createResponse.json().catch(() => ({}));

      if (!createResponse.ok || !createPayload.deal?.id) {
        throw new Error(createPayload.error ?? "Could not create workspace.");
      }

      const nextDealId = createPayload.deal.id as string;
      const threadIdsToLink = manualAddSelectedThreadIds.filter((threadId) => {
        const thread = manualAddThreads.find((entry) => entry.thread.id === threadId);
        return !thread?.links.some((link) => link.dealId === nextDealId);
      });

      const responses = await Promise.all(
        threadIdsToLink.map(async (threadId) => {
          const thread = manualAddThreads.find((entry) => entry.thread.id === threadId);
          const response = await fetch(`/api/email/threads/${threadId}/link`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              dealId: nextDealId,
              role: thread?.primaryLink ? "reference" : "primary"
            })
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Could not link email thread.");
          }

          return payload;
        })
      );

      if (responses.length > 0 || threadIdsToLink.length === 0) {
        setManualAddDealId(nextDealId);
        setIsManualAddModalOpen(false);
        setManualAddQuery("");
        setManualAddSelectedThreadIds([]);
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create workspace."
      );
    } finally {
      setIsManualAddCreatingWorkspace(false);
    }
  }, [manualAddSelectedThreadIds, manualAddThreads, router, selectedManualThreads]);

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

  function applyDialogFilters() {
    setIsFilterDialogOpen(false);
    applyFilters({
      provider: draftProviderFilter,
      dealId: draftDealFilter,
      workflowState: draftWorkflowFilter,
      thread: ""
    });
  }

  function clearDialogFilters() {
    setDraftProviderFilter("");
    setDraftDealFilter("");
    setDraftWorkflowFilter("");
  }

  function applyDialogSort() {
    setIsSortDialogOpen(false);
    applyFilters({
      sort: draftSort,
      thread: ""
    });
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
            <div className="flex flex-wrap items-end justify-end gap-3">
              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div className="w-full max-w-sm sm:w-[20rem]">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search linked emails"
                    aria-label="Search linked emails"
                    className="h-9 rounded-none border-black/10 bg-white text-[12px] shadow-none dark:border-white/10 dark:bg-[#161a1f]"
                  />
                </div>
                {hasConnectedAccounts && hasLinkedThreads ? (
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <AppTooltip
                      content="Find emails"
                      sideOffset={8}
                    >
                      <button
                        type="button"
                        onClick={() => void discoverCandidates()}
                        disabled={isDiscovering}
                        aria-label={isDiscovering ? "Finding emails" : "Find emails"}
                        className="inline-flex h-9 items-center justify-center px-1 text-foreground transition hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-white/70"
                      >
                        <MailSearch
                          strokeWidth={1.5}
                          className={`h-5 w-5 shrink-0 ${isDiscovering ? "animate-pulse" : ""}`}
                        />
                      </button>
                    </AppTooltip>
                    <button
                      type="button"
                      onClick={() => setIsManualAddModalOpen(true)}
                      className={`${THREAD_ACTION_BUTTON_CLASS} min-w-[8.75rem] shrink-0`}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      Add threads
                    </button>
                  </div>
                ) : null}
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
                    <>
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
                      <button
                        type="button"
                        onClick={() => setIsManualAddModalOpen(true)}
                        className={`${THREAD_ACTION_BUTTON_CLASS} min-w-[10rem]`}
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        Add threads manually
                      </button>
                    </>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-1 flex-wrap gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setIsFilterDialogOpen(true)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:flex-none"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Filters</span>
                        {activeFilterCount > 0 ? (
                          <span className="border border-black/10 px-2 py-0.5 text-[11px] text-muted-foreground">
                            {activeFilterCount}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSortDialogOpen(true)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:flex-none"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        <span>{inboxSortLabel(selectedFilters.sort)}</span>
                      </button>
                    </div>
                    <span className="shrink-0 bg-secondary/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {filteredThreads.length}
                    </span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-transparent">
                  {filteredThreads.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-muted-foreground">
                      No inbox threads match your search.
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
                              <span className={`px-2.5 py-1 text-[10px] font-medium ${workflowBadgeClass(item.thread.workflowState)}`}>
                                {workflowStateLabel(item.thread.workflowState)}
                              </span>
                              {item.savedDraft ? (
                                <span className="bg-[#ecfdf3] px-2.5 py-1 text-[10px] font-medium text-[#047857]">
                                  {item.savedDraft.status === "ready" ? "Draft ready" : "Draft saved"}
                                </span>
                              ) : null}
                              {item.noteCount > 0 ? (
                                <span className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                                  {item.noteCount} note{item.noteCount === 1 ? "" : "s"}
                                </span>
                              ) : null}
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
                            <span className={`px-3 py-1 text-[10px] font-medium ${workflowBadgeClass(selectedThread.thread.workflowState)}`}>
                              {workflowStateLabel(selectedThread.thread.workflowState)}
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
                                    if (hasThreadSummary) {
                                      setSummaryDialogOpen(true);
                                      return;
                                    }

                                    void summarizeThread();
                                  }}
                                  disabled={isSummarizing && !hasThreadSummary}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                {isSummarizing && !hasThreadSummary
                                  ? "Summarizing..."
                                  : hasThreadSummary
                                    ? "View summary"
                                    : "Generate summary"}
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
                                  setIsNotesDialogOpen(true);
                                }}
                                className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80"
                              >
                                Private notes
                                {selectedThread.noteCount > 0 ? ` (${selectedThread.noteCount})` : ""}
                              </button>
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
                              <div className="border-t border-black/6 pt-1 mt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsActionMenuOpen(false);
                                    void updateWorkflowState("needs_review");
                                  }}
                                  disabled={isUpdatingWorkflow}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:opacity-60"
                                >
                                  Mark needs review
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsActionMenuOpen(false);
                                    void updateWorkflowState("waiting_on_them");
                                  }}
                                  disabled={isUpdatingWorkflow}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:opacity-60"
                                >
                                  Mark waiting
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsActionMenuOpen(false);
                                    void updateWorkflowState("closed");
                                  }}
                                  disabled={isUpdatingWorkflow}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:opacity-60"
                                >
                                  Mark closed
                                </button>
                              </div>
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

                            <section className="border border-black/6 px-4 py-3">
                              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                Workspace context
                              </p>
                              <div className="mt-3 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[12px] font-semibold text-foreground">
                                      Primary workspace
                                    </p>
                                    <p className="mt-1 text-[12px] text-muted-foreground">
                                      {selectedThread.primaryLink
                                        ? `${selectedThread.primaryLink.campaignName} · ${selectedThread.primaryLink.brandName}`
                                        : "No primary workspace linked yet."}
                                    </p>
                                  </div>
                                  {selectedThread.primaryLink ? (
                                    <span className="bg-[#eff6ff] px-2.5 py-1 text-[10px] font-medium text-[#1d4ed8]">
                                      Primary
                                    </span>
                                  ) : null}
                                </div>
                                {selectedThread.referenceLinks.length > 0 ? (
                                  <div>
                                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                      References
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {selectedThread.referenceLinks.map((link) => (
                                        <span
                                          key={link.id}
                                          className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                                        >
                                          {link.campaignName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                {selectedThread.savedDraft ? (
                                  <div className="border-t border-black/6 pt-3 text-[12px] text-muted-foreground">
                                    Saved draft status:{" "}
                                    <span className="font-medium text-foreground">
                                      {selectedThread.savedDraft.status === "ready" ? "Ready" : "In progress"}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </section>

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
                                      <InboxActionItemRow
                                        key={item.id}
                                        item={item}
                                        onGenerateReply={(actionItem) => {
                                          void generateReplyFromActionItem(actionItem);
                                        }}
                                        isGeneratingReply={isDrafting}
                                      />
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

                            {(currentCopilotInsights.risks.length > 0 ||
                              currentCopilotInsights.documents.length > 0) ? (
                              <section className="border border-black/6 px-4 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                  Copilot context
                                </p>
                                {currentCopilotInsights.risks.length > 0 ? (
                                  <div className="mt-3 space-y-2">
                                    {currentCopilotInsights.risks.map((risk) => (
                                      <div key={risk.id} className="border-l-2 border-black/8 pl-3">
                                        <p className="text-[12px] font-medium text-foreground">{risk.label}</p>
                                        <p className="text-[11px] text-muted-foreground">{risk.detail}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {currentCopilotInsights.documents.length > 0 ? (
                                  <div className="mt-3 border-t border-black/6 pt-3">
                                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                      Suggested documents
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {currentCopilotInsights.documents.map((document) => (
                                        <span
                                          key={document.id}
                                          className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                                        >
                                          {document.fileName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </section>
                            ) : null}

                            {earlierMessages.length > 0 ? (
                              <section className="space-y-3">
                                {earlierMessages.map((message) => (
                                  <MessageStrip
                                    key={message.id}
                                    message={message}
                                    isOutbound={message.direction === "outbound"}
                                    onImportAttachment={
                                      selectedThread.primaryLink && message.direction === "inbound"
                                        ? importAttachmentToWorkspace
                                        : undefined
                                    }
                                    importingAttachmentId={importingAttachmentId}
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
                                  <EmailMessageBody message={latestMessage} />

                                  <AttachmentShelf
                                    attachments={latestMessage.attachments}
                                    onImportAttachment={
                                      selectedThread.primaryLink && latestMessage.direction === "inbound"
                                        ? importAttachmentToWorkspace
                                        : undefined
                                    }
                                    importingAttachmentId={importingAttachmentId}
                                  />
                                </div>
                              </section>
                            ) : null}
                          </div>
                        </div>

                        {/* Reply composer — pinned to bottom */}
                        <div className="border-t border-black/8 bg-white px-5 py-4">
                          <div className="space-y-3">
                            {replyJourney === "ai_generated" &&
                            replySignatureMissingFields.length > 0 &&
                            isReplySignatureBannerVisible ? (
                              <div className="flex items-start justify-between gap-3 border border-black/8 bg-[#f7f4ed] px-3 py-2">
                                <p className="text-[12px] leading-5 text-foreground">
                                  <span className="font-semibold">
                                    Missing {replySignatureMissingFields.join(", ")}
                                  </span>{" "}
                                  in your creator profile.{" "}
                                  <Link
                                    href="/app/settings/profile"
                                    className="font-medium underline underline-offset-4 transition hover:text-primary"
                                  >
                                    Set up your creator profile
                                  </Link>{" "}
                                  to improve your email signature.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.localStorage.setItem(
                                      INBOX_SIGNATURE_BANNER_DISMISS_KEY,
                                      replySignatureBannerStateKey
                                    );
                                    setIsReplySignatureBannerVisible(false);
                                  }}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-black/8 bg-white text-muted-foreground transition hover:bg-secondary"
                                  aria-label="Dismiss inbox signature reminder"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : null}
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
                                  className="h-6 min-h-0 overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 text-[12px] leading-6 text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 disabled:opacity-100"
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
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveDraft("in_progress")}
                                  disabled={isSavingDraft || !replyBody.trim()}
                                  className="inline-flex h-9 items-center border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03] disabled:opacity-40"
                                >
                                  {isSavingDraft ? "Saving..." : "Save draft"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void markDraftReady()}
                                  disabled={isSavingDraft || !replyBody.trim()}
                                  className="inline-flex h-9 items-center border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03] disabled:opacity-40"
                                >
                                  Mark ready
                                </button>
                                {canAttachInvoice ? (
                                  <button
                                    type="button"
                                    onClick={() => setIsInvoiceAttached((current) => !current)}
                                    className={`inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition ${
                                      isInvoiceAttached
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-black/10 text-foreground hover:bg-black/[0.03]"
                                    }`}
                                  >
                                    <Paperclip className="h-3.5 w-3.5" />
                                    {isInvoiceAttached ? "Invoice attached" : "Attach invoice"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void sendReply()}
                                  disabled={!canSendReply || isSendingReply}
                                  className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  {isSendingReply ? "Sending..." : "Send"}
                                </button>
                              </div>
                            </div>
                            {selectedThreadInvoiceAttachment ? (
                              <div className="flex flex-wrap items-center justify-between gap-3 border border-black/8 bg-secondary/10 px-4 py-3 text-[12px] text-muted-foreground">
                                <div>
                                  <p className="font-medium text-foreground">
                                    {selectedThreadInvoiceAttachment.invoiceNumber}
                                  </p>
                                  <p>
                                    {selectedThreadInvoiceAttachment.fileName}
                                  </p>
                                  {!canAttachInvoice ? (
                                    <p className="mt-1">This invoice has been voided and will not be attached.</p>
                                  ) : null}
                                </div>
                                <Link
                                  href={`/api/documents/${selectedThreadInvoiceAttachment.documentId}/content`}
                                  target="_blank"
                                  className="inline-flex border-b border-black/20 pb-1 text-[12px] font-medium text-foreground transition hover:border-black/50"
                                >
                                  Preview invoice
                                </Link>
                              </div>
                            ) : null}
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
                    onSelect={() => void runPromptForDraft()}
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
                            const isPrimary = primaryCandidateId === match.candidate.id;

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
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => choosePrimaryCandidate(match.candidate.id)}
                                      className={`px-2.5 py-1 text-[10px] font-medium transition ${
                                        isPrimary
                                          ? "bg-[#eff6ff] text-[#1d4ed8]"
                                          : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
                                      }`}
                                    >
                                      {isPrimary ? "Primary workspace" : "Set as primary"}
                                    </button>
                                  </div>
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

      <InboxFilterDialog
        open={isFilterDialogOpen}
        onOpenChange={setIsFilterDialogOpen}
        draftProviderFilter={draftProviderFilter}
        setDraftProviderFilter={setDraftProviderFilter}
        draftDealFilter={draftDealFilter}
        setDraftDealFilter={setDraftDealFilter}
        draftWorkflowFilter={draftWorkflowFilter}
        setDraftWorkflowFilter={setDraftWorkflowFilter}
        connectedProviders={connectedProviders}
        deals={deals}
        onClear={clearDialogFilters}
        onApply={applyDialogFilters}
      />

      <InboxSortDialog
        open={isSortDialogOpen}
        onOpenChange={setIsSortDialogOpen}
        draftSort={draftSort}
        setDraftSort={setDraftSort}
        onApply={applyDialogSort}
      />

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
              Choose a primary workspace owner or add a reference workspace for this thread.
            </p>

            <div className="mt-5 space-y-4">
              <InboxSelect
                value={selectedDealId}
                onChange={(value) => {
                  setSelectedDealId(value);
                  const existingLink = selectedThread.links.find((link) => link.dealId === value);
                  setSelectedLinkRole(existingLink?.role === "reference" ? "reference" : "primary");
                }}
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

              <InboxSelect
                value={selectedLinkRole}
                onChange={(value) =>
                  setSelectedLinkRole(value === "reference" ? "reference" : "primary")
                }
              >
                <option value="primary">Primary workspace</option>
                <option value="reference">Reference workspace</option>
              </InboxSelect>

              {linkableDeals.length === 0 ? (
                <p className="text-[12px] leading-5 text-muted-foreground">
                  No active workspaces are available to link right now.
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void linkSelectedDeal()}
                  disabled={!selectedDealId || isLinking || linkableDeals.length === 0}
                  className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isLinking
                    ? "Updating..."
                    : linkedDealIds.has(selectedDealId)
                      ? "Unlink workspace"
                      : selectedLinkRole === "primary"
                        ? "Set primary workspace"
                        : "Add reference"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <InboxPrivateNotesDialog
        open={Boolean(selectedThread && isNotesDialogOpen)}
        onOpenChange={setIsNotesDialogOpen}
        selectedThread={selectedThread}
        noteBody={noteBody}
        setNoteBody={setNoteBody}
        isSavingNote={isSavingNote}
        onSave={() => {
          void savePrivateNote();
        }}
      />

      <Dialog
        open={isManualAddModalOpen}
        onOpenChange={(open) => {
          setIsManualAddModalOpen(open);
          if (!open) {
            setManualAddQuery("");
            setManualAddSelectedThreadIds([]);
            setManualAddThreads([]);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[920px] overflow-hidden rounded-none p-0 sm:max-w-[920px] [&>button]:rounded-none">
          <DialogHeader className="gap-3 border-b border-black/8 px-6 py-5 pr-12">
            <DialogTitle>Add threads manually</DialogTitle>
            <DialogDescription>
              Browse the latest 20 synced emails by default. Search scans up to the first 1000 synced emails and lets you link the threads you want to a workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
              <InboxSelect
                value={manualAddDealId}
                onChange={setManualAddDealId}
                className="w-full min-w-0"
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

              <Input
                value={manualAddQuery}
                onChange={(event) => setManualAddQuery(event.currentTarget.value)}
                placeholder="Search synced emails"
                aria-label="Search synced emails"
                className="h-9 w-full min-w-0 rounded-none border-black/10 bg-white text-[12px] shadow-none"
              />
            </div>

            <div className="border border-black/8 rounded-none">
              <div className="flex items-center justify-between border-b border-black/8 px-4 py-3 text-[12px] text-muted-foreground">
                <span>
                  {manualAddQuery.trim()
                    ? `Search results from up to 1000 synced emails`
                    : "Latest 20 synced emails"}
                </span>
                <span>{manualAddThreads.length}</span>
              </div>

              <div className="max-h-[440px] min-h-[320px] overflow-y-auto">
                {isManualAddLoading ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">
                    Loading emails...
                  </div>
                ) : manualAddThreads.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">
                    No synced emails match this search.
                  </div>
                ) : (
                  manualAddThreads.map((item) => {
                    const alreadyLinkedToSelectedDeal = Boolean(
                      manualAddDealId &&
                        item.links.some((link) => link.dealId === manualAddDealId)
                    );

                    return (
                      <label
                        key={item.thread.id}
                        className="flex cursor-pointer items-start gap-3 border-b border-black/6 px-4 py-3 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedManualThreadIdSet.has(item.thread.id)}
                          disabled={alreadyLinkedToSelectedDeal}
                          onChange={() => toggleManualAddThread(item.thread.id)}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-foreground">
                                {participantLabel(item.thread.participants[0])}
                              </p>
                              <p className="truncate text-[12px] text-foreground/90">
                                {item.thread.subject}
                              </p>
                            </div>
                            <p className="shrink-0 text-[11px] text-muted-foreground">
                              {formatDate(item.thread.lastMessageAt)}
                            </p>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                            {threadPreviewText(item)}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="bg-white px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                              {providerLabel(item.account.provider)}
                            </span>
                            {alreadyLinkedToSelectedDeal ? (
                              <span className="bg-secondary/60 px-2.5 py-1 text-[10px] font-medium text-foreground">
                                Already linked
                              </span>
                            ) : null}
                            {item.links.length > 0 ? (
                              <span className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                                {item.links.length} workspace{item.links.length === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-black/8 pt-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <p className="text-[12px] text-muted-foreground">
                  {manualAddSelectedThreadIds.length} thread{manualAddSelectedThreadIds.length === 1 ? "" : "s"} selected
                </p>
                {selectedManualThreads.length > 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    Or create a new workspace from the first selected email.
                  </p>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-end">
                <button
                  type="button"
                  onClick={() => setIsManualAddModalOpen(false)}
                  className={`${THREAD_ACTION_BUTTON_CLASS} w-full min-w-[8.75rem] md:w-auto`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void createWorkspaceFromSelectedThreads()}
                  disabled={selectedManualThreads.length === 0 || isManualAddSubmitting || isManualAddCreatingWorkspace}
                  className={`${THREAD_ACTION_BUTTON_CLASS} w-full min-w-[8.75rem] md:w-auto`}
                >
                  {isManualAddCreatingWorkspace ? "Creating..." : "Create workspace"}
                </button>
                <button
                  type="button"
                  onClick={() => void submitManualAddThreads()}
                  disabled={
                    !manualAddDealId ||
                    manualAddSelectedThreadIds.length === 0 ||
                    isManualAddSubmitting ||
                    isManualAddCreatingWorkspace
                  }
                  className={`${THREAD_ACTION_BUTTON_CLASS} w-full min-w-[9.75rem] md:w-auto`}
                >
                  {isManualAddSubmitting ? "Adding..." : "Add selected threads"}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
