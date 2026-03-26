"use client";

import { useCallback, useState } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";

import {
  applyPendingChangesAction,
  dismissPendingChangesAction
} from "@/app/actions";
import type { PendingChangesSummary, TermsDiffEntry } from "@/lib/types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value || "Not set";
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    if (typeof value[0] === "string") return value.join(", ");
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DiffRow({
  entry,
  checked,
  disabled,
  onToggle
}: {
  entry: TermsDiffEntry;
  checked: boolean;
  disabled: boolean;
  onToggle: (field: string) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 border-t border-black/6 px-0 py-3 first:border-t-0 dark:border-white/10"
      htmlFor={`field-${entry.field}`}
    >
      <input
        id={`field-${entry.field}`}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(entry.field)}
        className="mt-1 h-4 w-4 accent-emerald-600"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{entry.label}</span>
          {entry.isManuallyEdited ? (
            <span className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              Manually edited
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:gap-2">
          <span className="text-black/45 line-through dark:text-white/45">
            {formatValue(entry.currentValue)}
          </span>
          <span className="hidden text-black/30 sm:inline dark:text-white/30">
            &rarr;
          </span>
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            {formatValue(entry.proposedValue)}
          </span>
        </div>
      </div>
    </label>
  );
}

export function PendingChangesPanel({
  dealId,
  diff
}: {
  dealId: string;
  diff: PendingChangesSummary;
}) {
  const [checkedFields, setCheckedFields] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const entry of diff.entries) {
      if (!entry.isManuallyEdited) {
        initial.add(entry.field);
      }
    }
    return initial;
  });
  const [pendingAction, setPendingAction] = useState<"apply" | "dismiss" | null>(null);

  const onToggle = useCallback((field: string) => {
    setCheckedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  const acceptAll = useCallback(() => {
    setCheckedFields(new Set(diff.entries.map((e) => e.field)));
  }, [diff.entries]);

  const handleApply = useCallback(async () => {
    setPendingAction("apply");
    try {
      const formData = new FormData();
      formData.set("dealId", dealId);
      formData.set("acceptedFieldsJson", JSON.stringify([...checkedFields]));
      await applyPendingChangesAction(formData);
    } finally {
      setPendingAction(null);
    }
  }, [dealId, checkedFields]);

  const handleDismiss = useCallback(async () => {
    setPendingAction("dismiss");
    try {
      const formData = new FormData();
      formData.set("dealId", dealId);
      await dismissPendingChangesAction(formData);
    } finally {
      setPendingAction(null);
    }
  }, [dealId]);

  const isSubmitting = pendingAction !== null;

  return (
    <section className="border border-amber-500/18 bg-amber-50/28 px-5 py-4 dark:border-amber-300/12 dark:bg-amber-300/[0.03]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-amber-700 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">
            {diff.totalChangedFields} new change
            {diff.totalChangedFields === 1 ? "" : "s"} detected
          </div>
          <p className="mt-1 text-sm text-black/60 dark:text-white/65">
            A new document introduced changes to your partnership terms. Review each
            field below and choose which updates to accept.
            {diff.manuallyEditedConflicts > 0
              ? ` ${diff.manuallyEditedConflicts} field${diff.manuallyEditedConflicts === 1 ? "" : "s"} you previously edited manually ${diff.manuallyEditedConflicts === 1 ? "is" : "are"} unchecked by default.`
              : ""}
          </p>

          <div className="mt-4">
            {diff.entries.map((entry) => (
              <DiffRow
                key={entry.field}
                entry={entry}
                checked={checkedFields.has(entry.field)}
                disabled={isSubmitting}
                onToggle={onToggle}
              />
            ))}
          </div>

          {isSubmitting ? (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-black/55 dark:text-white/60">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {pendingAction === "apply"
                ? `Applying ${checkedFields.size} selected change${checkedFields.size === 1 ? "" : "s"}...`
                : "Dismissing detected changes..."}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting || checkedFields.size === 0}
              className="inline-flex min-h-[44px] items-center gap-2 border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "apply" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  Apply {checkedFields.size} change
                  {checkedFields.size === 1 ? "" : "s"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              disabled={isSubmitting}
              className="min-h-[44px] border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm font-medium text-black/45 transition hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/45 dark:hover:text-white/70"
            >
              {pendingAction === "dismiss" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Dismissing...
                </>
              ) : (
                "Dismiss all"
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
