"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, GitCompareArrows, History, LoaderCircle, RotateCcw } from "lucide-react";

import { activateSummaryVariantAction, restoreSummaryVersionAction } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { parseDealSummarySections, toPlainDealSummary } from "@/lib/deal-summary";
import { getSummaryTypeLabel, getWorkspaceSummaries } from "@/lib/summaries";
import type { SummaryRecord, SummaryType } from "@/lib/types";
import { cn, formatDate, humanizeToken } from "@/lib/utils";

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

export function DealSummaryPanel({ dealId, summaries, currentSummary }: DealSummaryPanelProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareSummaryId, setCompareSummaryId] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const workspaceSummaries = useMemo(() => getWorkspaceSummaries(summaries), [summaries]);
  const compareSummary =
    workspaceSummaries.find((summary) => summary.id === compareSummaryId) ?? null;

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

  const runRestoreAction = (summaryId: string) => {
    setErrorMessage(null);
    setPendingLabel("Restoring summary version...");

    startTransition(async () => {
      const result = await restoreSummaryVersionAction(dealId, summaryId);
      if (result?.error) {
        setErrorMessage(result.error);
      } else if (compareSummaryId === summaryId) {
        setCompareSummaryId(null);
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

        {/* History toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {formatDate(currentSummary.createdAt)}
          </span>
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" size="sm" variant="outline">
                <History className="h-4 w-4" />
                History
                <Badge variant="secondary" className="ml-1">
                  {workspaceSummaries.length}
                </Badge>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 w-full max-w-full border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-black/10 md:max-w-[520px]">
              <div className="space-y-3">
                {workspaceSummaries.map((summary) => {
                  const isCurrent = summary.id === currentSummary.id;
                  const isComparing = summary.id === compareSummaryId;

                  return (
                    <div
                      key={summary.id}
                      className="flex flex-wrap items-center justify-between gap-3 border border-black/6 px-3 py-3 dark:border-white/10"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {summary.summaryType
                              ? getSummaryTypeLabel(summary.summaryType)
                              : "Summary"}
                          </span>
                          {isCurrent ? (
                            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(summary.createdAt)} ·{" "}
                          {humanizeToken(summary.source ?? "analysis")}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={isComparing ? "default" : "outline"}
                          onClick={() =>
                            setCompareSummaryId((current) =>
                              current === summary.id ? null : summary.id
                            )
                          }
                        >
                          <GitCompareArrows className="h-4 w-4" />
                          {isComparing ? "Hide compare" : "Compare"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending || isCurrent}
                          onClick={() => runRestoreAction(summary.id)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
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

      {compareSummary && compareSummary.id !== currentSummary.id ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 border border-black/8 p-4 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {compareSummary.summaryType
                  ? getSummaryTypeLabel(compareSummary.summaryType)
                  : "Summary"}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDate(compareSummary.createdAt)}
              </span>
            </div>
            <SummaryBody summary={compareSummary} />
          </div>
          <div className="space-y-3 border border-black/8 p-4 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Current
              </span>
              <span className="text-sm font-medium text-foreground">
                {currentSummary.summaryType
                  ? getSummaryTypeLabel(currentSummary.summaryType)
                  : "Summary"}
              </span>
            </div>
            <SummaryBody summary={currentSummary} />
          </div>
        </div>
      ) : (
        <SummaryBody summary={currentSummary} />
      )}
    </div>
  );
}
