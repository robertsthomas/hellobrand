"use client";

import { FileText, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useMemo, useRef, useState } from "react";

import { reprocessDocumentAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadDocumentsViaDirectStorage } from "@/lib/browser/direct-document-upload";
import { getDocumentDisplayStatus } from "@/lib/document-status";
import { captureAppEvent } from "@/lib/posthog/events";
import type { DocumentRecord, DocumentReviewItemRecord, JobRecord } from "@/lib/types";
import { cn, humanizeToken } from "@/lib/utils";

// fallow-ignore-next-line complexity
export function UploadContractForm({
  dealId,
  documents,
  jobs,
  reviewItems,
}: {
  dealId: string;
  documents: DocumentRecord[];
  jobs: JobRecord[];
  reviewItems: DocumentReviewItemRecord[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const posthog = usePostHog();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const latestDocument = documents[0] ?? null;
  const latestStatus = latestDocument
    ? getDocumentDisplayStatus({
        document: latestDocument,
        jobs,
        reviewItems,
      })
    : null;

  const selectedFilesLabel = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "No files selected";
    }

    if (selectedFiles.length === 1) {
      return selectedFiles[0]?.name ?? "1 file selected";
    }

    return `${selectedFiles.length} files selected`;
  }, [selectedFiles]);
  const recentDocuments = useMemo(
    () =>
      documents.slice(0, 3).map((document) => ({
        document,
        status: getDocumentDisplayStatus({
          document,
          jobs,
          reviewItems,
        }),
      })),
    [documents, jobs, reviewItems]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const pastedField = event.currentTarget.elements.namedItem("pastedText");
    const pastedText = pastedField instanceof HTMLTextAreaElement ? pastedField.value.trim() : "";

    captureAppEvent(
      posthog,
      selectedFiles.length > 0
        ? "workspace_documents_submitted"
        : "workspace_pasted_context_submitted",
      {
        surface: "deal_upload_form",
        dealId,
        fileCount: selectedFiles.length,
      }
    );

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await uploadDocumentsViaDirectStorage({
        registerUrl: `/api/p/${dealId}/documents/direct/register`,
        completeUrl: `/api/p/${dealId}/documents/direct/complete`,
        uploadUrl: `/api/p/${dealId}/documents`,
        files: selectedFiles,
        pastedText,
        onRegistered: async () => {
          router.refresh();
        },
      });

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not upload documents.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-card"
    >
      <input type="hidden" name="dealId" value={dealId} />

      <div className="border-b border-black/8 pb-5 dark:border-white/10">
        <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
          Add documents
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
          Attach another file or paste more context for this workspace.
        </p>
      </div>

      <div className="space-y-5 pt-5">
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            name="documents"
            multiple
            accept=".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
            onChange={(event) => setSelectedFiles(Array.from(event.currentTarget.files ?? []))}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (isSubmitting) return;
              captureAppEvent(posthog, "workspace_file_picker_clicked", {
                surface: "deal_upload_form",
                mode: "upload",
              });
              fileInputRef.current?.click();
            }}
            onKeyDown={(event) => {
              if (isSubmitting) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "flex cursor-pointer items-center gap-3 border border-dashed border-black/12 p-4 transition hover:border-black/20 hover:bg-black/[0.01] dark:border-white/12 dark:hover:border-white/20 dark:hover:bg-white/[0.02]",
              selectedFiles.length > 0 &&
                "border-solid border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-black/8 text-black/55 dark:border-white/10 dark:text-white/60">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{selectedFilesLabel}</p>
              <p className="text-xs text-black/45 dark:text-white/45">
                PDFs, DOCX, PPTX, and TXT · click to browse
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Textarea
            name="pastedText"
            className="min-h-28 rounded-none border-black/10 px-4 py-4 text-sm dark:border-white/12"
            placeholder="Or paste an email thread, contract excerpt, brief, or other plain-text context."
            disabled={isSubmitting}
          />
          <p className="text-xs text-black/45 dark:text-white/45">
            Plain text works best. The content will be attached to this workspace only.
          </p>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            aria-busy={isSubmitting || undefined}
            disabled={isSubmitting}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,color,border-color,box-shadow,transform] duration-200 hover:bg-primary/94 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                Adding to workspace...
              </>
            ) : (
              "Add to workspace"
            )}
          </button>
        </div>
      </div>

      {latestDocument ? (
        <div className="mt-5 border-t border-black/8 pt-4 text-xs text-black/45 dark:border-white/10 dark:text-white/45">
          Latest document:{" "}
          <span className="font-medium text-black/65 dark:text-white/70">
            {latestDocument.fileName}
          </span>{" "}
          · {latestStatus?.label ?? humanizeToken(latestDocument.processingStatus)}
          {latestStatus ? (
            <span className="text-black/40 dark:text-white/40"> · {latestStatus.detail}</span>
          ) : null}
        </div>
      ) : null}

      {recentDocuments.length > 0 ? (
        <div className="mt-4 grid gap-2 border-t border-black/8 pt-4 dark:border-white/10">
          {recentDocuments.map(({ document, status }) => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-3 text-xs text-black/50 dark:text-white/50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-black/65 dark:text-white/70">
                  {document.fileName}
                </p>
                <p className="mt-1">
                  {status.label} · {status.detail}
                </p>
              </div>
              {status.state === "failed" ? (
                <form action={reprocessDocumentAction}>
                  <input type="hidden" name="dealId" value={dealId} />
                  <input type="hidden" name="documentId" value={document.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Retry
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
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

      {submitError ? (
        <p className="mt-4 border-l-2 border-clay/60 bg-clay/5 px-4 py-3 text-sm text-clay">
          {submitError}
        </p>
      ) : null}
    </form>
  );
}
