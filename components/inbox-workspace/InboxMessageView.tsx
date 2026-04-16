/**
 * Reusable sub-components for rendering email messages and attachments
 * inside the inbox thread detail view.
 */
"use client";

import { useMemo } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import type { EmailAttachmentRecord, EmailMessageRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { initialsFromParticipant, messagePreview, participantLabel } from "./formatters";
import { sanitizeEmailHtml } from "./helpers";

export function attachmentPreviewMode(attachment: EmailAttachmentRecord) {
  if (attachment.mimeType.startsWith("image/")) {
    return "image" as const;
  }

  if (attachment.mimeType.startsWith("video/")) {
    return "video" as const;
  }

  if (attachment.mimeType.includes("pdf") || attachment.filename.toLowerCase().endsWith(".pdf")) {
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

export function EmailMessageBody({ message }: { message: EmailMessageRecord }) {
  const sanitizedHtml = useMemo(
    () => (message.htmlBody?.trim() ? sanitizeEmailHtml(message.htmlBody) : null),
    [message.htmlBody]
  );

  const cleanTextBody = useMemo(() => {
    if (!message.textBody?.trim()) return null;

    const lines = message.textBody.split("\n");
    const cleanLines: string[] = [];
    let foundQuote = false;

    for (const line of lines) {
      // Stop at common quote markers
      if (
        (line.includes("On ") && line.includes("wrote:")) ||
        line.startsWith("> ") ||
        line.startsWith("-----") ||
        (line.includes("---") && line.includes("Original Message")) ||
        foundQuote
      ) {
        foundQuote = true;
        continue;
      }

      // Skip empty lines only if we're about to hit quoted text
      if (line.trim() === "" && cleanLines.length > 0) {
        cleanLines.push(line);
      } else if (line.trim() !== "") {
        cleanLines.push(line);
      }
    }

    // Remove trailing empty lines
    while (cleanLines.length > 0 && cleanLines[cleanLines.length - 1].trim() === "") {
      cleanLines.pop();
    }

    return cleanLines.join("\n").trim() || null;
  }, [message.textBody]);

  if (sanitizedHtml) {
    return (
      <div
        className="max-w-none text-[13px] leading-6 text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:hidden [&_br]:leading-6 [&_div]:max-w-full [&_hr]:hidden [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_table]:my-4 [&_table]:w-full [&_td]:align-top [&_th]:align-top [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_.gmail_quote]:hidden [&_*[style*='border-left']]:hidden"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  return (
    <div className="whitespace-pre-wrap text-[13px] leading-7 text-foreground">
      {cleanTextBody || "No text body available."}
    </div>
  );
}

export function MessageStrip({
  message,
  isOutbound,
  isExpanded,
  onToggleExpand,
}: {
  message: EmailMessageRecord;
  isOutbound: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  // If isExpanded is undefined, it's the latest message - always show full view
  if (isExpanded === undefined) {
    // Full view for latest message (non-collapsible)
    return (
      <div className={`relative px-6 py-6 ${isOutbound ? "" : "border-l-4 border-secondary/30"}`}>
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center text-sm font-semibold ${
              isOutbound ? "bg-foreground text-background" : "bg-secondary/60 text-foreground"
            }`}
          >
            {isOutbound ? "You" : initialsFromParticipant(message.from)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <p className="text-[14px] font-semibold text-foreground">
                {isOutbound ? "You" : participantLabel(message.from)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(message.receivedAt || message.sentAt)}
              </p>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {isOutbound
                ? `To: ${message.to.map(participantLabel).join(", ")}`
                : message.from?.email || ""}
            </p>

            <div className="mt-4 text-[13px] leading-6">
              <EmailMessageBody message={message} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Earlier messages that can be expanded/collapsed
  if (isExpanded === false) {
    // Compact view for earlier messages in thread list
    return (
      <button
        type="button"
        onClick={onToggleExpand}
        className="group relative w-full border-b border-black/6 px-4 py-3 text-left transition hover:bg-secondary/8 last:border-b-0 cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center text-xs font-semibold ${
              isOutbound ? "bg-foreground text-background" : "bg-secondary/60 text-foreground"
            }`}
          >
            {isOutbound ? "You" : initialsFromParticipant(message.from)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-foreground">
                {isOutbound ? "You" : participantLabel(message.from)}
              </p>
              <span className="bg-secondary/65 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                {isOutbound ? "Sent" : "Received"}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
              {messagePreview(message)}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 ml-auto">
            <p className="text-[11px] text-muted-foreground">
              {formatDate(message.receivedAt || message.sentAt)}
            </p>
            <ChevronsDownUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition opacity-60 group-hover:opacity-100" />
          </div>
        </div>
      </button>
    );
  }

  // If expanded, show the full message view
  if (isExpanded) {
    return (
      <div className="relative border-b border-black/6 bg-secondary/5 px-4 py-3 last:border-b-0">
        <button
          type="button"
          onClick={onToggleExpand}
          className="group w-full text-left transition -mx-4 -my-3 px-4 py-3 hover:bg-secondary/10 rounded cursor-pointer"
        >
          <div className="flex items-start gap-3 w-full">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center text-xs font-semibold ${
                isOutbound ? "bg-foreground text-background" : "bg-secondary/60 text-foreground"
              }`}
            >
              {isOutbound ? "You" : initialsFromParticipant(message.from)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold text-foreground">
                  {isOutbound ? "You" : participantLabel(message.from)}
                </p>
                <span className="bg-secondary/65 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {isOutbound ? "Sent" : "Received"}
                </span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2 ml-auto">
              <p className="text-[13px] text-muted-foreground">
                {formatDate(message.receivedAt || message.sentAt)}
              </p>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition opacity-60 group-hover:opacity-100" />
            </div>
          </div>
        </button>
        <div className="mt-3 pl-13 text-[13px] leading-6">
          <EmailMessageBody message={message} />
        </div>
      </div>
    );
  }

  // Full view for expanded message display
  return (
    <div className={`relative px-6 py-6 ${isOutbound ? "" : "border-l-4 border-secondary/30"}`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center text-sm font-semibold ${
            isOutbound ? "bg-foreground text-background" : "bg-secondary/60 text-foreground"
          }`}
        >
          {isOutbound ? "You" : initialsFromParticipant(message.from)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <p className="text-[14px] font-semibold text-foreground">
              {isOutbound ? "You" : participantLabel(message.from)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(message.receivedAt || message.sentAt)}
            </p>
          </div>
          {isOutbound ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              To:{" "}
              {message.to
                .map((p) => p.email)
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-muted-foreground">{message.from?.email || ""}</p>
          )}

          <div className="mt-4 text-[13px] leading-6">
            <EmailMessageBody message={message} />
          </div>
        </div>
      </div>
    </div>
  );
}
