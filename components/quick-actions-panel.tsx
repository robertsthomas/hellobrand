import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleDot } from "lucide-react";

import { cn } from "@/lib/utils";

export interface QuickActionItem {
  tone: "accent" | "warning" | "success" | "neutral";
  title: string;
  body: string;
  href: string;
  ctaLabel?: string;
}

function toneClasses(tone: QuickActionItem["tone"]) {
  if (tone === "warning") {
    return {
      card: "border-orange-200/80 bg-orange-50/70 dark:border-orange-500/20 dark:bg-orange-500/10",
      icon: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
      label: "text-orange-700 dark:text-orange-300",
    };
  }

  if (tone === "success") {
    return {
      card: "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      label: "text-emerald-700 dark:text-emerald-300",
    };
  }

  if (tone === "accent") {
    return {
      card: "border-[#d7e7df] bg-[#f3f8f5] dark:border-[#294137] dark:bg-[#12201a]",
      icon: "bg-[#dceae3] text-[#234b3c] dark:bg-[#1a3128] dark:text-[#9fd7bf]",
      label: "text-[#2c5b49] dark:text-[#9fd7bf]",
    };
  }

  return {
    card: "border-black/8 bg-secondary dark:border-white/10 dark:bg-white/[0.03]",
    icon: "bg-white text-muted-foreground dark:bg-white/[0.06] dark:text-muted-foreground",
    label: "text-muted-foreground dark:text-muted-foreground",
  };
}

function toneEyebrow(tone: QuickActionItem["tone"]) {
  if (tone === "warning") {
    return "Time-sensitive";
  }

  if (tone === "success") {
    return "On track";
  }

  if (tone === "accent") {
    return "Coming up";
  }

  return "Recommended";
}

function QuickActionRow({ item }: { item: QuickActionItem }) {
  const tone = toneClasses(item.tone);

  return (
    <Link
      href={item.href}
      className={cn(
        "group block border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:hover:shadow-none",
        tone.card
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center", tone.icon)}
          >
            {item.tone === "warning" ? (
              <AlertTriangle className="h-4.5 w-4.5" />
            ) : item.tone === "success" ? (
              <CheckCircle2 className="h-4.5 w-4.5" />
            ) : (
              <CircleDot className="h-4.5 w-4.5" />
            )}
          </div>

          <div className="min-w-0">
            <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", tone.label)}>
              {toneEyebrow(item.tone)}
            </p>
            <p className="mt-2 text-base font-semibold tracking-[-0.03em] text-foreground">
              {item.title}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </div>
        </div>

        <div className="shrink-0 pt-1 text-foreground/50 transition group-hover:text-foreground">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 text-sm font-medium text-foreground">{item.ctaLabel ?? "Open"}</div>
    </Link>
  );
}

export function QuickActionsPanel({ items }: { items: QuickActionItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border border-black/8 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#15191f] dark:shadow-none sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:text-muted-foreground">
          Next up
        </p>
        <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-foreground">
          What to work on next
        </h2>
        <p className="mt-2 max-w-[48ch] text-sm leading-6 text-muted-foreground">
          Start with the items most likely to unblock cash flow, approvals, or delivery.
        </p>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <QuickActionRow key={`${item.title}:${item.href}`} item={item} />
        ))}
      </div>
    </section>
  );
}
