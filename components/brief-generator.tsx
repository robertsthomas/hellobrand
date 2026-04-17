"use client";

import { useState, useCallback } from "react";
import { Sparkles, RefreshCw, Printer, ClipboardCopy, Pencil, Check, Loader2 } from "lucide-react";

import { ProseText } from "@/components/prose-text";
import type { BriefData, DocumentRecord, GeneratedBrief, GeneratedBriefSection } from "@/lib/types";

interface BriefGeneratorProps {
  dealId: string;
  briefData: BriefData | null | undefined;
  documents: DocumentRecord[];
}

function SectionCard({
  section,
  isEditing,
  editedContent,
  editedItems,
  onToggleEdit,
  onContentChange,
  onItemsChange,
}: {
  section: GeneratedBriefSection;
  isEditing: boolean;
  editedContent: string;
  editedItems: string[];
  onToggleEdit: () => void;
  onContentChange: (value: string) => void;
  onItemsChange: (value: string[]) => void;
}) {
  return (
    <div className="space-y-2 border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {section.title}
        </p>
        <button
          type="button"
          onClick={onToggleEdit}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          {isEditing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            className="w-full resize-y rounded border border-black/10 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary dark:border-white/10"
            rows={4}
            value={editedContent}
            onChange={(e) => onContentChange(e.target.value)}
          />
          {editedItems.length > 0 && (
            <textarea
              className="w-full resize-y rounded border border-black/10 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary dark:border-white/10"
              rows={Math.max(3, editedItems.length)}
              value={editedItems.join("\n")}
              onChange={(e) => onItemsChange(e.target.value.split("\n"))}
              placeholder="One item per line"
            />
          )}
        </div>
      ) : (
        <>
          <ProseText content={editedContent} className="text-sm leading-relaxed text-foreground" />
          {editedItems.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {editedItems.map((item, i) => (
                <li key={i} className="text-sm text-foreground">
                  <ProseText content={item} className="inline text-sm text-foreground" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function formatBriefAsText(sections: Array<{ title: string; content: string; items?: string[] }>) {
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
export function BriefGenerator({ dealId, briefData, documents }: BriefGeneratorProps) {
  const [brief, setBrief] = useState<GeneratedBrief | null>(null);
  const [editedSections, setEditedSections] = useState<
    Record<string, { content: string; items: string[] }>
  >({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasUploadedBrief = Boolean(briefData);
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
      const generated = data.brief as GeneratedBrief;
      setBrief(generated);

      const initial: Record<string, { content: string; items: string[] }> = {};
      for (const section of generated.sections) {
        initial[section.id] = {
          content: section.content,
          items: section.items ?? [],
        };
      }
      setEditedSections(initial);
      setEditingIds(new Set());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate the campaign brief."
      );
    } finally {
      setIsGenerating(false);
    }
  }, [dealId, hasUploadedBrief]);

  const toggleEdit = useCallback((id: string) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!brief) return;
    const sections = brief.sections.map((s) => ({
      title: s.title,
      content: editedSections[s.id]?.content ?? s.content,
      items: editedSections[s.id]?.items ?? s.items ?? [],
    }));
    await navigator.clipboard.writeText(formatBriefAsText(sections));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, [brief, editedSections]);

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
                ? "Summarize the uploaded brand brief into key creator-facing terms."
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
    <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-card">
      <div className="space-y-6">
        {errorMessage ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {hasUploadedBrief ? "Brief Summary" : "Campaign Brief"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Generated {new Date(brief.generatedAt).toLocaleString()} · {brief.modelVersion}
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
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 border border-black/10 bg-white px-3 py-2 text-xs font-medium text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
            >
              <Printer className="h-3.5 w-3.5" />
              Export PDF
            </button>
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

        <div data-print-brief className="grid gap-4 md:grid-cols-2">
          {brief.sections.map((section) => (
            <div
              key={section.id}
              className={
                section.id === "campaign-overview" || section.id === "deliverables-summary"
                  ? "md:col-span-2"
                  : ""
              }
            >
              <SectionCard
                section={section}
                isEditing={editingIds.has(section.id)}
                editedContent={editedSections[section.id]?.content ?? section.content}
                editedItems={editedSections[section.id]?.items ?? section.items ?? []}
                onToggleEdit={() => toggleEdit(section.id)}
                onContentChange={(value) =>
                  setEditedSections((prev) => ({
                    ...prev,
                    [section.id]: {
                      ...prev[section.id],
                      content: value,
                      items: prev[section.id]?.items ?? section.items ?? [],
                    },
                  }))
                }
                onItemsChange={(value) =>
                  setEditedSections((prev) => ({
                    ...prev,
                    [section.id]: {
                      ...prev[section.id],
                      content: prev[section.id]?.content ?? section.content,
                      items: value,
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
