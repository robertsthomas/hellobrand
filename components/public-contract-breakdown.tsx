"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarRange } from "lucide-react";

import type { AnonymousDealBreakdown } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

function summarizeDeliverableLine(
  title: string,
  quantity: number | null,
  channel: string | null
) {
  const prefix =
    typeof quantity === "number" && quantity > 1 ? `${quantity} ${title}s` : title;
  return channel ? `${prefix} on ${channel}` : prefix;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-l-red-400 dark:border-l-red-500/60",
  medium: "border-l-amber-400 dark:border-l-amber-500/60",
  low: "border-l-slate-300 dark:border-l-slate-500/40"
};

export function PublicContractBreakdown({
  breakdown,
  eyebrow,
  title,
  description,
  actions,
  stickyAction
}: {
  breakdown: AnonymousDealBreakdown;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  stickyAction?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(timer);
  }, [breakdown]);

  const summaryText = useMemo(() => {
    return [
      breakdown.contractSummary,
      breakdown.deliverables.length > 0
        ? `Deliverables include ${breakdown.deliverables
            .slice(0, 2)
            .map((item) =>
              summarizeDeliverableLine(item.title, item.quantity, item.channel)
            )
            .join(", ")}.`
        : null
    ].filter((entry): entry is string => Boolean(entry));
  }, [breakdown]);

  const totalDeliverableCount = useMemo(
    () =>
      breakdown.deliverables.reduce(
        (count, item) => count + (item.quantity ?? 1),
        0
      ),
    [breakdown.deliverables]
  );

  return (
    <div className="relative mx-auto w-full max-w-3xl px-5 pb-32 pt-10 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-[1.8rem] font-bold leading-[1.05] tracking-[-0.04em] text-[#17202b] sm:text-[2.4rem] dark:text-white">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.02rem]">
          {description}
        </p>
        {actions ? (
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {actions}
          </div>
        ) : null}
      </header>

      {/* Breakdown body */}
      <div
        className={`mt-12 transition-all duration-500 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        {/* Contract title + summary */}
        <section>
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[1.4rem]">
            {breakdown.contractTitle ?? breakdown.sourceFileName}
          </h2>
          <div className="mt-4 space-y-3 text-[15px] leading-[1.7] text-foreground/85">
            {summaryText.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        {/* Quick stats row */}
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-black/[0.06] bg-black/[0.06] sm:grid-cols-3 dark:border-white/[0.08] dark:bg-white/[0.08]">
          <div className="bg-white px-5 py-4 dark:bg-[#13161b]">
            <p className="text-[12px] text-muted-foreground">Payment</p>
            <p className="mt-1 text-[1.15rem] font-semibold tracking-[-0.02em] text-foreground">
              {typeof breakdown.paymentAmount === "number"
                ? formatCurrency(breakdown.paymentAmount, breakdown.currency ?? "USD")
                : "Not specified"}
            </p>
          </div>
          <div className="bg-white px-5 py-4 dark:bg-[#13161b]">
            <p className="text-[12px] text-muted-foreground">Deliverables</p>
            <p className="mt-1 text-[1.15rem] font-semibold tracking-[-0.02em] text-foreground">
              {totalDeliverableCount > 0 ? `${totalDeliverableCount} items` : "None found"}
            </p>
          </div>
          <div className="col-span-2 bg-white px-5 py-4 sm:col-span-1 dark:bg-[#13161b]">
            <p className="text-[12px] text-muted-foreground">Risks flagged</p>
            <p className="mt-1 text-[1.15rem] font-semibold tracking-[-0.02em] text-foreground">
              {breakdown.riskFlags.length > 0
                ? `${breakdown.riskFlags.length} watchout${breakdown.riskFlags.length > 1 ? "s" : ""}`
                : "None"}
            </p>
          </div>
        </div>

        {/* Payment terms */}
        {breakdown.paymentSummary ? (
          <section className="mt-8">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Payment terms
            </h3>
            <p className="mt-2 text-[15px] leading-[1.7] text-foreground/85">
              {breakdown.paymentSummary}
            </p>
          </section>
        ) : null}

        {/* Risks */}
        {breakdown.riskFlags.length > 0 ? (
          <section className="mt-8">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Watchouts
            </h3>
            <div className="mt-3 space-y-3">
              {breakdown.riskFlags.map((flag) => (
                <div
                  key={flag.id}
                  className={`border-l-[3px] bg-[#fafaf8] py-3 pl-4 pr-4 dark:bg-white/[0.02] ${
                    SEVERITY_STYLES[flag.severity] ?? SEVERITY_STYLES.low
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-medium text-foreground">
                      {flag.title}
                    </p>
                    <span
                      className={`shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] ${
                        flag.severity === "high"
                          ? "text-red-500/80 dark:text-red-400/70"
                          : flag.severity === "medium"
                            ? "text-amber-600/80 dark:text-amber-400/70"
                            : "text-muted-foreground"
                      }`}
                    >
                      {flag.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                    {flag.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Deliverables */}
        {breakdown.deliverables.length > 0 ? (
          <section className="mt-8">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Deliverables
            </h3>
            <div className="mt-3 divide-y divide-black/[0.06] border-y border-black/[0.06] dark:divide-white/[0.08] dark:border-white/[0.08]">
              {breakdown.deliverables.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-foreground">
                      {summarizeDeliverableLine(item.title, item.quantity, item.channel)}
                    </p>
                    {item.description ? (
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  {item.dueDate ? (
                    <div className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {item.dueDate}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* Sticky bottom bar */}
      {stickyAction ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6 lg:px-8">
          <div className="pointer-events-auto mx-auto max-w-3xl border border-black/8 bg-white/95 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#0f1115]/92">
            {stickyAction}
          </div>
        </div>
      ) : null}
    </div>
  );
}
