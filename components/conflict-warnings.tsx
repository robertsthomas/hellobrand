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
    <section className="border border-amber-500/18 bg-amber-50/28 px-5 py-4 dark:border-amber-300/12 dark:bg-amber-300/[0.03]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-amber-700 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          {description ? (
            <p className="mt-1 text-sm text-black/60 dark:text-white/65">{description}</p>
          ) : null}

          <div className={cn("mt-4 grid gap-0", compact && "gap-0")}>
            {conflicts.slice(0, compact ? 3 : 6).map((conflict) => (
              <div
                key={`${conflict.type}-${conflict.title}-${conflict.relatedDealIds.join("-")}`}
                className="border-t border-black/6 px-0 py-3 first:border-t-0 dark:border-white/10"
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
