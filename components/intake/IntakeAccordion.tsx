"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function IntakeAccordion({
  title,
  badge,
  defaultOpen = false,
  children
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-black/8 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-black/40 transition-transform dark:text-white/40",
              open && "rotate-90"
            )}
          />
          <span className="text-sm font-medium text-ink">{title}</span>
          {badge ? (
            <span className="bg-sand/80 px-2 py-0.5 text-[11px] font-medium text-black/50 dark:bg-white/[0.06] dark:text-white/50">
              {badge}
            </span>
          ) : null}
        </div>
      </button>
      {open ? <div className="border-t border-black/8 px-4 py-4 dark:border-white/10">{children}</div> : null}
    </div>
  );
}
