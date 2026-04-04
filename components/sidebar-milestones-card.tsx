import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import type { SidebarMilestones } from "@/lib/sidebar-milestones";
import { cn } from "@/lib/utils";

export function SidebarMilestonesCard({
  milestones,
  onNavigate
}: {
  milestones: SidebarMilestones;
  onNavigate?: () => void;
}) {
  if (!milestones.visible) {
    return null;
  }

  const nextIncompleteId = milestones.items.find((item) => !item.complete)?.id ?? null;

  return (
    <section
      aria-label="Getting started checklist"
      className="mt-6 border border-border bg-secondary/20 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="border-b border-border px-4 py-3 dark:border-white/10">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Getting started
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {milestones.completedCount} of {milestones.totalCount} complete
        </p>
      </div>

      <div className="p-2">
        {milestones.items.map((item) => {
          const isNextIncomplete = item.id === nextIncompleteId;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex min-h-10 items-center gap-3 px-2 py-2 text-[13px] transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
                item.complete
                  ? "text-muted-foreground hover:bg-secondary/35 hover:text-foreground"
                  : "text-foreground hover:bg-secondary/35",
                isNextIncomplete ? "font-medium" : "font-normal"
              )}
            >
              {item.complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              )}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
