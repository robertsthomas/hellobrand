"use client";

import { Hand, ChevronDown, Loader2, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SummarizerAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

type SummarizerCreateOptions = {
  sharedContext?: string;
  type?: "key-points" | "tldr" | "teaser" | "headline";
  format?: "markdown" | "plain-text";
  length?: "short" | "medium" | "long";
  monitor?: (monitor: EventTarget) => void;
};

type SummarizerSession = {
  summarize: (input: string) => Promise<string>;
  destroy?: () => void;
};

type SummarizerStatic = {
  availability: () => Promise<SummarizerAvailability>;
  create: (options?: SummarizerCreateOptions) => Promise<SummarizerSession>;
};

type BlogSummarizeButtonProps = {
  cacheKey: string;
  title: string;
  description: string;
  articleText: string;
};

// fallow-ignore-next-line complexity
export function BlogSummarizeButton({
  cacheKey,
  title,
  description,
  articleText
}: BlogSummarizeButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "downloading" | "summarizing" | "ready" | "error"
  >("idle");
  const [summary, setSummary] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);
  const summarizerRef = useRef<SummarizerSession | null>(null);
  const warmupPromiseRef = useRef<Promise<SummarizerSession | null> | null>(null);
  const storageKey = `hb-blog-summary:${cacheKey}`;

  function getChromeSummarizer() {
    return (window as Window & { Summarizer?: SummarizerStatic }).Summarizer;
  }

  async function ensureSession({ silent = false }: { silent?: boolean } = {}) {
    if (summarizerRef.current) {
      return summarizerRef.current;
    }

    if (warmupPromiseRef.current) {
      return warmupPromiseRef.current;
    }

    const chromeAi = getChromeSummarizer();

    if (!chromeAi) {
      if (!silent) {
        setStatus("error");
        setMessage(
          "Chrome AI summarization is only available in supported desktop versions of Chrome."
        );
      }
      return null;
    }

    warmupPromiseRef.current = (async () => {
      try {
        const availability = await chromeAi.availability();

        if (availability === "unavailable") {
          if (!silent) {
            setStatus("error");
            setMessage(
              "This device or browser setup does not currently support Chrome's built-in summarizer."
            );
          }
          return null;
        }

        const session = await chromeAi.create({
          sharedContext:
            "Summarize this HelloBrand article for creators reviewing a brand contract. Focus on risks, leverage points, and the most actionable next steps. Keep the tone calm, direct, and useful.",
          type: "key-points",
          format: "plain-text",
          length: "short",
          monitor(monitor) {
            if (!silent) {
              monitor.addEventListener("downloadprogress", () => {
                setStatus("downloading");
                setMessage("Downloading Chrome's local AI model for this summary.");
              });
            }
          }
        });

        summarizerRef.current = session;
        if (!silent) {
          setStatus("idle");
          setMessage("");
        }
        return session;
      } catch (error) {
        if (!silent) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Chrome AI could not generate a summary right now."
          );
        }
        return null;
      } finally {
        warmupPromiseRef.current = null;
      }
    })();

    return warmupPromiseRef.current;
  }

  useEffect(() => {
    try {
      const cachedSummary = window.sessionStorage.getItem(storageKey);
      if (cachedSummary) {
        setSummary(cachedSummary);
        setStatus("ready");
        setMessage("Loaded from preview cache.");
        setOpen(false);
      }
    } catch {
      // Ignore storage access issues.
    }
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    let detachWarmupListeners: (() => void) | undefined;

    async function primeIfPossible() {
      const chromeAi = getChromeSummarizer();
      if (!chromeAi) return;

      const availability = await chromeAi.availability();
      if (cancelled) return;

      if (availability === "available") {
        void ensureSession({ silent: true });
        return;
      }

      if (availability === "downloadable" || availability === "downloading") {
        const warmupOnInteraction = () => {
          void ensureSession({ silent: true });
          detachWarmupListeners?.();
          detachWarmupListeners = undefined;
        };

        window.addEventListener("pointerdown", warmupOnInteraction, { once: true });
        window.addEventListener("keydown", warmupOnInteraction, { once: true });
        window.addEventListener("touchstart", warmupOnInteraction, { once: true });

        detachWarmupListeners = () => {
          window.removeEventListener("pointerdown", warmupOnInteraction);
          window.removeEventListener("keydown", warmupOnInteraction);
          window.removeEventListener("touchstart", warmupOnInteraction);
        };
      }
    }

    void primeIfPossible();

    return () => {
      cancelled = true;
      detachWarmupListeners?.();
      summarizerRef.current?.destroy?.();
      summarizerRef.current = null;
    };
  }, []);

  async function generateSummary() {
    setStatus("checking");
    setOpen(true);
    setMessage("");
    setSummary("");

    try {
      const summarizer = await ensureSession();
      if (!summarizer) {
        return;
      }

      setStatus("summarizing");
      const output = await summarizer.summarize(
        `${title}\n\n${description}\n\n${articleText}`
      );

      setSummary(output.trim());
      setStatus("ready");
      setMessage("Generated locally with Chrome AI.");
      try {
        window.sessionStorage.setItem(storageKey, output.trim());
      } catch {
        // Ignore storage access issues.
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Chrome AI could not generate a summary right now."
      );
    }
  }

  const hasSummary = summary.trim().length > 0;

  function handleSummarize() {
    if (hasSummary) {
      setOpen((current) => !current);
      return;
    }

    void generateSummary();
  }

  async function handleRegenerate(event?: React.MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore storage access issues.
    }

    await generateSummary();
  }

  const isBusy =
    status === "checking" || status === "downloading" || status === "summarizing";

  return (
    <div className="relative w-full md:ml-auto md:w-auto md:self-start">
      <button
        type="button"
        onClick={handleSummarize}
        disabled={isBusy}
        className="group inline-flex items-center gap-2 rounded-full border border-[#d9dddf] bg-[#f7f8f8] px-3.5 py-2 text-[12px] font-semibold text-[#243243] transition hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary disabled:cursor-wait disabled:opacity-70 dark:border-[#27303a] dark:bg-[#13181d] dark:text-[#cfd8e3] dark:hover:border-[#8ec6b1]/30 dark:hover:bg-[#8ec6b1]/10 dark:hover:text-[#8ec6b1]"
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Hand className="hello-hand-wave h-3.5 w-3.5 rotate-[18deg]" strokeWidth={2.15} />
        )}
        <span>{hasSummary ? "Toggle summary" : "Summarize"}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-4 rounded-2xl border border-[#e4e7ea] bg-[#fafbfb] p-4 md:absolute md:right-0 md:top-full md:z-20 md:mt-3 md:w-[30rem] dark:border-[#232a33] dark:bg-[#101418]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a838f] dark:text-[#8d98a7]">
              <span>AI Preview</span>
              {message ? <span className="tracking-normal normal-case">{message}</span> : null}
            </div>
            {hasSummary ? (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isBusy}
                aria-label="Regenerate summary"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d9dddf] text-[#6c7582] transition hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary disabled:cursor-wait disabled:opacity-70 dark:border-[#27303a] dark:text-[#94a0b0] dark:hover:border-[#8ec6b1]/30 dark:hover:bg-[#8ec6b1]/10 dark:hover:text-[#8ec6b1]"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
              </button>
            ) : null}
          </div>

          {hasSummary ? (
            <ul className="mt-3 space-y-2 text-[0.95rem] leading-[1.7] text-[#424b57] dark:text-[#c6cfdb]">
              {summary
                .split("\n")
                .map((line) => line.replace(/^[-*•]\s*/, "").trim())
                .filter(Boolean)
                .map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60 dark:bg-[#8ec6b1]/60" />
                    <span>{line}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-3 text-[0.92rem] leading-[1.7] text-[#5b6471] dark:text-[#9eabbc]">
              {isBusy
                ? "Preparing the summary preview."
                : message ||
                  "Click the button above to generate a concise article preview on supported Chrome browsers."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
