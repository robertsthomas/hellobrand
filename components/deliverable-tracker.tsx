"use client";

import { useState, useCallback, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, LoaderCircle } from "lucide-react";

import { updateDeliverablesAction } from "@/app/actions";
import type { DeliverableItem } from "@/lib/types";
import {
  computeDeliverableProgress,
  isOverdue,
  DELIVERABLE_STATUSES,
  type DeliverableStatus
} from "@/lib/deliverables";
import { ProseText } from "@/components/prose-text";
import { formatDate, humanizeToken } from "@/lib/utils";

interface DeliverableTrackerProps {
  dealId: string;
  deliverables: DeliverableItem[];
}

const STATUS_CONFIG: Record<
  DeliverableStatus,
  { icon: typeof Circle; color: string; bg: string }
> = {
  pending: {
    icon: Circle,
    color: "text-black/45 dark:text-white/45",
    bg: "bg-black/5 dark:bg-white/5"
  },
  in_progress: {
    icon: Clock,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10"
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10"
  },
  overdue: {
    icon: AlertTriangle,
    color: "text-clay",
    bg: "bg-clay/5"
  }
};

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: DeliverableStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.color} ${config.bg}`}
    >
      <Icon className="h-3 w-3" />
      {humanizeToken(status)}
    </span>
  );
}

export function DeliverableTracker({ dealId, deliverables: initial }: DeliverableTrackerProps) {
  const [deliverables, setDeliverables] = useState(initial);
  const [pendingDeliverableId, setPendingDeliverableId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const progress = computeDeliverableProgress(deliverables);

  const updateStatus = useCallback(
    (id: string, newStatus: DeliverableStatus) => {
      const updated = deliverables.map((d) =>
        d.id === id ? { ...d, status: newStatus } : d
      );
      setDeliverables(updated);
      setPendingDeliverableId(id);

      startTransition(async () => {
        try {
          await updateDeliverablesAction(dealId, updated);
        } finally {
          setPendingDeliverableId(null);
        }
      });
    },
    [dealId, deliverables]
  );

  if (deliverables.length === 0) {
    return (
      <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Deliverable Tracker
        </h2>
        <p className="mt-4 text-sm text-black/60 dark:text-white/65">
          No deliverables have been extracted yet. Upload a contract or brief to
          get started.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Deliverable Tracker
          </h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/65">
            Track progress on your deliverables. Click a status to update it.
          </p>
          {isPending ? (
            <div className="mt-3 inline-flex items-center gap-2 text-sm text-black/55 dark:text-white/60">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Saving deliverable update...
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.completed} of {progress.total} complete
            </span>
            <span className="font-medium text-foreground">{progress.percentComplete}%</span>
          </div>
          <ProgressBar percent={progress.percentComplete} />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {progress.overdue > 0 && (
              <span className="text-clay">{progress.overdue} overdue</span>
            )}
            {progress.inProgress > 0 && (
              <span>{progress.inProgress} in progress</span>
            )}
            {progress.pending > 0 && (
              <span>{progress.pending} pending</span>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          {deliverables.map((item) => {
            const effectiveStatus: DeliverableStatus =
              item.status !== "completed" && isOverdue(item.dueDate)
                ? "overdue"
                : (item.status ?? "pending");

            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center gap-4 border border-black/8 p-4 transition-opacity dark:border-white/10 ${
                  pendingDeliverableId === item.id ? "opacity-70" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-black/80 dark:text-white/85">
                    {item.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {item.channel && <span>{item.channel}</span>}
                    {item.quantity && <span>Qty: {item.quantity}</span>}
                    {item.dueDate && (
                      <span className={effectiveStatus === "overdue" ? "font-medium text-clay" : ""}>
                        Due: {formatDate(item.dueDate)}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <div className="mt-2 line-clamp-3 text-sm text-black/50 dark:text-white/55">
                      <ProseText content={item.description} className="text-sm text-black/50 dark:text-white/55" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={effectiveStatus} />
                  <select
                    className="h-8 border border-black/10 bg-transparent px-2 text-xs text-foreground outline-none dark:border-white/10"
                    value={item.status ?? "pending"}
                    disabled={isPending}
                    onChange={(e) =>
                      updateStatus(item.id, e.target.value as DeliverableStatus)
                    }
                  >
                    {DELIVERABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {humanizeToken(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
