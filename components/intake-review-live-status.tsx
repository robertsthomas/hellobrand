"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

import type {
  ConflictResult,
  IntakeProcessingSnapshot,
  IntakeSessionStatus,
  RiskFlagRecord
} from "@/lib/types";

type AttentionItem = {
  id: string;
  label: string;
  detail?: string;
  tone: "warning" | "neutral";
};

function buildAttentionItems(
  conflictResults: ConflictResult[],
  riskFlags: RiskFlagRecord[]
): AttentionItem[] {
  return [
    ...conflictResults.map((conflict) => ({
      id: `conflict-${conflict.type}-${conflict.title}`,
      label: conflict.title,
      detail: conflict.detail,
      tone: "warning" as const
    })),
    ...riskFlags.slice(0, 4).map((flag) => ({
      id: flag.id,
      label: flag.title,
      detail: flag.detail,
      tone: (flag.severity === "high" ? "warning" : "neutral") as "warning" | "neutral"
    }))
  ];
}

function getStageState(
  processing: IntakeProcessingSnapshot,
  stageId: "risk_review" | "summary"
) {
  if (processing.completedStages.includes(stageId)) {
    return "complete" as const;
  }

  if (processing.isRunning && processing.currentStage === stageId) {
    return "active" as const;
  }

  return "pending" as const;
}

function StageStatusRow({
  label,
  state
}: {
  label: string;
  state: "pending" | "active" | "complete";
}) {
  return (
    <div className="flex items-center gap-3 bg-white/60 px-4 py-3 dark:bg-white/[0.03]">
      {state === "complete" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-black/55 dark:text-white/55" />
      ) : state === "active" ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-black/55 dark:text-white/55" />
      ) : (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-black/15 dark:bg-white/15" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          {state === "complete"
            ? "Finished"
            : state === "active"
              ? "Generating now"
              : "Queued"}
        </p>
      </div>
    </div>
  );
}

export function IntakeReviewLiveStatus({
  sessionId,
  initialStatus,
  initialProcessing,
  conflictResults,
  initialRiskFlags
}: {
  sessionId: string;
  initialStatus: IntakeSessionStatus;
  initialProcessing: IntakeProcessingSnapshot;
  conflictResults: ConflictResult[];
  initialRiskFlags: RiskFlagRecord[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [processing, setProcessing] = useState(initialProcessing);
  const [riskFlags, setRiskFlags] = useState(initialRiskFlags);

  useEffect(() => {
    setStatus(initialStatus);
    setProcessing(initialProcessing);
    setRiskFlags(initialRiskFlags);
  }, [initialProcessing, initialRiskFlags, initialStatus]);

  useEffect(() => {
    if (!processing.isRunning) {
      return;
    }

    let disposed = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/intake/${sessionId}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Status request failed: ${response.status}`);
        }

        const payload = await response.json();

        if (disposed) {
          return;
        }

        setStatus(payload?.session?.status ?? initialStatus);
        setProcessing(payload?.processing ?? initialProcessing);
        setRiskFlags(payload?.aggregate?.riskFlags ?? []);
      } catch {
        // Keep the last rendered state and try again on the next interval.
      }

      if (!disposed) {
        timeoutId = setTimeout(poll, 3000);
      }
    }

    void poll();

    return () => {
      disposed = true;
      clearTimeout(timeoutId);
    };
  }, [initialProcessing, initialStatus, processing.isRunning, sessionId]);

  const attentionItems = buildAttentionItems(conflictResults, riskFlags);
  const showBackgroundStatus =
    processing.isRunning &&
    (processing.currentStage === "risk_review" || processing.currentStage === "summary");

  return (
    <>
      {showBackgroundStatus ? (
        <section className="border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-black/55 dark:text-white/55" />
            <h2 className="text-sm font-semibold text-ink">Finalizing AI review</h2>
          </div>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            Your extracted fields are ready to review. We&apos;re still finishing
            risk review and the workspace summary in the background.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <StageStatusRow label="Core fields ready to review" state="complete" />
            <StageStatusRow
              label="Risk review"
              state={getStageState(processing, "risk_review")}
            />
            <StageStatusRow
              label="Workspace summary"
              state={getStageState(processing, "summary")}
            />
          </div>
        </section>
      ) : null}

      {attentionItems.length > 0 ? (
        <section className="border border-clay/15 bg-clay/[0.04] p-5 dark:border-clay/20 dark:bg-clay/[0.06]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-clay" />
            <h2 className="text-sm font-semibold text-ink">
              Needs attention ({attentionItems.length})
            </h2>
          </div>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            {status === "ready_for_confirmation" && processing.isRunning
              ? "Risk review is still finishing. New watchouts will appear here automatically."
              : "Review these before confirming. You can edit any value in the form below."}
          </p>
          <div className="mt-4 grid gap-2">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 bg-white/60 px-4 py-3 dark:bg-white/[0.03]"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 ${
                    item.tone === "warning"
                      ? "bg-clay"
                      : "bg-black/20 dark:bg-white/20"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  {item.detail ? (
                    <p className="mt-1 text-sm text-black/55 dark:text-white/55">
                      {item.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
