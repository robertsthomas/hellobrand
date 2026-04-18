"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";

import { activateSummaryVariantAction } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseDealSummarySections, toPlainDealSummary } from "@/lib/deal-summary";
import { getSummaryTypeLabel } from "@/lib/summaries";
import type { SummaryRecord, SummaryType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface DealSummaryPanelProps {
  dealId: string;
  summaries: SummaryRecord[];
  currentSummary: SummaryRecord | null;
}

const VARIANT_TABS: { type: SummaryType; label: string }[] = [
  { type: "legal", label: "Legal" },
  { type: "plain_language", label: "Plain language" },
  { type: "short", label: "Short" },
];

function SummaryBody({ summary }: { summary: SummaryRecord }) {
  const sections = parseDealSummarySections(summary.body);
  const plainSummary = toPlainDealSummary(summary.body) ?? summary.body;

  if (sections.length === 0) {
    return (
      <div className="max-w-4xl">
        <p className="text-[15px] leading-8 text-black/72 dark:text-white/72">{plainSummary}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div
          key={section.id}
          className="space-y-2 border-b border-black/6 pb-4 last:border-b-0 last:pb-0 dark:border-white/10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-white/42">
            {section.title}
          </p>
          {section.paragraphs.map((paragraph, index) => (
            <p
              key={`${section.id}-${index}`}
              className="text-[15px] leading-8 text-black/72 dark:text-white/72"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DealSummaryPanel({ dealId, summaries: _summaries, currentSummary }: DealSummaryPanelProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runVariantAction = (summaryType: SummaryType) => {
    setErrorMessage(null);
    setPendingLabel(`Switching to ${getSummaryTypeLabel(summaryType)}...`);

    startTransition(async () => {
      const result = await activateSummaryVariantAction(dealId, summaryType);
      if (result?.error) {
        setErrorMessage(result.error);
      }
      setPendingLabel(null);
    });
  };

  if (!currentSummary) {
    return (
      <div className="max-w-4xl">
        <p className="text-[15px] leading-8 text-black/72 dark:text-white/72">
          Upload documents to generate a plain-English summary, extracted creator terms, and
          negotiation watchouts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Variant switcher */}
        <div className="flex items-center gap-0 border border-black/10 dark:border-white/10">
          {VARIANT_TABS.map((tab) => {
            const isActive = currentSummary.summaryType === tab.type;

            return (
              <button
                key={tab.type}
                type="button"
                disabled={isPending}
                onClick={() => runVariantAction(tab.type)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span className="text-sm text-muted-foreground">{formatDate(currentSummary.createdAt)}</span>
      </div>

      {isPending && pendingLabel ? (
        <div className="inline-flex items-center gap-2 text-sm text-black/55 dark:text-white/60">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {pendingLabel}
        </div>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Summary update blocked</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <SummaryBody summary={currentSummary} />
    </div>
  );
}
