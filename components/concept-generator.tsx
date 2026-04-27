"use client";

import { Info, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ConceptCard } from "@/components/concept-card";
import type { ConceptRecord, DeliverableItem } from "@/lib/types";

interface ConceptGeneratorProps {
  dealId: string;
  deliverables: DeliverableItem[];
}

export function ConceptGenerator({ dealId, deliverables }: ConceptGeneratorProps) {
  const t = useTranslations("concepts");
  const [concepts, setConcepts] = useState<ConceptRecord[]>([]);
  const [selectedDeliverable, setSelectedDeliverable] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/p/${dealId}/concepts`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && Array.isArray(data.concepts)) {
            setConcepts(data.concepts);
          }
        }
      } catch {
        // concepts load silently
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dealId]);

  const filteredConcepts = concepts.filter(
    (c) => c.deliverableIndex === selectedDeliverable
  );

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/p/${dealId}/concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          mode: "generate",
          deliverableIndex: selectedDeliverable,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t("generationFailed"));
      }

      const fresh = await fetch(`/api/p/${dealId}/concepts`);
      if (fresh.ok) {
        const data = await fresh.json();
        setConcepts(Array.isArray(data.concepts) ? data.concepts : []);
      }
    } catch (error) {
      console.error("[concept-generator] generate failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : t("generationError")
      );
    } finally {
      setIsGenerating(false);
    }
  }, [dealId, selectedDeliverable, t]);

  const handleFavorite = useCallback(
    async (conceptId: string, isFavorite: boolean) => {
      try {
        await fetch(`/api/p/${dealId}/concepts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId, conceptId, isFavorite }),
        });
        setConcepts((prev) =>
          prev.map((c) => (c.id === conceptId ? { ...c, isFavorite } : c))
        );
      } catch {
        // favorite toggle fails silently
      }
    },
    [dealId]
  );

  const handleUpdateConcept = useCallback(
    async (
      conceptId: string,
      patch: Partial<
        Pick<
          ConceptRecord,
          | "title"
          | "hook"
          | "summary"
          | "structure"
          | "messagingIntegration"
          | "ctaApproach"
          | "platformNotes"
          | "moodAndTone"
          | "rationale"
        >
      >
    ) => {
      const response = await fetch(`/api/p/${dealId}/concepts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId, patch }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not save concept changes.");
      }

      const data = await response.json().catch(() => null);
      if (data?.concept) {
        setConcepts((prev) =>
          prev.map((concept) => (concept.id === conceptId ? data.concept : concept))
        );
      }
    },
    [dealId]
  );

  const handleGenerateVariations = useCallback(
    async (parentConceptId: string) => {
      setIsGenerating(true);
      setErrorMessage(null);
      try {
        const response = await fetch(`/api/p/${dealId}/concepts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId,
            mode: "variations",
            deliverableIndex: selectedDeliverable,
            parentConceptId,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || t("variationFailed"));
        }

        const fresh = await fetch(`/api/p/${dealId}/concepts`);
        if (fresh.ok) {
          const data = await fresh.json();
          setConcepts(Array.isArray(data.concepts) ? data.concepts : []);
        }
      } catch (error) {
        console.error("[concept-generator] variations failed", error);
        setErrorMessage(
          error instanceof Error ? error.message : t("variationError")
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [dealId, selectedDeliverable, t]
  );

  if (deliverables.length === 0) {
    return (
      <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-black/45 dark:text-white/45">
            <Info className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
              {t("noDeliverablesTitle")}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/65 dark:text-white/70">
              {t("noDeliverablesDescription")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const activeDeliverable = deliverables[selectedDeliverable];
  const deliverableLabel = activeDeliverable
    ? `${activeDeliverable.channel ?? ""} ${activeDeliverable.title}`.trim()
    : t("deliverableFallback", { number: selectedDeliverable + 1 });

  return (
    <section className="space-y-6">
      <div className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {t("title")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
              {t("selectDeliverable")}
            </p>
            <div className="flex flex-wrap gap-2">
              {deliverables.map((deliverable, index) => (
                <button
                  key={`${deliverable.id}-${index}`}
                  type="button"
                  onClick={() => setSelectedDeliverable(index)}
                  className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-medium transition ${
                    index === selectedDeliverable
                      ? "border-primary/40 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10"
                      : "border-black/10 bg-white text-muted-foreground hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
                  }`}
                >
                  {deliverable.channel && (
                    <span className="opacity-60">{deliverable.channel}</span>
                  )}
                  <span>{deliverable.title}</span>
                  {deliverable.quantity && (
                    <span className="opacity-50">x{deliverable.quantity}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:opacity-50 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating
                ? t("generating")
                : t("generateButton", { deliverable: deliverableLabel })}
            </button>
          </div>

          {errorMessage ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>

      {filteredConcepts.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("generatedCount", { count: filteredConcepts.length })}
            </p>
          </div>
          {filteredConcepts.map((concept) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              dealId={dealId}
              onFavorite={handleFavorite}
              onGenerateVariations={handleGenerateVariations}
              onUpdateConcept={handleUpdateConcept}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
