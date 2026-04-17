"use client";

import { useState } from "react";
import { Paperclip, Plus, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AttachmentDocumentPreview } from "@/components/attachment-document-preview";
import type { EmailAttachmentRecord, EmailMessageRecord } from "@/lib/types";
import { formatAttachmentSize, attachmentIcon } from "./formatters";
import { attachmentPreviewMode } from "./InboxMessageView";

type ThreadAttachmentsProps = {
  messages: EmailMessageRecord[];
  primaryLinkId: string | null;
  importingAttachmentId: string | null;
  onImportAttachment: (attachmentId: string) => void;
};

const VISIBLE_LIMIT = 3;

// fallow-ignore-next-line complexity
export function ThreadAttachments({
  messages,
  primaryLinkId,
  importingAttachmentId,
  onImportAttachment,
}: ThreadAttachmentsProps) {
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachmentRecord | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const allAttachments = messages.flatMap((msg) => msg.attachments);

  if (allAttachments.length === 0) {
    return null;
  }

  const visibleAttachments = allAttachments.slice(0, VISIBLE_LIMIT);
  const remainingCount = allAttachments.length - VISIBLE_LIMIT;
  const mode = previewAttachment ? attachmentPreviewMode(previewAttachment) : null;
  const previewUrl = previewAttachment ? `/api/email/attachments/${previewAttachment.id}` : "";
  const downloadUrl = previewAttachment
    ? `/api/email/attachments/${previewAttachment.id}?download=1`
    : "";

  const openPreview = (attachment: EmailAttachmentRecord) => {
    setListOpen(false);
    setPreviewAttachment(attachment);
  };

  return (
    <>
      <div className="shrink-0 bg-[#fbfbf8] px-6 py-3 xl:mr-28 dark:bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            Attachments
          </span>
          {visibleAttachments.map((attachment) => {
            const Icon = attachmentIcon(attachment);
            return (
              <button
                key={attachment.id}
                type="button"
                onClick={() => openPreview(attachment)}
                className="group inline-flex items-center gap-1.5 border border-black/8 bg-white px-2.5 py-1.5 text-[12px] transition hover:border-black/20 hover:bg-secondary/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                title={attachment.filename}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                <span className="max-w-[120px] truncate text-foreground sm:max-w-[180px]">
                  {attachment.filename}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatAttachmentSize(attachment.sizeBytes)}
                </span>
              </button>
            );
          })}
          {remainingCount > 0 ? (
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="inline-flex items-center gap-1.5 border border-black/8 bg-white px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-black/20 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" />
              {remainingCount} more
            </button>
          ) : null}
        </div>
      </div>

      {/* All Attachments List Dialog */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-[min(480px,calc(100vw-2rem))] p-0">
          <DialogHeader className="border-b border-black/8 px-5 py-4">
            <DialogTitle className="text-base">
              All attachments ({allAttachments.length})
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Select a file to preview.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,400px)] overflow-y-auto">
            <div className="divide-y divide-black/6 dark:divide-white/8">
              {allAttachments.map((attachment) => {
                const Icon = attachmentIcon(attachment);
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => openPreview(attachment)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-foreground">
                        {attachment.filename}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {attachment.mimeType} · {formatAttachmentSize(attachment.sizeBytes)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Dialog */}
      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      >
        <DialogContent className="max-h-[calc(100vh-3rem)] max-w-[min(1100px,calc(100vw-2rem))] overflow-hidden p-0">
          {previewAttachment ? (
            <div className="flex h-[min(82vh,900px)] flex-col">
              <DialogHeader className="shrink-0 border-b border-black/8 px-6 py-4 text-left">
                <DialogTitle className="pr-10 text-base">{previewAttachment.filename}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-[12px]">
                  <span>{previewAttachment.mimeType}</span>
                  <span>·</span>
                  <span>{formatAttachmentSize(previewAttachment.sizeBytes)}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 bg-[#f6f6f1]">
                {mode === "image" ? (
                  <div className="flex h-full items-center justify-center p-4">
                    <img
                      src={previewUrl}
                      alt={previewAttachment.filename}
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
                      This file type may not render inline. Open it in a new tab to preview or
                      download it.
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

              <div className="shrink-0 flex items-center justify-between border-t border-black/8 px-6 py-3">
                {mode !== "download" ? (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-[12px] font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Open in new tab
                  </a>
                ) : (
                  <span />
                )}

                {primaryLinkId ? (
                  <button
                    type="button"
                    onClick={() => {
                      onImportAttachment(previewAttachment.id);
                      setPreviewAttachment(null);
                    }}
                    disabled={importingAttachmentId === previewAttachment.id}
                    className="inline-flex items-center gap-1.5 border border-black/10 bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition hover:bg-foreground/90 disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {importingAttachmentId === previewAttachment.id
                      ? "Importing..."
                      : "Import to workspace"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
