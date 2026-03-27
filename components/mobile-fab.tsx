"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function MobileFab({
  side,
  children,
  className,
  onClick
}: {
  side: "left" | "right";
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const handleTap = () => {
    if (!revealed) {
      setRevealed(true);
      clearTimer();
      timerRef.current = setTimeout(() => setRevealed(false), 2500);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className={cn(
        "fixed bottom-6 z-40 flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-300 ease-out lg:hidden",
        side === "left" ? "left-0" : "right-0",
        className
      )}
      style={{
        transform: revealed
          ? side === "left"
            ? "translateX(16px)"
            : "translateX(-16px)"
          : side === "left"
            ? "translateX(-50%)"
            : "translateX(50%)"
      }}
    >
      {children}
    </button>
  );
}
