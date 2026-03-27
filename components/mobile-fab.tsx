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
    <div
      className={cn(
        "fixed bottom-6 z-40 lg:hidden",
        side === "left" ? "left-0" : "right-0"
      )}
      style={{
        transform: revealed
          ? side === "left"
            ? "translateX(12px)"
            : "translateX(-12px)"
          : side === "left"
            ? "translateX(-46%)"
            : "translateX(46%)",
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)"
      }}
    >
      <button
        type="button"
        onClick={handleTap}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          className
        )}
      >
        {children}
      </button>
    </div>
  );
}
