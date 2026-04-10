/**
 * Reusable sub-components for rendering email messages and attachments
 * inside the inbox thread detail view.
 */
"use client";

import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { AttachmentDocumentPreview } from "@/components/attachment-document-preview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmailAttachmentRecord, EmailMessageRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  attachmentIcon,
  formatAttachmentSize,
  initialsFromParticipant,
  messagePreview,
  participantLabel,
} from "./formatters";
import { sanitizeEmailHtml } from "./helpers";

export function attachmentPreviewMode(attachment: EmailAttachmentRecord) {
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

export function EmailMessageBody({ message }: { message: EmailMessageRecord }) {
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

export function AttachmentShelf({
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

export function AttachmentPreviewDialog({
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

export function MessageStrip({
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
