"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const contentClassName =
  "max-w-[220px] rounded-md bg-white px-2.5 py-1.5 text-center text-[11px] leading-4 text-[#475467] shadow-md ring-1 ring-black/8 dark:bg-card dark:text-white/70 dark:ring-white/10";

export function AppTooltip({
  children,
  content,
  delayDuration = 250,
  side = "top",
  sideOffset = 6,
  className,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  content: ReactNode;
  delayDuration?: number;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip open={open} onOpenChange={onOpenChange}>
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
  delayDuration = 250,
}: {
  label: string;
  content: ReactNode;
  className?: string;
  delayDuration?: number;
}) {
  const [open, setOpen] = useState(false);
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => {
      setIsTouchLikeDevice(mediaQuery.matches);
    };

    update();

    const addListener = mediaQuery.addEventListener?.bind(mediaQuery);
    const removeListener = mediaQuery.removeEventListener?.bind(mediaQuery);

    if (addListener && removeListener) {
      addListener("change", update);
      return () => removeListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    if (!open || !isTouchLikeDevice) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleScroll = () => {
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isTouchLikeDevice, open]);

  return (
    <AppTooltip
      content={content}
      delayDuration={delayDuration}
      sideOffset={8}
      open={isTouchLikeDevice ? open : undefined}
      onOpenChange={isTouchLikeDevice ? setOpen : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={isTouchLikeDevice ? open : undefined}
        onClick={(event) => {
          if (!isTouchLikeDevice) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-muted-foreground",
          className
        )}
      >
        <Info aria-hidden="true" className="h-4 w-4" />
      </button>
    </AppTooltip>
  );
}
