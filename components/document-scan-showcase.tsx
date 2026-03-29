"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import {
  ArrowDown,
  ArrowRight,
  Calendar,
  Check,
  CircleDollarSign,
  FileText,
  ShieldAlert,
  type LucideIcon
} from "lucide-react";

const documentRows: Array<{
  width: string;
  delay: number;
  highlighted?: boolean;
}> = [
  { width: "84%", delay: 0.08 },
  { width: "69%", delay: 0.14, highlighted: true },
  { width: "77%", delay: 0.2 },
  { width: "91%", delay: 0.26 },
  { width: "63%", delay: 0.32, highlighted: true },
  { width: "74%", delay: 0.38 }
];

const summaryItems: Array<{
  icon: LucideIcon;
  label: string;
  value: string;
  accentClassName: string;
}> = [
  {
    icon: ShieldAlert,
    label: "Risk",
    value: "Exclusivity clause detected",
    accentClassName: "text-[#f29b7f]"
  },
  {
    icon: CircleDollarSign,
    label: "Payment",
    value: "$4,500 due Net 30",
    accentClassName: "text-[#7fd1ad]"
  },
  {
    icon: Calendar,
    label: "Timeline",
    value: "3 posts due by Apr 28",
    accentClassName: "text-[#f6d28d]"
  }
];

function DocumentSheet({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      className="relative flex w-full max-w-[360px] flex-col overflow-hidden rounded-2xl border border-[#dfe6dd] bg-[#fffdf8] p-4 shadow-[0_24px_60px_rgba(17,24,39,0.15)] sm:p-6"
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute inset-y-0 left-1/2 w-16 -translate-x-1/2 bg-gradient-to-b from-transparent via-[#7fd1ad]/20 to-transparent blur-xl"
        animate={reducedMotion ? { opacity: 0.5 } : { y: ["-105%", "105%"] }}
        transition={{
          duration: 2.4,
          ease: "linear",
          repeat: Infinity,
          repeatDelay: 0.15
        }}
      />

      <div className="mb-3 flex items-center gap-2.5 sm:mb-4 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#16362e] text-white sm:h-11 sm:w-11">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#16362e] sm:text-sm">
            brand-deal-contract.pdf
          </div>
          <div className="text-[11px] text-[#5b6a60] sm:text-xs">12 pages</div>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-2.5">
        {documentRows.map((row, index) => (
          <motion.div
            key={index}
            className="relative h-2 overflow-hidden rounded-full bg-[#e8ede6] sm:h-2.5"
            style={{ width: row.width }}
            animate={
              reducedMotion
                ? { opacity: 0.8 }
                : { opacity: [0.5, 1, 0.5] }
            }
            transition={{
              duration: 1.8,
              delay: row.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {row.highlighted ? (
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#f29b7f]/50 via-[#7fd1ad]/60 to-[#f6d28d]/50"
                animate={
                  reducedMotion
                    ? { opacity: 0.85 }
                    : { x: ["-100%", "100%"] }
                }
                transition={{
                  duration: 1.45,
                  delay: index * 0.12,
                  repeat: Infinity,
                  repeatDelay: 0.75,
                  ease: "easeInOut"
                }}
              />
            ) : null}
          </motion.div>
        ))}
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-[#ebefe8] bg-[#f8f6f0] p-3 sm:mt-5 sm:space-y-2 sm:p-4">
        {[
          "90-day usage across brand channels",
          "Net 30 payment after approval",
          "Exclusivity clause flagged"
        ].map((line, index) => (
          <motion.div
            key={line}
            className="rounded-lg bg-[#e4eae2]/80 px-2.5 py-1.5 text-[10px] text-[#425047] sm:px-3 sm:text-[11px]"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.55 + index * 0.1,
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1]
            }}
          >
            {line}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-2.5 flex items-center justify-between rounded-xl border border-[#d5ede1] bg-[#edf9f2] px-3 py-2.5 sm:mt-3 sm:px-4 sm:py-3"
        animate={
          reducedMotion
            ? { boxShadow: "0 0 0 rgba(0,0,0,0)" }
            : {
                boxShadow: [
                  "0 0 0 rgba(127,209,173,0)",
                  "0 0 20px rgba(127,209,173,0.25)",
                  "0 0 0 rgba(127,209,173,0)"
                ]
              }
        }
        transition={{ duration: 2.3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#2f735c] sm:text-[10px]">
            Scan
          </div>
          <div className="text-[12px] font-semibold text-[#17362f] sm:text-[13px]">
            Extracting key terms
          </div>
        </div>
        <motion.div
          className="h-2 w-2 rounded-full bg-[#2f735c]"
          animate={reducedMotion ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </motion.div>
  );
}

function SummaryPanel({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e1715]/90 p-4 text-white shadow-[0_24px_60px_rgba(5,10,9,0.35)] backdrop-blur-xl sm:max-w-[380px] sm:p-6"
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7fd1ad] to-transparent"
        animate={reducedMotion ? { opacity: 0.7 } : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.1, repeat: Infinity }}
      />

      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4 sm:gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#9fd7bf] sm:text-[11px]">
            Summary
          </div>
          <div className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
            Contract analyzed
          </div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 sm:h-10 sm:w-10">
          <Check className="h-4 w-4 text-[#9fd7bf] sm:h-5 sm:w-5" strokeWidth={2} />
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:mb-4 sm:p-4">
        <motion.p
          className="text-[12px] leading-relaxed text-[#b2c2ba] sm:text-[13px]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.3 }}
        >
          Brand agreement includes deliverables, payment timing, a 90-day usage
          window, and one exclusivity restriction to review.
        </motion.p>
      </div>

      <div className="space-y-2 sm:space-y-2.5">
        {summaryItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.label}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] p-3 sm:gap-3 sm:p-3.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 1.3 + index * 0.14,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1]
              }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 sm:h-9 sm:w-9">
                <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${item.accentClassName}`} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white sm:text-sm">
                  {item.label}
                </div>
                <div className="text-[13px] text-[#b2c2ba] sm:text-sm">{item.value}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        className="relative mt-3 overflow-hidden rounded-xl border border-[#7fd1ad]/20 bg-[#7fd1ad]/10 px-3 py-2.5 text-[12px] text-[#dff3e9] sm:mt-4 sm:px-4 sm:py-3 sm:text-[13px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.9, duration: 0.4 }}
      >
        <motion.div
          className="absolute left-[-20%] top-0 h-full w-16 rotate-12 bg-white/10 blur-xl"
          animate={reducedMotion ? { opacity: 0.35 } : { x: ["0%", "520%"] }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 0.8
          }}
        />
        Ready to create action items and follow-ups.
      </motion.div>
    </motion.div>
  );
}

function ConnectorArrow() {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0">
      <ArrowDown className="h-5 w-5 text-white/30 lg:hidden" strokeWidth={1.5} />
      <ArrowRight className="hidden h-8 w-8 text-white/35 lg:block" strokeWidth={1.75} />
    </div>
  );
}

export function DocumentScanShowcase() {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-[#10221e] dark:bg-[#0d1714]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(127,209,173,0.15),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(242,155,127,0.12),transparent_24%)]" />
      <motion.div
        className="absolute left-[10%] top-[16%] h-36 w-36 rounded-full bg-[#7fd1ad]/8 blur-3xl"
        animate={
          reducedMotion
            ? { opacity: 0.25 }
            : { scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }
        }
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-12 md:py-16 lg:px-8 lg:py-20"
      >
        <div className="mb-6 text-center sm:mb-8 lg:mb-10">
          <motion.p
            className="mx-auto max-w-[50ch] text-[13px] leading-relaxed text-white/55 sm:text-sm md:text-base"
            initial={{ opacity: 0, y: 8 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              delay: 0.06,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1]
            }}
          >
            Upload a contract, get an instant breakdown of clauses, risks, and
            payment terms.
          </motion.p>
        </div>

        <div className="flex flex-col items-center gap-5 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-10 xl:gap-14">
          <div className="flex w-full justify-center lg:justify-end">
            <DocumentSheet reducedMotion={Boolean(reducedMotion)} />
          </div>

          <ConnectorArrow />

          <div className="flex w-full justify-center lg:justify-start">
            <SummaryPanel reducedMotion={Boolean(reducedMotion)} />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
