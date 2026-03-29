"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileCheck2, Search, ShieldCheck, Sparkles } from "lucide-react";

import type {
  IntakeProcessingSnapshot,
  IntakeProcessingStageId,
  IntakeSessionStatus
} from "@/lib/types";

const steps: Array<{
  id: IntakeProcessingStageId;
  title: string;
  subtitle: string;
  icon: typeof Search;
}> = [
  {
    id: "extracting",
    title: "Extracting source details",
    subtitle: "Parsing files, classifying documents, and isolating sections.",
    icon: Search
  },
  {
    id: "structuring",
    title: "Structuring key terms",
    subtitle: "Pulling out payment, deliverables, contacts, rights, and dates.",
    icon: Sparkles
  },
  {
    id: "risk_review",
    title: "Reviewing rights and conflicts",
    subtitle: "Checking restrictions, disclosure obligations, and creator risks.",
    icon: ShieldCheck
  },
  {
    id: "summary",
    title: "Preparing review",
    subtitle: "Generating the summary and saving the review-ready workspace draft.",
    icon: FileCheck2
  }
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

  // Listen for processing updates broadcast by IntakeAutoRefresh
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
    if (!currentStage) {
      return 0;
    }

    const index = steps.findIndex((step) => step.id === currentStage);
    return index === -1 ? 0 : index;
  }, [processing.currentStage]);

  return (
    <section className="w-full py-8">
      <div className="mx-auto w-full max-w-[700px]">
        <div className="space-y-1 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/35">
            Processing intake
          </p>
          <p className="text-[15px] text-black/58 dark:text-white/58">
            {documentsCount > 0
              ? `Working through ${documentsCount} uploaded source${documentsCount === 1 ? "" : "s"}.`
              : "Working through your uploaded or pasted source material."}
          </p>
          <p className="pt-2 text-sm font-medium text-black/72 dark:text-white/72">
            {processing.activeLabel}
          </p>
          <p className="text-sm text-black/50 dark:text-white/52">
            {processing.activeDescription}
          </p>
        </div>

        <div>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isComplete =
              processing.completedStages.includes(step.id) || index < activeIndex;
            const isActive = index === activeIndex;

            return (
              <div
                key={step.id}
                className="flex items-center gap-3 border-t border-black/6 py-5 first:border-t dark:border-white/8"
              >
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                    isComplete
                      ? "border-[#0f1728] bg-[#0f1728] text-white"
                      : isActive
                        ? "border-black/8 bg-white text-[#0f1728]"
                        : "border-black/5 bg-white/70 text-black/35"
                  ].join(" ")}
                >
                  {isComplete ? (
                    <Check className="h-4.5 w-4.5" />
                  ) : (
                    <Icon className="h-4.5 w-4.5" strokeWidth={2.05} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-[0.98rem] font-semibold tracking-[-0.02em] transition-colors duration-300",
                      isActive || isComplete ? "text-[#101828]" : "text-black/48"
                    ].join(" ")}
                  >
                    {step.title}
                  </p>
                  <p
                    className={[
                      "text-[0.94rem] transition-colors duration-300",
                      isActive || isComplete ? "text-black/54" : "text-black/34"
                    ].join(" ")}
                  >
                    {step.subtitle}
                  </p>
                </div>

                <div className="flex w-6 shrink-0 justify-end">
                  {isActive ? (
                    <span
                      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-[#0f1728]"
                      aria-hidden="true"
                    />
                  ) : isComplete ? (
                    <span className="h-2 w-2 rounded-full bg-[#0f1728]" aria-hidden="true" />
                  ) : (
                    <span
                      className="h-5 w-5 rounded-full border border-black/10 bg-white/60"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
