"use client";

import { useCallback, useState } from "react";
import { ClipboardCopy, Loader2, Printer, RefreshCw, Sparkles } from "lucide-react";

import { ProseText } from "@/components/prose-text";
import type { BriefData, GeneratedBrief, GeneratedBriefSection } from "@/lib/types";

interface BriefGeneratorProps {
  dealId: string;
  briefData: BriefData | null | undefined;
}

function SectionCard({ section }: { section: GeneratedBriefSection }) {
  return (
    <div className="space-y-3 border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {section.title}
      </p>
      <ProseText content={section.content} className="text-sm leading-6 text-foreground" />
      {section.items && section.items.length > 0 ? (
        <ul className="list-disc space-y-1.5 pl-5">
          {section.items.map((item, index) => (
            <li key={`${section.id}-${index}`} className="text-sm leading-6 text-foreground">
              <ProseText content={item} className="inline text-sm text-foreground" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatBriefAsText(sections: GeneratedBriefSection[]) {
  return sections
    .map((section) => {
      const lines = [section.title.toUpperCase(), "", section.content];
      if (section.items && section.items.length > 0) {
        lines.push("");
        for (const item of section.items) {
          lines.push(`  - ${item}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

// fallow-ignore-next-line complexity
export function BriefGenerator({ dealId, briefData }: BriefGeneratorProps) {
  const hasUploadedBrief = Boolean(briefData);
  const [brief, setBrief] = useState<GeneratedBrief | null>(
    hasUploadedBrief ? briefData?.generatedSummary ?? null : null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const actionLabel = hasUploadedBrief ? "Generate brief summary" : "Generate brief";

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/p/${dealId}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: hasUploadedBrief ? "summary" : "brief" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to generate brief");
      }

      const data = await response.json();
      setBrief(data.brief as GeneratedBrief);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate the campaign brief."
      );
    } finally {
      setIsGenerating(false);
    }
  }, [dealId, hasUploadedBrief]);

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!brief) {
      return;
    }

    await navigator.clipboard.writeText(formatBriefAsText(brief.sections));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, [brief]);

  if (!brief) {
    return (
      <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {hasUploadedBrief ? "Generate Brief Summary" : "Generate Campaign Brief"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasUploadedBrief
                ? "Summarize the uploaded brand brief into clear creator-facing terms."
                : "Synthesize all partnership context into a polished, section-structured brief."}
            </p>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={isGenerating}
            className="inline-flex w-full items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:opacity-50 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20 sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "Generating..." : actionLabel}
          </button>
        </div>
        {errorMessage ? (
          <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6">
      <div className="space-y-5">
        {errorMessage ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {hasUploadedBrief ? "Brief Summary" : "Campaign Brief"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Generated {new Date(brief.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 border border-black/10 bg-white px-3 py-2 text-xs font-medium text-foreground transition hover:border-black/20 disabled:opacity-50 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {hasUploadedBrief ? "Regenerate summary" : "Regenerate"}
            </button>
            {!hasUploadedBrief ? (
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 border border-black/10 bg-white px-3 py-2 text-xs font-medium text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
              >
                <Printer className="h-3.5 w-3.5" />
                Export PDF
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 border border-black/10 bg-white px-3 py-2 text-xs font-medium text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              {copyFeedback ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div data-print-brief className="grid gap-3">
          {brief.sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </div>
    </section>
  );
}
