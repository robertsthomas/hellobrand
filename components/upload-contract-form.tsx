"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, MessageSquareText, Plus } from "lucide-react";

import { uploadDocumentsAction } from "@/app/actions";
import type { DocumentRecord } from "@/lib/types";
import { cn, humanizeToken } from "@/lib/utils";
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/textarea";

type UploadMode = "upload" | "paste";

export function UploadContractForm({
  dealId,
  documents
}: {
  dealId: string;
  documents: DocumentRecord[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<UploadMode>("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const latestDocument = documents[0] ?? null;

  const selectedFilesLabel = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "No files selected";
    }

    if (selectedFiles.length === 1) {
      return selectedFiles[0]?.name ?? "1 file selected";
    }

    return `${selectedFiles.length} files selected`;
  }, [selectedFiles]);

  return (
    <form
      action={uploadDocumentsAction}
      className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]"
    >
      <input type="hidden" name="dealId" value={dealId} />

      <div className="flex flex-col gap-4 border-b border-black/8 pb-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
            Add documents
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
            Attach another file or paste more context for this workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 border px-3 py-2 text-sm transition",
              mode === "upload"
                ? "border-black/15 bg-black/5 text-foreground dark:border-white/15 dark:bg-white/[0.06]"
                : "border-black/8 text-black/55 hover:border-black/12 hover:text-foreground dark:border-white/10 dark:text-white/60 dark:hover:text-white"
            )}
          >
            <Plus className="h-4 w-4" />
            Add documents
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 border px-3 py-2 text-sm transition",
              mode === "paste"
                ? "border-black/15 bg-black/5 text-foreground dark:border-white/15 dark:bg-white/[0.06]"
                : "border-black/8 text-black/55 hover:border-black/12 hover:text-foreground dark:border-white/10 dark:text-white/60 dark:hover:text-white"
            )}
          >
            <MessageSquareText className="h-4 w-4" />
            Paste content
          </button>
        </div>
      </div>

      <div className="pt-5">
        {mode === "upload" ? (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              name="documents"
              multiple
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(event) =>
                setSelectedFiles(Array.from(event.currentTarget.files ?? []))
              }
            />

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-black/8 text-black/55 dark:border-white/10 dark:text-white/60">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedFilesLabel}</p>
                  <p className="text-xs text-black/45 dark:text-white/45">
                    PDFs, DOCX, and TXT work best.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Choose files
                </button>
                <SubmitButton
                  pendingLabel="Adding to workspace..."
                  showSpinner
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,color,border-color,box-shadow,transform] duration-200 hover:bg-primary/94 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
                >
                  Add to workspace
                </SubmitButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              name="pastedText"
              className="min-h-36 rounded-none border-black/10 px-4 py-4 text-sm dark:border-white/12"
              placeholder="Paste an email thread, contract excerpt, brief, or other plain-text context."
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-black/45 dark:text-white/45">
                Plain text works best here. The content will be attached to this workspace only.
              </p>
              <SubmitButton
                pendingLabel="Adding to workspace..."
                showSpinner
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,color,border-color,box-shadow,transform] duration-200 hover:bg-primary/94 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                Add to workspace
              </SubmitButton>
            </div>
          </div>
        )}
      </div>

      {latestDocument ? (
        <div className="mt-5 border-t border-black/8 pt-4 text-xs text-black/45 dark:border-white/10 dark:text-white/45">
          Latest document:{" "}
          <span className="font-medium text-black/65 dark:text-white/70">
            {latestDocument.fileName}
          </span>{" "}
          · {humanizeToken(latestDocument.processingStatus)}
        </div>
      ) : null}

      {documents.some((document) => document.errorMessage) ? (
        <div className="mt-4 grid gap-2">
          {documents
            .filter((document) => document.errorMessage)
            .map((document) => (
              <p
                key={document.id}
                className="border-l-2 border-clay/60 bg-clay/5 px-4 py-3 text-sm text-clay"
              >
                {document.fileName}: {document.errorMessage}
              </p>
            ))}
        </div>
      ) : null}
    </form>
  );
}
