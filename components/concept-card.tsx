"use client";

import { ClipboardCopy, Heart, Loader2, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { ProseText } from "@/components/prose-text";
import type { ConceptRecord } from "@/lib/types";

interface ConceptCardProps {
  concept: ConceptRecord;
  dealId: string;
  onFavorite: (conceptId: string, isFavorite: boolean) => void;
  onGenerateVariations: (conceptId: string) => void;
  onUpdateConcept?: (
    conceptId: string,
    patch: Partial<
      Pick<
        ConceptRecord,
        "title" | "hook" | "summary" | "structure" | "messagingIntegration" | "ctaApproach" | "platformNotes" | "moodAndTone" | "rationale"
      >
    >
  ) => Promise<void>;
}

function CopyButton({ text, t }: { text: string; t: ReturnType<typeof useTranslations> }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
    >
      {copied ? t("card.copied") : t("card.copy")}
      <ClipboardCopy className="h-3.5 w-3.5" />
    </button>
  );
}

function FieldSection({
  label,
  children,
  fieldKey,
  fieldValue,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  t,
}: {
  label: string;
  children: React.ReactNode;
  fieldKey?: string;
  fieldValue?: string;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        {fieldKey && !isEditing ? (
          <button
            type="button"
            onClick={onStartEdit}
            className="text-[10px] font-medium text-muted-foreground opacity-0 transition hover:text-foreground group-hover/concept:opacity-100"
          >
            {t("card.edit")}
          </button>
        ) : null}
      </div>
      {isEditing && fieldKey ? (
        <div className="space-y-2">
          <textarea
            value={editValue ?? ""}
            onChange={(e) => onEditValueChange?.(e.target.value)}
            className="min-h-20 w-full rounded-sm border border-black/10 bg-white px-3 py-2 text-sm leading-6 text-foreground dark:border-white/12 dark:bg-white/[0.03]"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              className="text-xs font-medium text-foreground hover:underline"
            >
              {t("card.save")}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-xs font-medium text-muted-foreground hover:underline"
            >
              {t("card.cancel")}
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function ConceptCard({
  concept,
  dealId: _dealId,
  onFavorite,
  onGenerateVariations,
  onUpdateConcept,
}: ConceptCardProps) {
  const t = useTranslations("concepts");
  const [expanded, setExpanded] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleVariations = useCallback(() => {
    setIsGeneratingVariations(true);
    onGenerateVariations(concept.id);
    setTimeout(() => setIsGeneratingVariations(false), 3000);
  }, [concept.id, onGenerateVariations]);

  const startEditing = useCallback((field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingField || !editValue.trim() || !onUpdateConcept) {
      setEditingField(null);
      return;
    }
    await onUpdateConcept(concept.id, { [editingField]: editValue.trim() });
    setEditingField(null);
  }, [concept.id, editingField, editValue, onUpdateConcept]);

  const formattedConcept = [
    `# ${concept.title}`,
    "",
    `## Hook`,
    concept.hook,
    "",
    `## Summary`,
    concept.summary,
    "",
    `## Structure`,
    concept.structure,
    "",
    `## Messaging Integration`,
    concept.messagingIntegration,
    "",
    `## CTA Approach`,
    concept.ctaApproach,
    ...(concept.platformNotes ? ["", "## Platform Notes", concept.platformNotes] : []),
    "",
    `## Mood & Tone`,
    concept.moodAndTone,
    "",
    `## Rationale`,
    concept.rationale,
  ].join("\n");

  return (
    <div
      className={`border border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03] ${
        concept.isFavorite ? "ring-1 ring-primary/30" : ""
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                {concept.title}
              </h4>
              {concept.isVariation ? (
                <span className="bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:bg-white/10">
                  Variation
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-foreground/80">
              {concept.summary}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onFavorite(concept.id, !concept.isFavorite)}
              className="rounded-sm p-1.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              title={concept.isFavorite ? t("card.removeFavorite") : t("card.markFavorite")}
            >
              <Heart
                className={`h-4 w-4 ${
                  concept.isFavorite
                    ? "fill-primary text-primary"
                    : "text-muted-foreground"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded-sm p-1.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              title={expanded ? t("card.collapse") : t("card.expand")}
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Maximize2 className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {expanded ? (
          <div className="mt-5 grid gap-4">
            <FieldSection label={t("card.hook")} fieldKey="hook" fieldValue={concept.hook} isEditing={editingField === "hook"} editValue={editValue} onEditValueChange={setEditValue} onStartEdit={() => startEditing("hook", concept.hook)} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} t={t}>
              <ProseText content={concept.hook} className="text-sm leading-6 text-foreground" />
            </FieldSection>
            <FieldSection label={t("card.structure")} fieldKey="structure" fieldValue={concept.structure} isEditing={editingField === "structure"} editValue={editValue} onEditValueChange={setEditValue} onStartEdit={() => startEditing("structure", concept.structure)} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} t={t}>
              <ProseText content={concept.structure} className="text-sm leading-6 text-foreground" />
            </FieldSection>
            <FieldSection label={t("card.messagingIntegration")} fieldKey="messagingIntegration" fieldValue={concept.messagingIntegration} isEditing={editingField === "messagingIntegration"} editValue={editValue} onEditValueChange={setEditValue} onStartEdit={() => startEditing("messagingIntegration", concept.messagingIntegration)} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} t={t}>
              <ProseText
                content={concept.messagingIntegration}
                className="text-sm leading-6 text-foreground"
              />
            </FieldSection>
            <FieldSection label={t("card.ctaApproach")} fieldKey="ctaApproach" fieldValue={concept.ctaApproach} isEditing={editingField === "ctaApproach"} editValue={editValue} onEditValueChange={setEditValue} onStartEdit={() => startEditing("ctaApproach", concept.ctaApproach)} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} t={t}>
              <ProseText content={concept.ctaApproach} className="text-sm leading-6 text-foreground" />
            </FieldSection>
            {concept.platformNotes ? (
              <FieldSection label={t("card.platformNotes")} fieldKey="platformNotes" fieldValue={concept.platformNotes ?? ""} isEditing={editingField === "platformNotes"} editValue={editValue} onEditValueChange={setEditValue} onStartEdit={() => startEditing("platformNotes", concept.platformNotes ?? "")} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} t={t}>
                <ProseText
                  content={concept.platformNotes}
                  className="text-sm leading-6 text-foreground"
                />
              </FieldSection>
            ) : null}
            <FieldSection label={t("card.moodAndTone")} fieldKey="moodAndTone" fieldValue={concept.moodAndTone} isEditing={editingField === "moodAndTone"} editValue={editValue} onEditValueChange={setEditValue} onStartEdit={() => startEditing("moodAndTone", concept.moodAndTone)} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} t={t}>
              <ProseText content={concept.moodAndTone} className="text-sm leading-6 text-foreground" />
            </FieldSection>
            <FieldSection label={t("card.rationale")} fieldKey="rationale" fieldValue={concept.rationale} isEditing={editingField === "rationale"} editValue={editValue} onEditValueChange={setEditValue} onStartEdit={() => startEditing("rationale", concept.rationale)} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} t={t}>
              <ProseText content={concept.rationale} className="text-sm leading-6 text-foreground" />
            </FieldSection>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("card.hook")}
              </p>
              <p className="mt-0.5 text-sm leading-6 text-foreground/70 line-clamp-2">
                {concept.hook}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("card.ctaApproach")}
              </p>
              <p className="mt-0.5 text-sm leading-6 text-foreground/70 line-clamp-2">
                {concept.ctaApproach}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 border-t border-black/5 pt-3 dark:border-white/8">
          <button
            type="button"
            onClick={handleVariations}
            disabled={isGeneratingVariations}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            {isGeneratingVariations ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isGeneratingVariations ? t("card.variationsGenerating") : t("card.variations")}
          </button>
          <CopyButton text={formattedConcept} t={t} />
        </div>
      </div>
    </div>
  );
}
