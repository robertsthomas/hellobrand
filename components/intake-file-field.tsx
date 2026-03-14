"use client";

import { useEffect, useMemo, useRef } from "react";

import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";

export const ACCEPTED_DOCUMENT_TYPES = [
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".txt",
  ".eml",
  ".msg",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/plain",
  "message/rfc822",
  "application/vnd.ms-outlook",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
].join(",");

export function IntakeFileField({
  autoOpenPicker = false
}: {
  autoOpenPicker?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedFiles = useIntakeUiStore((state) => state.selectedFiles);
  const setSelectedFilesFromList = useIntakeUiStore(
    (state) => state.setSelectedFilesFromList
  );
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    if (!autoOpenPicker || hasAutoOpened.current) {
      return;
    }

    hasAutoOpened.current = true;
    window.setTimeout(() => {
      inputRef.current?.click();
    }, 50);
  }, [autoOpenPicker]);

  const summary = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "No files selected yet.";
    }

    if (selectedFiles.length === 1) {
      return selectedFiles[0]?.name ?? "1 file selected";
    }

    return `${selectedFiles.length} files selected`;
  }, [selectedFiles]);

  return (
    <label className="grid gap-3">
      <span className="text-sm font-medium text-black/70 dark:text-white/75">
        Upload files
      </span>
      <div className="rounded-xl border border-dashed border-black/15 bg-white px-4 py-5 dark:border-white/12 dark:bg-white/[0.03]">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          name="documents"
          multiple
          accept={ACCEPTED_DOCUMENT_TYPES}
          onChange={(event) => {
            setSelectedFilesFromList(event.currentTarget.files);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-ocean px-4 py-2.5 text-sm font-semibold text-white dark:bg-sand dark:text-[#18201d]"
          >
            Choose documents
          </button>
          <span className="text-sm text-black/60 dark:text-white/65">{summary}</span>
        </div>
        <p className="mt-3 text-xs text-black/45 dark:text-white/45">
          Supports contract and campaign document formats only: PDF, DOC, DOCX,
          RTF, TXT, EML, MSG, PPT, PPTX, XLS, and XLSX.
        </p>
      </div>
    </label>
  );
}
