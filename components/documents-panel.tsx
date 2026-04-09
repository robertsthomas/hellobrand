"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { reprocessDocumentAction } from "@/app/actions";
import { getDocumentDisplayStatus } from "@/lib/document-status";
import type { DocumentRecord, DocumentReviewItemRecord, JobRecord } from "@/lib/types";
import { humanizeToken } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AttachmentDocumentPreview } from "@/components/attachment-document-preview";
import { Button } from "@/components/ui/button";

function supportsInlinePreview(document: DocumentRecord) {
  return (
    document.sourceType === "pasted_text" ||
    document.mimeType === "application/pdf" ||
    document.mimeType.startsWith("text/") ||
    document.mimeType.startsWith("image/")
  );
}

function documentPreviewUrl(documentId: string) {
  return `/api/documents/${documentId}/content`;
}

export function DocumentsPanel({
  dealId,
  documents,
  jobs,
  reviewItems
}: {
  dealId: string;
  documents: DocumentRecord[];
  jobs: JobRecord[];
  reviewItems: DocumentReviewItemRecord[];
}) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    documents[0]?.id ?? null
  );

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId]
  );
  const selectedStatus = selectedDocument
    ? getDocumentDisplayStatus({
        document: selectedDocument,
        jobs,
        reviewItems
      })
    : null;

  return (
    <section className="grid gap-6 xl:h-[min(78vh,820px)] xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col border border-black/8 bg-white dark:border-white/10 dark:bg-[#161a1f]">
        <div className="shrink-0 border-b border-black/8 px-5 py-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-foreground">Documents</h2>
          <p className="mt-1 text-sm text-black/55 dark:text-white/60">
            Select a source to preview it.
          </p>
        </div>

        {documents.length > 0 ? (
          <div className="min-h-0 overflow-y-auto divide-y divide-black/8 dark:divide-white/10">
            {documents.map((document) => {
              const isSelected = selectedDocument?.id === document.id;
              const status = getDocumentDisplayStatus({
                document,
                jobs,
                reviewItems
              });
              return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedDocumentId(document.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-5 py-4 text-left transition",
                    isSelected
                      ? "bg-black/[0.035] dark:bg-white/[0.04]"
                      : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center border border-black/8 text-black/55 dark:border-white/10 dark:text-white/60">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {document.fileName}
                    </p>
                    <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                      {humanizeToken(document.documentKind)} · {status.label}
                    </p>
                    <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                      {status.detail}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-10 text-sm text-black/55 dark:text-white/60">
            No documents uploaded yet.
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col border border-black/8 bg-white dark:border-white/10 dark:bg-[#161a1f]">
        <div className="shrink-0 flex flex-col gap-3 border-b border-black/8 px-5 py-4 dark:border-white/10 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {selectedDocument?.fileName ?? "Preview"}
            </h3>
            <p className="mt-1 text-sm text-black/55 dark:text-white/60">
              {selectedDocument
                ? `${humanizeToken(selectedDocument.documentKind)} · ${selectedStatus?.label ?? humanizeToken(
                    selectedDocument.processingStatus
                  )}`
                : "Select a document to preview it."}
            </p>
            {selectedStatus ? (
              <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                {selectedStatus.detail}
              </p>
            ) : null}
          </div>

          {selectedDocument ? (
            <div className="flex items-center gap-2">
              {selectedStatus?.state === "review_needed" ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/app/p/${dealId}?tab=terms`}>Review {selectedStatus.reviewCount}</Link>
                </Button>
              ) : null}
              {selectedDocument.processingStatus === "failed" ? (
                <form action={reprocessDocumentAction}>
                  <input type="hidden" name="dealId" value={dealId} />
                  <input type="hidden" name="documentId" value={selectedDocument.id} />
                  <Button type="submit" size="sm" variant="outline">
                    <RefreshCcw className="h-4 w-4" />
                    Retry
                  </Button>
                </form>
              ) : null}

              {selectedDocument.sourceType !== "pasted_text" ? (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={documentPreviewUrl(selectedDocument.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="min-h-[540px] flex-1 overflow-hidden bg-black/[0.015] dark:bg-black/10 xl:min-h-0">
          {!selectedDocument ? (
            <div className="flex min-h-[540px] items-center justify-center px-6 text-sm text-black/50 dark:text-white/55">
              Upload or paste a source to preview it here.
            </div>
          ) : selectedStatus?.state === "parsing" || selectedStatus?.state === "extracting" ? (
            <div className="flex min-h-[540px] items-center justify-center px-6 text-center">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{selectedStatus.label}</p>
                <p className="text-sm text-black/55 dark:text-white/60">{selectedStatus.detail}</p>
              </div>
            </div>
          ) : selectedDocument.errorMessage ? (
            <div className="flex min-h-[540px] items-center justify-center px-6">
              <div className="max-w-lg border-l-2 border-clay/60 bg-clay/5 px-4 py-4 text-sm text-clay">
                {selectedDocument.errorMessage}
              </div>
            </div>
          ) : selectedDocument.mimeType.startsWith("image/") ? (
            <div className="flex h-[540px] items-center justify-center p-6">
              <img
                src={documentPreviewUrl(selectedDocument.id)}
                alt={selectedDocument.fileName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : selectedDocument.sourceType === "pasted_text" ? (
            <AttachmentDocumentPreview
              kind="text"
              previewUrl={documentPreviewUrl(selectedDocument.id)}
              downloadUrl={documentPreviewUrl(selectedDocument.id)}
            />
          ) : selectedDocument.mimeType === "application/pdf" ? (
            <AttachmentDocumentPreview
              kind="pdf"
              previewUrl={documentPreviewUrl(selectedDocument.id)}
              downloadUrl={documentPreviewUrl(selectedDocument.id)}
            />
          ) : selectedDocument.mimeType.startsWith("text/") ? (
            <AttachmentDocumentPreview
              kind="text"
              previewUrl={documentPreviewUrl(selectedDocument.id)}
              downloadUrl={documentPreviewUrl(selectedDocument.id)}
            />
          ) : supportsInlinePreview(selectedDocument) ? (
            <iframe
              title={selectedDocument.fileName}
              src={documentPreviewUrl(selectedDocument.id)}
              className="h-[540px] w-full border-0 bg-white"
            />
          ) : (
            <div className="flex min-h-[540px] items-center justify-center px-6">
              <div className="space-y-3 text-center">
                <p className="text-sm text-black/55 dark:text-white/60">
                  Preview is not available for this file type.
                </p>
                <Button variant="outline" asChild>
                  <a
                    href={documentPreviewUrl(selectedDocument.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open document
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
