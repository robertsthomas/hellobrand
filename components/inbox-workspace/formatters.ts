/**
 * Pure display formatting functions for the inbox workspace.
 * No React, no hooks — just data-to-string transforms and icon lookups.
 */
import { File, FileImage, FileText, FileVideo } from "lucide-react";
import type {
  EmailAttachmentRecord,
  EmailMessageRecord,
  EmailParticipant,
  EmailThreadListItem,
  EmailThreadWorkflowState,
  NegotiationStance,
} from "@/lib/types";
import type { InboxSortOption } from "@/lib/email/inbox-sort";

export function providerLabel(provider: string) {
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

export function workflowStateLabel(state: EmailThreadWorkflowState) {
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

export function workflowBadgeClass(state: EmailThreadWorkflowState) {
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

export function inboxSortLabel(sort: InboxSortOption) {
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

export function participantLabel(participant: EmailParticipant | null | undefined) {
  if (!participant) {
    return "Unknown sender";
  }

  return participant.name?.trim() || participant.email;
}

export function initialsFromParticipant(participant: EmailParticipant | null | undefined) {
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

export function formatAttachmentSize(sizeBytes: number) {
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

export function attachmentIcon(attachment: EmailAttachmentRecord) {
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

export function messagePreview(message: EmailMessageRecord) {
  const body = message.textBody?.trim();
  if (!body) {
    return "No preview available.";
  }

  return body.replace(/\s+/g, " ").slice(0, 140);
}

function threadPreviewText(item: EmailThreadListItem) {
  return item.thread.snippet || "No preview available.";
}
