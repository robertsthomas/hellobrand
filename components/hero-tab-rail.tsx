"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type HeroTabRailProps = {
  items: string[];
  activeIndex?: number;
  className?: string;
};

export function HeroTabRail({
  items,
  activeIndex = 0,
  className
}: HeroTabRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(maxScrollLeft - rail.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    updateScrollState();

    const handleScroll = () => updateScrollState();
    rail.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(rail);

    Array.from(rail.children).forEach((child) => resizeObserver.observe(child));

    return () => {
      rail.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [items, updateScrollState]);

  const scrollRail = useCallback((direction: "left" | "right") => {
    const rail = railRef.current;
    if (!rail) return;

    const distance = Math.max(rail.clientWidth * 0.72, 180);
    rail.scrollBy({
      left: direction === "right" ? distance : -distance,
      behavior: "smooth"
    });
  }, []);

  return (
    <div className={cn("mt-4", className)}>
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 z-10 flex items-center pl-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => scrollRail("left")}
            disabled={!canScrollLeft}
            aria-label="Scroll tabs left"
            className={cn(
              "h-9 w-9 rounded-full border-black/[0.08] bg-white/96 shadow-sm backdrop-blur dark:border-white/[0.1] dark:bg-[#13181d]/92",
              !canScrollLeft && "pointer-events-none opacity-0"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="absolute inset-y-0 right-0 z-10 flex items-center pr-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => scrollRail("right")}
            disabled={!canScrollRight}
            aria-label="Scroll tabs right"
            className={cn(
              "h-9 w-9 rounded-full border-black/[0.08] bg-white/96 shadow-sm backdrop-blur dark:border-white/[0.1] dark:bg-[#13181d]/92",
              !canScrollRight && "pointer-events-none opacity-0"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-[1] w-14 bg-gradient-to-r from-[#fefcfa] via-[#fefcfa]/90 to-transparent transition-opacity dark:from-[#0f1115] dark:via-[#0f1115]/90",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-[1] w-14 bg-gradient-to-l from-[#fefcfa] via-[#fefcfa]/90 to-transparent transition-opacity dark:from-[#0f1115] dark:via-[#0f1115]/90",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          ref={railRef}
          className="overflow-x-auto px-12 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max gap-2">
            {items.map((item, index) => (
              <span
                key={item}
                className={cn(
                  "shrink-0 px-3.5 py-2 text-[13px] font-medium",
                  index === activeIndex
                    ? "bg-foreground text-background"
                    : "border border-black/[0.06] bg-white text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.02]"
                )}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
