"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";
import type { IntakeSessionStatus } from "@/lib/types";

function logClientRefresh(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(`[client-intake-refresh] ${event}`, details);
}

export function IntakeAutoRefresh({
  sessionId,
  status,
  readyHref
}: {
  sessionId: string;
  status: IntakeSessionStatus;
  readyHref?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const pendingSessionId = useIntakeUiStore((state) => state.sessionId);
  const isSubmitting = useIntakeUiStore((state) => state.isSubmitting);
  const lastKnownStatus = useRef(status);
  const [remoteStatus, setRemoteStatus] = useState<IntakeSessionStatus>(status);
  const shouldPoll =
    ["uploading", "processing"].includes(status) ||
    (status === "draft" && pendingSessionId === sessionId && isSubmitting);

  useEffect(() => {
    lastKnownStatus.current = status;
    setRemoteStatus(status);
  }, [status]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    let disposed = false;

    async function pollSession() {
      try {
        const response = await fetch(`/api/intake/${sessionId}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Status request failed: ${response.status}`);
        }

        const payload = await response.json();
        const nextStatus = payload?.session?.status as IntakeSessionStatus | undefined;

        if (!nextStatus || disposed) {
          return;
        }

        setRemoteStatus(nextStatus);

        if (
          readyHref &&
          ["ready_for_confirmation", "failed"].includes(nextStatus)
        ) {
          logClientRefresh("ready_redirect", {
            sessionId,
            status: nextStatus,
            readyHref
          });
          router.replace(readyHref);
          return;
        }

        if (nextStatus !== lastKnownStatus.current) {
          logClientRefresh("status_changed", {
            sessionId,
            from: lastKnownStatus.current,
            to: nextStatus
          });

          startTransition(() => {
            router.refresh();
          });
          return;
        }

        if (["ready_for_confirmation", "failed", "completed"].includes(nextStatus)) {
          logClientRefresh("terminal_status_refresh", {
            sessionId,
            status: nextStatus
          });

          startTransition(() => {
            router.refresh();
          });
        }
      } catch (error) {
        logClientRefresh("poll_failed", {
          sessionId,
          error:
            error instanceof Error ? error.message : "Could not poll intake status."
        });
      }
    }

    void pollSession();
    const timer = window.setInterval(() => {
      void pollSession();
    }, 2500);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [isSubmitting, pendingSessionId, router, sessionId, shouldPoll, startTransition, status]);

  if (!shouldPoll && !["uploading", "processing"].includes(remoteStatus)) {
    return null;
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs text-black/45 dark:text-white/45">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      {status === "draft" && shouldPoll
        ? "Uploading your source and preparing analysis."
        : remoteStatus === status
        ? "Checking intake status automatically."
        : `Refreshing intake after ${remoteStatus.replaceAll("_", " ")}.`}
    </p>
  );
}
