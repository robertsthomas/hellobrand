"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";

import { InfoTooltip } from "@/components/app-tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface QuickActionItem {
  tone: "accent" | "warning" | "success";
  title: string;
  body: string;
  href: string;
}

function QuickActionRow({ item }: { item: QuickActionItem }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "block border-b border-black/8 py-5 transition-colors hover:bg-[#f6f7f8] dark:border-white/10 dark:hover:bg-white/[0.03]",
        item.tone === "accent" && "border-l-2 border-l-accent",
        item.tone === "warning" && "border-l-2 border-l-orange-300",
        item.tone === "success" && "border-l-2 border-l-emerald-300"
      )}
    >
      <div className="flex items-start justify-between gap-4 px-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-sm",
              item.tone === "accent" && "text-accent",
              item.tone === "warning" && "text-orange-700",
              item.tone === "success" && "text-emerald-700"
            )}
          >
            {item.tone === "success" ? (
              <CheckCircle2 className="h-4.5 w-4.5" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5" />
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </div>
        </div>
        <div className="shrink-0 pt-1 text-foreground">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

export function QuickActionsPanel({ items }: { items: QuickActionItem[] }) {
  const [open, setOpen] = useState(false);
  const visibleItems = items.slice(0, 2);
  const hiddenItems = items.slice(2);

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
          Quick review
        </h2>
        <InfoTooltip
          label="About quick review"
          content="Highest-priority items that still need attention before work continues."
        />
      </div>

      <div className="mt-4 border-t border-black/8 dark:border-white/10">
        {visibleItems.map((item) => (
          <QuickActionRow key={item.title} item={item} />
        ))}

        {items.length === 0 ? (
          <div className="px-1 py-6 text-sm text-muted-foreground">
            Nothing urgent right now.
          </div>
        ) : null}
      </div>

      {hiddenItems.length > 0 ? (
        <>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              View {hiddenItems.length} more
            </button>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="max-w-2xl border-black/10 p-0 dark:border-white/10">
              <DialogHeader className="border-b border-black/8 px-6 py-5 dark:border-white/10">
                <DialogTitle>Quick review</DialogTitle>
                <DialogDescription>
                  Remaining actions that still need attention.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-auto px-6 pb-6">
                <div className="border-t border-black/8 dark:border-white/10">
                  {hiddenItems.map((item) => (
                    <QuickActionRow key={item.title} item={item} />
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </section>
  );
}
