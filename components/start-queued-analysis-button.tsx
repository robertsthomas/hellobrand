"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { buildWorkspaceNotificationItem } from "@/lib/notifications";
import { dispatchWorkspaceGenerationNotification } from "@/lib/workspace-generation-hint";
import { cn } from "@/lib/utils";

export function StartQueuedAnalysisButton({
  sessionIds,
  className,
  children = "Start analysis"
}: {
  sessionIds: string[];
  className?: string;
  children?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleStart() {
    if (sessionIds.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const optimisticNotificationId = `optimistic-workspace-processing:${Date.now()}`;

    dispatchWorkspaceGenerationNotification({
      action: "upsert",
      notification: buildWorkspaceNotificationItem({
        id: optimisticNotificationId,
        sessionId: sessionIds[0] ?? optimisticNotificationId,
        dealId: sessionIds[0] ?? optimisticNotificationId,
        draftBrandName: "Your",
        draftCampaignName: "workspace",
        eventType: "workspace.processing_started"
      })
    });

    try {
      const response = await fetch("/api/intake/queue/start", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ sessionIds })
      });
      const payload = await response.json();

      if (!response.ok || !payload.session?.id) {
        throw new Error(payload.error ?? "Could not start analysis.");
      }

      dispatchWorkspaceGenerationNotification({
        action: "upsert",
        replaceId: optimisticNotificationId,
        notification: buildWorkspaceNotificationItem({
          sessionId: payload.session.id,
          dealId: payload.session.dealId ?? payload.session.id,
          draftBrandName: payload.session.draftBrandName ?? null,
          draftCampaignName: payload.session.draftCampaignName ?? null,
          eventType: "workspace.processing_started",
          createdAt: payload.session.updatedAt ?? new Date().toISOString()
        })
      });

      router.push(`/app/intake/${payload.session.id}`);
      router.refresh();
    } catch (error) {
      dispatchWorkspaceGenerationNotification({
        action: "remove",
        notificationId: optimisticNotificationId
      });
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start analysis."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={isSubmitting || sessionIds.length === 0}
        onClick={() => void handleStart()}
        className={cn(buttonVariants({ className: "gap-2" }), className)}
      >
        <Play className="h-4 w-4" />
        {isSubmitting ? "Starting analysis..." : children}
      </button>
      {errorMessage ? <p className="text-sm text-clay">{errorMessage}</p> : null}
    </div>
  );
}
