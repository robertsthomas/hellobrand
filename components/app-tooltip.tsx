"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const contentClassName =
  "max-w-[220px] rounded-md bg-white px-2.5 py-1.5 text-center text-[11px] leading-4 text-[#475467] shadow-md ring-1 ring-black/8 dark:bg-[#161a1f] dark:text-white/70 dark:ring-white/10";

export function AppTooltip({
  children,
  content,
  delayDuration = 250,
  side = "top",
  sideOffset = 6,
  className
}: {
  children: ReactNode;
  content: ReactNode;
  delayDuration?: number;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={sideOffset}
          hideArrow
          className={cn(contentClassName, className)}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InfoTooltip({
  label,
  content,
  className,
  delayDuration = 250
}: {
  label: string;
  content: ReactNode;
  className?: string;
  delayDuration?: number;
}) {
  return (
    <AppTooltip content={content} delayDuration={delayDuration} sideOffset={8}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center text-[#98a2b3] transition hover:text-foreground dark:text-[#8f98a6]",
          className
        )}
      >
        <Info className="h-4 w-4" />
      </button>
    </AppTooltip>
  );
}
