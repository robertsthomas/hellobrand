import { AlertTriangle, ShieldAlert } from "lucide-react";

import type { ConflictResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ConflictWarnings({
  conflicts,
  title = "Conflict warnings",
  description,
  compact = false
}: {
  conflicts: ConflictResult[];
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.5rem] border border-amber-500/20 bg-amber-50/70 p-5 dark:border-amber-300/15 dark:bg-amber-300/[0.06]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-500/10 p-2 text-amber-700 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          {description ? (
            <p className="mt-1 text-sm text-black/60 dark:text-white/65">{description}</p>
          ) : null}

          <div className={cn("mt-4 grid gap-3", compact && "gap-2")}>
            {conflicts.slice(0, compact ? 3 : 6).map((conflict) => (
              <div
                key={`${conflict.type}-${conflict.title}-${conflict.relatedDealIds.join("-")}`}
                className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-200" />
                      <span className="text-sm font-semibold text-ink">{conflict.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/65">
                      {conflict.detail}
                    </p>
                    {conflict.evidenceRefs.length > 0 ? (
                      <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                        {conflict.evidenceRefs.slice(0, 2).join(" • ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-amber-700/80 dark:text-amber-200/80">
                    {conflict.level === "hard_conflict" ? "High risk" : "Review"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
