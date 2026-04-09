"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { uploadDocumentsViaDirectStorage } from "@/lib/browser/direct-document-upload";
import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";
import type { IntakeSessionStatus } from "@/lib/types";

const activePendingUploads = new Set<string>();

function logClientIntake(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(`[client-intake] ${event}`, details);
}

export function IntakePendingUpload({
  sessionId,
  status
}: {
  sessionId: string;
  status: IntakeSessionStatus;
}) {
  const router = useRouter();
  const pendingFiles = useIntakeUiStore((state) => state.pendingFiles);
  const pastedText = useIntakeUiStore((state) => state.pastedText);
  const isSubmitting = useIntakeUiStore((state) => state.isSubmitting);
  const setIsSubmitting = useIntakeUiStore((state) => state.setIsSubmitting);
  const setErrorMessage = useIntakeUiStore((state) => state.setErrorMessage);
  const reset = useIntakeUiStore((state) => state.reset);
  const uploadKey = `${sessionId}:${pendingFiles
    .map((file) => `${file.name}:${file.size}:${file.type}`)
    .join("|")}:${pastedText.trim()}`;

  useEffect(() => {
    if (status !== "draft" || isSubmitting) {
      if (process.env.NODE_ENV !== "production") {
        logClientIntake("pending_upload_skipped", {
          sessionId,
          status,
          isSubmitting,
          pendingFiles: pendingFiles.length,
          pastedChars: pastedText.trim().length
        });
      }
      return;
    }

    if (pendingFiles.length === 0 && !pastedText.trim()) {
      logClientIntake("pending_upload_empty", {
        sessionId,
        status
      });
      return;
    }

    if (activePendingUploads.has(uploadKey)) {
      logClientIntake("pending_upload_deduped", {
        sessionId,
        uploadKey
      });
      return;
    }

    activePendingUploads.add(uploadKey);
    let disposed = false;

    async function uploadPending() {
      setIsSubmitting(true);
      setErrorMessage(null);
      logClientIntake("pending_upload_start", {
        sessionId,
        fileCount: pendingFiles.length,
        pastedChars: pastedText.trim().length
      });

      try {
        const payload = await uploadDocumentsViaDirectStorage({
          registerUrl: `/api/intake/${sessionId}/documents/direct/register`,
          completeUrl: `/api/intake/${sessionId}/documents/direct/complete`,
          uploadUrl: `/api/intake/${sessionId}/documents`,
          files: pendingFiles,
          pastedText,
          onRegistered: async () => {
            router.refresh();
          }
        });

        logClientIntake("pending_upload_complete", {
          sessionId,
          status: payload.session?.status ?? null
        });
        if (!disposed) {
          reset("upload");
          router.refresh();
        }
      } catch (error) {
        logClientIntake("pending_upload_failed", {
          sessionId,
          error:
            error instanceof Error ? error.message : "Could not upload documents."
        });
        if (!disposed) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not upload documents."
          );
          setIsSubmitting(false);
        }
      } finally {
        activePendingUploads.delete(uploadKey);
      }
    }

    void uploadPending();

    return () => {
      disposed = true;
      logClientIntake("pending_upload_cleanup", {
        sessionId,
        uploadKey
      });
    };
  }, [
    isSubmitting,
    pastedText,
    pendingFiles,
    reset,
    router,
    sessionId,
    setErrorMessage,
    setIsSubmitting,
    status,
    uploadKey
  ]);

  if (status !== "draft" || (pendingFiles.length === 0 && !pastedText.trim())) {
    return null;
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-black/45 dark:text-white/45">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      Uploading your selected source into this intake session.
    </p>
  );
}
