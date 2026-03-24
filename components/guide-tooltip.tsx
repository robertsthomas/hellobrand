"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useGuide } from "@/components/guide-provider";

function findVisibleGuideAnchor(selector: string) {
  const elements = Array.from(document.querySelectorAll(selector));

  return (
    elements.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? null
  );
}

function getScrollParents(element: Element) {
  const parents: Array<Element | Window> = [window];
  let current = element.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const isScrollable =
      /(auto|scroll|overlay)/.test(overflowY) ||
      /(auto|scroll|overlay)/.test(overflowX);

    if (isScrollable) {
      parents.push(current);
    }

    current = current.parentElement;
  }

  return parents;
}

function isInViewport(rect: DOMRect) {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

export function GuideTooltip() {
  const { activeStep, remainingCount, isMobile, dismissStep, skipAll } = useGuide();
  const isLast = remainingCount <= 1;
  const [displayedStep, setDisplayedStep] = useState(activeStep);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useLayoutEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!activeStep) {
      setDisplayedStep(null);
      setAnchorRect(null);
      return;
    }

    let cancelled = false;

    const attachToAnchor = () => {
      if (cancelled) {
        return;
      }

      const element = findVisibleGuideAnchor(activeStep.anchorSelector);

      if (!element || element.getBoundingClientRect().width <= 0) {
        setDisplayedStep(null);
        setAnchorRect(null);
        return;
      }

      const initialRect = element.getBoundingClientRect();
      if (!isInViewport(initialRect)) {
        element.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth"
        });
      }

      const update = () => {
        setDisplayedStep(activeStep);
        setAnchorRect(element.getBoundingClientRect());
      };
      update();

      const observer = new ResizeObserver(update);
      observer.observe(element);

      const handleAnchorClick = () => {
        dismissStep(activeStep.id);
      };
      element.addEventListener("click", handleAnchorClick);

      const scrollParents = getScrollParents(element);
      for (const parent of scrollParents) {
        parent.addEventListener("scroll", update, { passive: true });
      }
      window.addEventListener("resize", update, { passive: true });

      const settleTimer = window.setTimeout(update, 250);

      cleanupRef.current = () => {
        observer.disconnect();
        element.removeEventListener("click", handleAnchorClick);
        for (const parent of scrollParents) {
          parent.removeEventListener("scroll", update);
        }
        window.removeEventListener("resize", update);
        window.clearTimeout(settleTimer);
      };
    };

    const frame = window.requestAnimationFrame(attachToAnchor);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [activeStep, dismissStep]);

  if (!mounted || !displayedStep || !anchorRect || isMobile) return null;

  const handleDismiss = () => {
    dismissStep(displayedStep.id);
  };

  const preferredSide = displayedStep.side ?? "right";
  const { style: tooltipStyle, resolvedSide, anchorMid } = getTooltipPosition(anchorRect, preferredSide);

  return createPortal(
    <>
      {/* Tooltip card — must be above the highlight ring */}
      <div
        className="fixed z-[100] w-72 border border-black/10 bg-white p-4 shadow-lg transition-[top,left] duration-300 ease-out dark:border-white/10 dark:bg-[#1a1d24]"
        style={{ ...tooltipStyle, touchAction: "auto" }}
      >
        {/* Arrow caret */}
        <div
          className="absolute h-2.5 w-2.5 rotate-45 border border-black/10 bg-white dark:border-white/10 dark:bg-[#1a1d24]"
          style={getArrowStyle(resolvedSide, anchorMid)}
        />
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            {displayedStep.title}
          </h3>
          <button
            type="button"
            onClick={skipAll}
            className="relative z-10 shrink-0 touch-manipulation rounded-sm p-2 text-black/40 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            aria-label="Close all tips"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[13px] leading-5 text-black/60 dark:text-white/65">
          {displayedStep.body}
        </p>
        <button
          type="button"
          onClick={isLast ? skipAll : handleDismiss}
          className={cn(
            buttonVariants({ size: "sm" }),
            "relative z-10 mt-3 h-9 w-full touch-manipulation bg-primary text-xs text-primary-foreground hover:bg-primary/90"
          )}
        >
          {isLast ? "Finish" : "Next"}
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
const TOOLTIP_HEIGHT_ESTIMATE = 210;
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

  // Measure available space on each side of the anchor
  const space: Record<Side, number> = {
    top: rect.top,
    bottom: vh - rect.bottom,
    left: rect.left,
    right: vw - rect.right
  };

  // Check if the preferred side fits
  const fitsH = (s: Side) =>
    s === "left" || s === "right"
      ? space[s] >= TOOLTIP_WIDTH + gap + PADDING
      : space[s] >= TOOLTIP_HEIGHT_ESTIMATE + gap + PADDING;

  // Pick side: preferred if it fits, otherwise the side with the most space
  let side = preferredSide;
  if (!fitsH(side)) {
    // Try all four sides, pick the one with the most room
    const ranked = (Object.keys(space) as Side[]).sort(
      (a, b) => space[b] - space[a]
    );
    side = ranked.find(fitsH) ?? ranked[0];
  }

  let top: number;
  let left: number;

  switch (side) {
    case "right":
      top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2;
      left = rect.right + gap;
      break;
    case "left":
      top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2;
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
