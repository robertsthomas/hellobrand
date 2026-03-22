"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useGuide } from "@/components/guide-provider";

export function GuideTooltip() {
  const { activeStep, dismissStep } = useGuide();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!activeStep) {
      setAnchorRect(null);
      return;
    }

    const findAndTrack = () => {
      const element = document.querySelector(activeStep.anchorSelector);
      if (!element) {
        setAnchorRect(null);
        return;
      }

      const update = () => setAnchorRect(element.getBoundingClientRect());
      update();

      observerRef.current?.disconnect();
      const observer = new ResizeObserver(update);
      observer.observe(element);
      observerRef.current = observer;

      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update, { passive: true });

      return () => {
        observer.disconnect();
        window.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
      };
    };

    // Small delay to ensure DOM is rendered after navigation
    const timer = setTimeout(findAndTrack, 150);
    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [activeStep]);

  if (!mounted || !activeStep || !anchorRect) return null;

  const preferredSide = activeStep.side ?? "right";
  const { style: tooltipStyle, resolvedSide, anchorMid } = getTooltipPosition(anchorRect, preferredSide);

  return createPortal(
    <>
      {/* Pulsing highlight ring on anchor */}
      <div
        className="pointer-events-none fixed z-[99] rounded-lg ring-2 ring-ocean/40 animate-pulse"
        style={{
          top: anchorRect.top - 2,
          left: anchorRect.left - 2,
          width: anchorRect.width + 4,
          height: anchorRect.height + 4
        }}
      />

      {/* Tooltip card */}
      <div
        className="fixed z-[99] w-72 border border-black/10 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-[#1a1d24]"
        style={tooltipStyle}
      >
        {/* Arrow caret */}
        <div
          className="absolute h-2.5 w-2.5 rotate-45 border border-black/10 bg-white dark:border-white/10 dark:bg-[#1a1d24]"
          style={getArrowStyle(resolvedSide, anchorMid)}
        />
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            {activeStep.title}
          </h3>
          <button
            type="button"
            onClick={() => dismissStep(activeStep.id)}
            className="shrink-0 rounded-sm p-0.5 text-black/40 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            aria-label="Dismiss tip"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[13px] leading-5 text-black/60 dark:text-white/65">
          {activeStep.body}
        </p>
        <button
          type="button"
          onClick={() => dismissStep(activeStep.id)}
          className={cn(
            buttonVariants({ size: "sm" }),
            "mt-3 h-8 w-full bg-ocean text-xs text-white hover:bg-ocean/90"
          )}
        >
          Got it
        </button>
      </div>
    </>,
    document.body
  );
}

function getArrowStyle(side: Side, anchorMid: number): React.CSSProperties {
  const size = 10; // matches h-2.5 w-2.5
  const half = size / 2;

  switch (side) {
    case "right":
      // Arrow on the left edge, pointing left
      return { top: anchorMid - half, left: -half - 1, borderRight: "none", borderTop: "none" };
    case "left":
      // Arrow on the right edge, pointing right
      return { top: anchorMid - half, right: -half - 1, borderLeft: "none", borderBottom: "none" };
    case "bottom":
      // Arrow on the top edge, pointing up
      return { left: anchorMid - half, top: -half - 1, borderBottom: "none", borderRight: "none" };
    case "top":
      // Arrow on the bottom edge, pointing down
      return { left: anchorMid - half, bottom: -half - 1, borderTop: "none", borderLeft: "none" };
  }
}

const TOOLTIP_WIDTH = 288; // w-72
const TOOLTIP_HEIGHT_ESTIMATE = 160;
const PADDING = 12;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type Side = "top" | "bottom" | "left" | "right";

function getTooltipPosition(
  rect: DOMRect,
  preferredSide: Side
): { style: React.CSSProperties; resolvedSide: Side; anchorMid: number } {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  // Try preferred side, flip if it would go off-screen
  let side = preferredSide;

  if (side === "right" && rect.right + gap + TOOLTIP_WIDTH > vw - PADDING) {
    side = "left";
  }
  if (side === "left" && rect.left - gap - TOOLTIP_WIDTH < PADDING) {
    side = "right";
  }
  if (side === "bottom" && rect.bottom + gap + TOOLTIP_HEIGHT_ESTIMATE > vh - PADDING) {
    side = "top";
  }
  if (side === "top" && rect.top - gap - TOOLTIP_HEIGHT_ESTIMATE < PADDING) {
    side = "bottom";
  }

  switch (side) {
    case "right":
      top = rect.top + rect.height / 2 - 60;
      left = rect.right + gap;
      break;
    case "left":
      top = rect.top + rect.height / 2 - 60;
      left = rect.left - TOOLTIP_WIDTH - gap;
      break;
    case "bottom":
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case "top":
      top = rect.top - gap - TOOLTIP_HEIGHT_ESTIMATE;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
  }

  // Clamp to viewport
  top = clamp(top, PADDING, vh - TOOLTIP_HEIGHT_ESTIMATE - PADDING);
  left = clamp(left, PADDING, vw - TOOLTIP_WIDTH - PADDING);

  // Anchor midpoint relative to tooltip for arrow positioning
  const anchorMid =
    side === "top" || side === "bottom"
      ? clamp(rect.left + rect.width / 2 - left, 16, TOOLTIP_WIDTH - 16)
      : clamp(rect.top + rect.height / 2 - top, 16, TOOLTIP_HEIGHT_ESTIMATE - 16);

  return { style: { top, left }, resolvedSide: side, anchorMid };
}
