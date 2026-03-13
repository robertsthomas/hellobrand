"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function ThemeSwitch({
  className,
  compact = false,
  minimal = false
}: {
  className?: string;
  compact?: boolean;
  minimal?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <label
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/75 px-3 py-2 text-sm text-black/70 shadow-[0_10px_25px_rgba(25,25,20,0.08)] backdrop-blur transition-colors dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:shadow-[0_14px_30px_rgba(0,0,0,0.24)]",
        compact && "gap-2 px-2.5 py-1.5 text-xs",
        minimal && "gap-0 rounded-full border-0 bg-transparent px-0 py-0 shadow-none dark:bg-transparent",
        className
      )}
    >
      {!minimal ? <SunMedium className="h-4 w-4 text-clay" /> : null}
      {!compact && !minimal ? <span className="font-medium">Dark mode</span> : null}
      <Switch
        checked={isDark}
        aria-label="Toggle dark mode"
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      />
      {!minimal ? <MoonStar className="h-4 w-4 text-ocean dark:text-sand" /> : null}
    </label>
  );
}
