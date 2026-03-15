"use client";

import { useEffect } from "react";

import { IntakeFileField } from "@/components/intake-file-field";
import { IntakePasteFields } from "@/components/intake-paste-fields";
import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";
import { cn } from "@/lib/utils";

export function IntakeSourceSwitcher({
  autoOpenPicker = false,
  initialMode = "upload"
}: {
  autoOpenPicker?: boolean;
  initialMode?: "upload" | "paste";
}) {
  const mode = useIntakeUiStore((state) => state.mode);
  const setMode = useIntakeUiStore((state) => state.setMode);

  useEffect(() => {
    setMode(autoOpenPicker ? "upload" : initialMode);
  }, [autoOpenPicker, initialMode, setMode]);

  return (
    <section className="grid gap-5 border-t border-black/8 pt-8 dark:border-white/8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">Documents</h2>
          <p className="text-sm text-black/55 dark:text-white/60">
            Add the contract first. You can also include briefs, decks, invoices,
            or copied email context. After upload, HelloBrand opens the analysis
            screen and starts filling in the deal data.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              mode === "upload"
                ? "bg-ocean text-white"
                : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            )}
          >
            Upload files
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              mode === "paste"
                ? "bg-ocean text-white"
                : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            )}
          >
            Paste text
          </button>
        </div>
      </div>

      <div className={cn(mode === "upload" ? "block" : "hidden")}>
        <IntakeFileField autoOpenPicker={autoOpenPicker} />
      </div>

      <div className={cn(mode === "paste" ? "grid gap-5" : "hidden")}>
        <IntakePasteFields />
        <p className="text-xs text-black/45 dark:text-white/45">
          Paste anything from the brand and HelloBrand will organize the
          contract language, email context, and notes for you.
        </p>
      </div>

      <div
        className={cn(
          "rounded-xl border border-black/6 bg-white/60 px-4 py-3 text-sm text-black/55 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/60",
          mode === "upload" ? "block" : "hidden"
        )}
      >
        Need to paste copied terms or an email thread too? Switch to{" "}
        <button
          type="button"
          onClick={() => setMode("paste")}
          className="font-semibold text-ocean underline-offset-4 hover:underline"
        >
          Paste text
        </button>
        .
      </div>
    </section>
  );
}
