"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { IntakeSourceSwitcher } from "@/components/intake-source-switcher";
import { SubmitButton } from "@/components/submit-button";
import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";

export function IntakeDraftEditor({
  autoOpenPicker,
  initialMode,
  initialDraft
}: {
  autoOpenPicker: boolean;
  initialMode: "upload" | "paste";
  initialDraft:
    | {
        sessionId: string | null;
        mode: "upload" | "paste";
        brandName: string;
        campaignName: string;
        notes: string;
        pastedText: string;
      }
    | null;
}) {
  const router = useRouter();
  const sessionId = useIntakeUiStore((state) => state.sessionId);
  const mode = useIntakeUiStore((state) => state.mode);
  const brandName = useIntakeUiStore((state) => state.brandName);
  const campaignName = useIntakeUiStore((state) => state.campaignName);
  const notes = useIntakeUiStore((state) => state.notes);
  const pastedText = useIntakeUiStore((state) => state.pastedText);
  const pendingFiles = useIntakeUiStore((state) => state.pendingFiles);
  const isSubmitting = useIntakeUiStore((state) => state.isSubmitting);
  const errorMessage = useIntakeUiStore((state) => state.errorMessage);
  const hydrateDraft = useIntakeUiStore((state) => state.hydrateDraft);
  const setSessionId = useIntakeUiStore((state) => state.setSessionId);
  const setBrandName = useIntakeUiStore((state) => state.setBrandName);
  const setCampaignName = useIntakeUiStore((state) => state.setCampaignName);
  const setNotes = useIntakeUiStore((state) => state.setNotes);
  const setIsSubmitting = useIntakeUiStore((state) => state.setIsSubmitting);
  const setErrorMessage = useIntakeUiStore((state) => state.setErrorMessage);
  const lastSavedRef = useRef("");
  const createStartedRef = useRef(false);
  const autoContinueStartedRef = useRef(false);

  useEffect(() => {
    if (initialDraft) {
      hydrateDraft(initialDraft);
      return;
    }

    hydrateDraft({
      sessionId: null,
      mode: autoOpenPicker ? "upload" : initialMode,
      brandName: "",
      campaignName: "",
      notes: "",
      pastedText: ""
    });
  }, [autoOpenPicker, hydrateDraft, initialDraft, initialMode]);

  useEffect(() => {
    if (initialDraft?.sessionId || sessionId || createStartedRef.current) {
      return;
    }

    createStartedRef.current = true;

    async function createDraft() {
      try {
        const response = await fetch("/api/intake/draft", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({})
        });
        const payload = await response.json();

        if (!response.ok || !payload.session?.id) {
          throw new Error(payload.error ?? "Could not create draft.");
        }

        setSessionId(payload.session.id);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not create draft."
        );
      }
    }

    void createDraft();
  }, [initialDraft?.sessionId, sessionId, setErrorMessage, setSessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const payload = JSON.stringify({
      brandName,
      campaignName,
      notes,
      pastedText,
      inputSource: mode
    });

    if (payload === lastSavedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetch(`/api/intake/${sessionId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: payload
      }).then(() => {
        lastSavedRef.current = payload;
      });
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [brandName, campaignName, mode, notes, pastedText, sessionId]);

  useEffect(() => {
    if (mode !== "upload") {
      autoContinueStartedRef.current = false;
      return;
    }

    if (pendingFiles.length === 0) {
      autoContinueStartedRef.current = false;
      return;
    }

    if (!sessionId || isSubmitting || autoContinueStartedRef.current) {
      return;
    }

    autoContinueStartedRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    router.push(`/app/intake/${sessionId}`);
    router.refresh();
  }, [
    isSubmitting,
    mode,
    pendingFiles.length,
    router,
    sessionId,
    setErrorMessage,
    setIsSubmitting
  ]);

  async function handleContinue() {
    if (!sessionId) {
      setErrorMessage("Draft session is still being created.");
      return;
    }

    if (pendingFiles.length === 0 && !pastedText.trim()) {
      setErrorMessage("Upload a file or paste text before continuing.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    router.push(`/app/intake/${sessionId}`);
    router.refresh();
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="border-t border-black/10 pt-8 dark:border-white/10">
        <div className="grid gap-8">
          <IntakeSourceSwitcher
            autoOpenPicker={autoOpenPicker}
            initialMode={initialMode}
          />

          <section className="grid gap-5 border-t border-black/8 pt-8 dark:border-white/8">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-ink">Optional context</h2>
              <p className="text-sm text-black/55 dark:text-white/60">
                Draft values save automatically while you work.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                Brand name
                <input
                  className="rounded-xl border border-black/10 bg-white px-4 py-3 text-base dark:border-white/12 dark:bg-white/[0.04]"
                  value={brandName}
                  onChange={(event) => setBrandName(event.currentTarget.value)}
                  placeholder="Glossier"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                Campaign name
                <input
                  className="rounded-xl border border-black/10 bg-white px-4 py-3 text-base dark:border-white/12 dark:bg-white/[0.04]"
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.currentTarget.value)}
                  placeholder="Spring recovery drop"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Notes
              <textarea
                className="min-h-28 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/12 dark:bg-white/[0.04]"
                value={notes}
                onChange={(event) => setNotes(event.currentTarget.value)}
                placeholder="Anything you already know about rate, deliverables, or open questions."
              />
            </label>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/8 pt-8 dark:border-white/8">
            <div className="max-w-2xl text-sm leading-6 text-black/55 dark:text-white/60">
              <p>
                Drafts save in progress. Selecting files opens the live analysis
                screen immediately. Paste mode stays manual so you can finish the
                text first.
              </p>
              {sessionId ? (
                <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                  Draft saved.
                </p>
              ) : null}
            </div>
            <SubmitButton
              type="button"
              pendingLabel="Opening intake..."
              onClick={() => void handleContinue()}
              className="rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              Continue to analysis
            </SubmitButton>
          </div>

          {errorMessage ? (
            <p className="text-sm text-clay">{errorMessage}</p>
          ) : null}
        </div>
      </div>

      <aside className="xl:pt-8">
        <div className="rounded-2xl border border-black/6 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.04]">
          <h2 className="text-lg font-semibold text-ink">What happens next</h2>
          <ol className="mt-4 space-y-4 text-sm leading-6 text-black/60 dark:text-white/65">
            <li>
              <span className="font-medium text-ink">1.</span> Your intake draft
              saves as you prepare the source material.
            </li>
            <li>
              <span className="font-medium text-ink">2.</span> HelloBrand opens
              the intake review screen and begins extraction.
            </li>
            <li>
              <span className="font-medium text-ink">3.</span> You confirm the
              extracted deal details before the workspace goes live.
            </li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
