"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, LoaderCircle, ShieldAlert } from "lucide-react";

import {
  applyPendingChangesAction,
  dismissPendingChangesAction
} from "@/app/actions";
import { dealCategoryLabel, normalizeDealCategory } from "@/lib/conflict-categories";
import type { PendingChangesSummary, TermsDiffEntry } from "@/lib/types";
import { cn, humanizeToken, sanitizePlainTextInput } from "@/lib/utils";

type ChangePriority = "critical" | "standard";

const FIELD_METADATA: Record<
  string,
  {
    label: string;
    priority?: ChangePriority;
  }
> = {
  brandName: { label: "Brand name", priority: "standard" },
  campaignName: { label: "Campaign name", priority: "standard" },
  brandCategory: { label: "Brand category", priority: "standard" },
  campaignDateWindow: { label: "Campaign date window", priority: "standard" },
  deliverables: { label: "Deliverables", priority: "critical" },
  usageChannels: { label: "Usage channels", priority: "critical" },
  restrictedCategories: { label: "Restricted categories", priority: "critical" },
  disclosureObligations: { label: "Disclosure obligations", priority: "critical" },
  paymentAmount: { label: "Payment amount", priority: "critical" },
  paymentCurrency: { label: "Payment currency", priority: "critical" },
  paymentTerms: { label: "Payment terms", priority: "critical" },
  netTermsDays: { label: "Net terms", priority: "critical" },
  exclusivityTerms: { label: "Exclusivity", priority: "critical" },
  exclusivityApplies: { label: "Exclusivity", priority: "critical" },
  usageRightsTerms: { label: "Usage rights", priority: "critical" },
  usageRightsOrganicAllowed: { label: "Organic usage rights", priority: "critical" },
  usageRightsPaidAllowed: { label: "Paid usage rights", priority: "critical" },
  whitelistingAllowed: { label: "Whitelisting", priority: "critical" },
  notes: { label: "Notes", priority: "standard" },
  timelineSummary: { label: "Timeline", priority: "standard" },
  postingWindowStart: { label: "Posting window start", priority: "standard" },
  postingWindowEnd: { label: "Posting window end", priority: "standard" }
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatCategoryValue(value: unknown) {
  if (typeof value !== "string") {
    return "Not set";
  }

  return dealCategoryLabel(normalizeDealCategory(value)) ?? humanizeToken(value) ?? "Not set";
}

function formatCampaignDateWindowValue(
  value: unknown,
  expanded: boolean
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (typeof value === "string") {
      return sanitizePlainTextInput(value).trim() || "Not set";
    }
    return value === null || value === undefined ? "Not set" : String(value);
  }

  const window = value as {
    startDate?: string | null;
    endDate?: string | null;
    postingWindow?: string | null;
  };

  const postingWindow = sanitizePlainTextInput(window.postingWindow);
  const startDate = formatDateLabel(window.startDate);
  const endDate = formatDateLabel(window.endDate);

  if (!expanded) {
    return (
      postingWindow ||
      (startDate && endDate ? `${startDate} to ${endDate}` : startDate || endDate || "Not set")
    );
  }

  const lines = [
    postingWindow ? `Posting window: ${postingWindow}` : null,
    startDate ? `Start date: ${startDate}` : null,
    endDate ? `End date: ${endDate}` : null
  ].filter((entry): entry is string => Boolean(entry));

  return lines.join("\n") || "Not set";
}

function formatDeliverableLine(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return sanitizePlainTextInput(String(value));
  }

  const item = value as {
    title?: string | null;
    channel?: string | null;
    quantity?: number | null;
    dueDate?: string | null;
    description?: string | null;
  };

  const parts = [
    sanitizePlainTextInput(item.title),
    typeof item.quantity === "number" ? `Qty ${item.quantity}` : null,
    item.channel ? sanitizePlainTextInput(item.channel) : null,
    item.dueDate ? `Due ${formatDateLabel(item.dueDate) ?? item.dueDate}` : null,
    item.description ? sanitizePlainTextInput(item.description) : null
  ].filter((entry): entry is string => Boolean(entry));

  return parts.join(" | ");
}

function formatArrayValue(value: unknown, expanded: boolean) {
  if (!Array.isArray(value)) {
    return "Not set";
  }

  if (value.length === 0) {
    return "None";
  }

  if (!expanded) {
    if (typeof value[0] === "string") {
      return value.map((entry) => sanitizePlainTextInput(String(entry))).join(", ");
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value[0] === "string") {
    return value.map((entry) => sanitizePlainTextInput(String(entry))).join("\n");
  }

  return value
    .map((entry, index) => `${index + 1}. ${formatDeliverableLine(entry)}`)
    .join("\n");
}

function formatObjectValue(value: unknown, expanded: boolean) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Not set";
  }

  const entries = Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined);
  if (entries.length === 0) {
    return "Not set";
  }

  if (!expanded) {
    return `${entries.length} field${entries.length === 1 ? "" : "s"}`;
  }

  return entries
    .map(([key, entry]) => {
      const rendered =
        typeof entry === "string" ? sanitizePlainTextInput(entry) : JSON.stringify(entry);
      return `${humanizeToken(key)}: ${rendered}`;
    })
    .join("\n");
}

function formatValueForDisplay(
  entry: Pick<TermsDiffEntry, "field">,
  value: unknown,
  expanded = false
): string {
  if (entry.field === "brandCategory") {
    return formatCategoryValue(value);
  }

  if (entry.field === "campaignDateWindow") {
    return formatCampaignDateWindowValue(value, expanded);
  }

  if (value === null || value === undefined) return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Math.abs(value) >= 1000 ? formatCurrency(value) : String(value);
  }
  if (typeof value === "string") return sanitizePlainTextInput(value).trim() || "Not set";
  if (Array.isArray(value)) return formatArrayValue(value, expanded);
  if (typeof value === "object") return formatObjectValue(value, expanded);
  return String(value);
}

function previewText(value: string, maxLength = 96) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function shouldAllowExpansion(entry: TermsDiffEntry) {
  const current = formatValueForDisplay(entry, entry.currentValue, true);
  const proposed = formatValueForDisplay(entry, entry.proposedValue, true);

  return (
    current.length > 80 ||
    proposed.length > 120 ||
    entry.fieldType === "json_array" ||
    (typeof entry.currentValue === "object" && entry.currentValue !== null) ||
    (typeof entry.proposedValue === "object" && entry.proposedValue !== null)
  );
}

function displayLabel(entry: TermsDiffEntry) {
  return FIELD_METADATA[entry.field]?.label ?? entry.label;
}

function displayPriority(entry: TermsDiffEntry): ChangePriority {
  return FIELD_METADATA[entry.field]?.priority ?? "standard";
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
  const [expanded, setExpanded] = useState(false);
  const current = formatValueForDisplay(entry, entry.currentValue, expanded);
  const proposed = formatValueForDisplay(entry, entry.proposedValue, expanded);
  const priority = displayPriority(entry);
  const canExpand = shouldAllowExpansion(entry);

  return (
    <div
      className={cn(
        "border-t border-black/6 first:border-t-0 dark:border-white/10",
        checked ? "bg-emerald-50/40 dark:bg-emerald-500/[0.05]" : "bg-transparent"
      )}
    >
      <div className="flex items-start gap-4 px-4 py-4 sm:px-5">
        <input
          id={`field-${entry.field}`}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => onToggle(entry.field)}
          className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor={`field-${entry.field}`}
                  className="cursor-pointer text-sm font-semibold text-foreground"
                >
                  {displayLabel(entry)}
                </label>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    priority === "critical"
                      ? "bg-[#f2e6df] text-[#9d5738] dark:bg-[#9d5738]/15 dark:text-[#f3b392]"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {priority === "critical" ? "Critical" : "Standard"}
                </span>
                {entry.isManuallyEdited ? (
                  <span className="inline-flex items-center bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    Manually edited
                  </span>
                ) : null}
              </div>
            </div>

            <span
              className={cn(
                "shrink-0 text-xs font-medium",
                checked ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
              )}
            >
              {checked ? "Selected" : "Keeping current"}
            </span>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Current
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-black/45 line-through dark:text-white/45">
                {expanded ? current : previewText(current, 120)}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Suggested
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-emerald-700 dark:text-emerald-400">
                {expanded ? proposed : previewText(proposed, 180)}
              </p>
            </div>
          </div>

          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/75 transition hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide full change
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  View full change
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
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

  const selectedCount = checkedFields.size;
  const criticalCount = useMemo(
    () => diff.entries.filter((entry) => displayPriority(entry) === "critical").length,
    [diff.entries]
  );

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

  const selectAll = useCallback(() => {
    setCheckedFields(new Set(diff.entries.map((entry) => entry.field)));
  }, [diff.entries]);

  const clearSelection = useCallback(() => {
    setCheckedFields(new Set());
  }, []);

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
    <section className="border border-black/8 bg-white px-5 py-5 dark:border-white/10 dark:bg-white/[0.03] sm:px-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-[#c46a45] dark:text-[#f0b18a]">
          <ShieldAlert className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                {diff.totalChangedFields} change
                {diff.totalChangedFields === 1 ? "" : "s"} ready to review
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                A newly processed document suggested updates to this workspace. Review the important changes first, then choose which ones to apply.
                {diff.manuallyEditedConflicts > 0
                  ? ` ${diff.manuallyEditedConflicts} manually edited field${diff.manuallyEditedConflicts === 1 ? " is" : "s are"} keeping your current value by default.`
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center border border-black/8 bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-foreground dark:border-white/10">
                {selectedCount} selected
              </span>
              <span className="inline-flex items-center border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
                {criticalCount} critical
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-y border-black/6 py-4 dark:border-white/10 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Detected
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">{diff.totalChangedFields}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Selected to apply
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">{selectedCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Manually protected
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {diff.manuallyEditedConflicts}
              </p>
            </div>
          </div>

          <div className="mt-2">
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
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-black/55 dark:text-white/60">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {pendingAction === "apply"
                ? `Applying ${selectedCount} selected change${selectedCount === 1 ? "" : "s"}...`
                : "Dismissing detected changes..."}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting || selectedCount === 0}
              className="inline-flex min-h-[44px] items-center gap-2 bg-[#255441] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f4838] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "apply" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                `Apply ${selectedCount} selected`
              )}
            </button>

            <button
              type="button"
              onClick={selectAll}
              disabled={isSubmitting || selectedCount === diff.totalChangedFields}
              className="min-h-[44px] border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select all
            </button>

            <button
              type="button"
              onClick={clearSelection}
              disabled={isSubmitting || selectedCount === 0}
              className="min-h-[44px] border border-black/10 bg-white px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-black/20 hover:text-foreground dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear selection
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center gap-2 px-2 py-2 text-sm font-medium text-black/45 transition hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/45 dark:hover:text-white/70"
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
