"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";

import type {
  IntakeProcessingSnapshot,
  IntakeProcessingStageId,
  IntakeSessionStatus
} from "@/lib/types";

const STAGE_LABELS: Record<IntakeProcessingStageId, string> = {
  extracting: "Extracting source details",
  structuring: "Structuring key terms",
  risk_review: "Reviewing rights and conflicts",
  summary: "Preparing your workspace"
};

const STAGE_ORDER: IntakeProcessingStageId[] = [
  "extracting",
  "structuring",
  "risk_review",
  "summary"
];

export function IntakeProcessingState({
  documentsCount,
  sessionId,
  status,
  initialProcessing
}: {
  documentsCount: number;
  sessionId: string;
  status: IntakeSessionStatus;
  initialProcessing: IntakeProcessingSnapshot;
}) {
  const [processing, setProcessing] = useState(initialProcessing);

  useEffect(() => {
    setProcessing(initialProcessing);
  }, [initialProcessing]);

  useEffect(() => {
    function handleUpdate(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (detail?.sessionId === sessionId && detail?.processing) {
        setProcessing(detail.processing);
      }
    }

    window.addEventListener("intake-processing-update", handleUpdate);
    return () => window.removeEventListener("intake-processing-update", handleUpdate);
  }, [sessionId]);

  const activeIndex = useMemo(() => {
    const currentStage = processing.currentStage;
    if (!currentStage) return 0;
    const index = STAGE_ORDER.indexOf(currentStage);
    return index === -1 ? 0 : index;
  }, [processing.currentStage]);

  const isExtractionStarting = status === "queued" || !processing.isRunning;
  const activeLabel = isExtractionStarting
    ? "Extraction starting"
    : STAGE_LABELS[STAGE_ORDER[activeIndex]] ?? "Processing";
  const statusDescription = isExtractionStarting
    ? "Queuing your source material for extraction"
    : documentsCount > 0
      ? `Analyzing ${documentsCount} source${documentsCount === 1 ? "" : "s"}`
      : "Analyzing your uploaded source material";
  const progress = isExtractionStarting
    ? 8
    : Math.round(((activeIndex + 0.5) / STAGE_ORDER.length) * 100);

  return (
    <section className="w-full py-8">
      <div className="mx-auto w-full max-w-md text-center">
        {/* Spinner */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center">
          <span
            className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-black/10 border-t-foreground dark:border-white/10 dark:border-t-white"
            aria-hidden="true"
          />
        </div>

        {/* Status */}
        <p className="mt-6 text-lg font-semibold tracking-[-0.02em] text-foreground">
          {activeLabel}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {statusDescription}
        </p>

        {/* Progress bar */}
        <div className="mx-auto mt-6 h-1 w-full max-w-xs overflow-hidden bg-black/[0.06] dark:bg-white/[0.08]">
          <div
            className="h-full bg-foreground transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stage dots */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {STAGE_ORDER.map((stageId, index) => {
            const isComplete = processing.completedStages.includes(stageId) || index < activeIndex;
            const isActive = index === activeIndex;

            return (
              <div
                key={stageId}
                className={[
                  "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                  isComplete
                    ? "bg-foreground"
                    : isActive
                      ? "bg-foreground/50"
                      : "bg-black/10 dark:bg-white/10"
                ].join(" ")}
              />
            );
          })}
        </div>

        {/* "You can leave" note */}
        <div className="mt-10 border-t border-black/6 pt-6 dark:border-white/8">
          <div className="flex items-start justify-center gap-3 text-left">
            {/* <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> */}
            <p className="text-sm leading-6 text-muted-foreground">
              You can close this page and keep exploring. We'll notify you when your workspace is ready to review.
            </p>
          </div>

          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-foreground/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
