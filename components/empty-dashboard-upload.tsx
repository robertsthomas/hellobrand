"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, Plus } from "lucide-react";

import { ACCEPTED_DOCUMENT_TYPES } from "@/components/intake-file-field";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";
import { cn } from "@/lib/utils";

function logClientIntake(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(`[client-intake] ${event}`, details);
}

export function EmptyDashboardUpload({
  initialMode = "upload"
}: {
  initialMode?: "upload" | "paste";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createStartedRef = useRef(false);
  const createPromiseRef = useRef<Promise<string> | null>(null);
  const [isPasteExpanded, setIsPasteExpanded] = useState(false);
  const router = useRouter();
  const sessionId = useIntakeUiStore((state) => state.sessionId);
  const isSubmitting = useIntakeUiStore((state) => state.isSubmitting);
  const mode = useIntakeUiStore((state) => state.mode);
  const pastedText = useIntakeUiStore((state) => state.pastedText);
  const errorMessage = useIntakeUiStore((state) => state.errorMessage);
  const setMode = useIntakeUiStore((state) => state.setMode);
  const setPastedText = useIntakeUiStore((state) => state.setPastedText);
  const setSessionId = useIntakeUiStore((state) => state.setSessionId);
  const setSelectedFilesFromList = useIntakeUiStore(
    (state) => state.setSelectedFilesFromList
  );
  const setIsSubmitting = useIntakeUiStore((state) => state.setIsSubmitting);
  const setErrorMessage = useIntakeUiStore((state) => state.setErrorMessage);
  const reset = useIntakeUiStore((state) => state.reset);

  useEffect(() => {
    reset(initialMode);
  }, [initialMode, reset]);

  async function createDraftSessionId() {
    if (createPromiseRef.current) {
      return createPromiseRef.current;
    }

    createStartedRef.current = true;
    createPromiseRef.current = (async () => {
      const response = await fetch("/api/intake/draft", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });

      const payload = await response.json();

      if (!response.ok || !payload.session?.id) {
        throw new Error(payload.error ?? "Could not start intake.");
      }

      setSessionId(payload.session.id);
      logClientIntake("draft_session_ready", {
        sessionId: payload.session.id
      });
      return payload.session.id as string;
    })();

    try {
      return await createPromiseRef.current;
    } finally {
      createPromiseRef.current = null;
    }
  }

  async function getOrCreateDraftSessionId() {
    if (sessionId) {
      return sessionId;
    }

    return createDraftSessionId();
  }

  async function uploadSessionDocuments({
    sessionId,
    files,
    pastedText
  }: {
    sessionId: string;
    files: File[];
    pastedText: string;
  }) {
    logClientIntake("background_upload_start", {
      sessionId,
      fileCount: files.length,
      pastedChars: pastedText.length
    });

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("documents", file);
      }
      if (pastedText) {
        formData.append("pastedText", pastedText);
      }

      const response = await fetch(`/api/intake/${sessionId}/documents`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not upload documents.");
      }

      logClientIntake("background_upload_complete", {
        sessionId,
        status: payload.session?.status ?? null
      });
      createStartedRef.current = false;
      reset("upload");
      router.refresh();
    } catch (error) {
      logClientIntake("background_upload_failed", {
        sessionId,
        error:
          error instanceof Error ? error.message : "Could not upload documents."
      });
      setErrorMessage(
        error instanceof Error ? error.message : "Could not upload documents."
      );
      createStartedRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function startDraftSession({
    files,
    pastedSourceText,
    forceFreshSession = false
  }: {
    files: File[];
    pastedSourceText: string;
    forceFreshSession?: boolean;
  }) {
    setIsSubmitting(true);
    setErrorMessage(null);
    logClientIntake("draft_session_start", {
      mode,
      fileCount: files.length,
      hasPastedText: pastedSourceText.length > 0
    });

    try {
      const nextSessionId = forceFreshSession
        ? await createDraftSessionId()
        : await getOrCreateDraftSessionId();
      logClientIntake("draft_session_complete", {
        sessionId: nextSessionId,
        forceFreshSession
      });
      void uploadSessionDocuments({
        sessionId: nextSessionId,
        files,
        pastedText: pastedSourceText
      });
      router.push(`/app/intake/${nextSessionId}`);
      router.refresh();
    } catch (error) {
      logClientIntake("draft_session_failed", {
        error: error instanceof Error ? error.message : "Could not start intake."
      });
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start intake."
      );
      createStartedRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    const selected = Array.from(files ?? []).filter((file) => file.size > 0);
    if (selected.length === 0) {
      return;
    }

    logClientIntake("files_selected", {
      fileCount: selected.length,
      files: selected.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
    });
    setSelectedFilesFromList(files);
    await startDraftSession({
      files: selected,
      pastedSourceText: ""
    });
  }

  async function handlePasteSubmit() {
    const trimmed = pastedText.trim();

    if (!trimmed) {
      setErrorMessage("Paste some text from the brand first.");
      return;
    }

    logClientIntake("paste_submit", {
      chars: trimmed.length
    });
    await startDraftSession({
      files: [],
      pastedSourceText: trimmed,
      forceFreshSession: true
    });
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        multiple
        accept={ACCEPTED_DOCUMENT_TYPES}
        onChange={(event) => {
          void handleFiles(event.currentTarget.files);
        }}
      />

      <div className="inline-flex rounded-full border border-black/10 bg-white/90 p-1 shadow-sm transition dark:border-white/10 dark:bg-white/[0.04]">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setMode("upload");
            setErrorMessage(null);
            setIsPasteExpanded(false);
          }}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
            mode === "upload"
              ? "bg-ocean text-white shadow-sm"
              : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white",
            isSubmitting ? "opacity-60" : ""
          )}
        >
          Upload files
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setMode("paste");
            setErrorMessage(null);
          }}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
            mode === "paste"
              ? "bg-ocean text-white shadow-sm"
              : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white",
            isSubmitting ? "opacity-60" : ""
          )}
        >
          Paste text
        </button>
      </div>

      {mode === "upload" ? (
        <div className="flex w-full max-w-xl flex-col items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              inputRef.current?.click();
            }}
            className={cn(
              buttonVariants({ className: "gap-2" }),
              isSubmitting ? "cursor-not-allowed opacity-60" : ""
            )}
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Uploading..." : "Upload documents"}
          </button>

          <p className="max-w-md text-center text-sm text-black/55 dark:text-white/60">
            This starts a new deal workspace. Begin with the contract, then add
            briefs, decks, invoices, or email context later.
          </p>
        </div>
      ) : (
        <div className="flex w-full max-w-2xl flex-col gap-3 text-left transition-all duration-200">
          {isPasteExpanded ? (
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />
          ) : null}
          <div
            className={cn(
              isPasteExpanded
                ? "fixed inset-0 z-50 flex items-center justify-center p-8"
                : "relative"
            )}
          >
            <div
              className={cn(
                "relative transition-all duration-200",
                isPasteExpanded ? "w-[min(92vw,72rem)]" : "w-full"
              )}
            >
            <button
              type="button"
              aria-label={isPasteExpanded ? "Collapse text area" : "Expand text area"}
              title={isPasteExpanded ? "Collapse" : "Expand"}
              onClick={() => setIsPasteExpanded((current) => !current)}
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/95 text-black/55 shadow-sm transition hover:text-black dark:border-white/12 dark:bg-[#111111]/90 dark:text-white/60 dark:hover:text-white"
            >
              {isPasteExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <Textarea
              name="pastedText"
              value={pastedText}
              onChange={(event) => setPastedText(event.currentTarget.value)}
              placeholder="Paste a contract, email thread, brief, deliverables notes, or any brand context here."
              className={cn(
                "rounded-2xl border-black/10 bg-white/90 px-5 py-4 pr-14 text-sm shadow-sm transition-all duration-200 focus-visible:ring-ocean/20 dark:border-white/12 dark:bg-white/[0.04]",
                isPasteExpanded
                  ? "min-h-[min(72vh,46rem)] w-full rounded-[28px] shadow-2xl"
                  : "min-h-44 w-full"
              )}
            />
            </div>
          </div>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="max-w-xl text-sm text-black/55 dark:text-white/60">
              This starts a new deal workspace from pasted text. HelloBrand will
              organize it during analysis.
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handlePasteSubmit()}
              className={cn(
                buttonVariants({ className: "gap-2" }),
                isSubmitting ? "cursor-not-allowed opacity-60" : ""
              )}
            >
              {isSubmitting ? "Analyzing..." : "Analyze text"}
            </button>
          </div>
        </div>
      )}

      {errorMessage ? (
        <p className="text-sm text-clay">{errorMessage}</p>
      ) : null}
    </div>
  );
}
