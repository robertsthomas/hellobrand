"use client";

import { Hand, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function hasRecentAccount(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("hb_has_account=1");
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]"
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function MarketingNav() {
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    setReturning(hasRecentAccount());
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-black/5 bg-[#fefcfa]/95 backdrop-blur dark:border-white/10 dark:bg-[#101318]/92">
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between px-5 sm:h-[72px] sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
            <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
          </div>
          <span className="text-[1.625rem] font-bold tracking-[-0.05em] text-foreground">
            HelloBrand
          </span>
        </Link>

        {/* Mobile */}
        <div className="flex items-center gap-3 md:hidden">
          <ThemeButton />
          {returning ? (
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white"
            >
              Go to app
            </Link>
          ) : (
            <Link
              href="/login?mode=sign-up"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white"
            >
              Get started
            </Link>
          )}
        </div>

        {/* Desktop */}
        <div className="hidden items-center gap-4 md:flex">
          <ThemeButton />
          <div className="flex items-center gap-8 text-[14px] font-medium text-muted-foreground">
            <Link href="/pricing" className="transition hover:text-foreground">
              Pricing
            </Link>
            <Link href="/waitlist" className="transition hover:text-foreground">
              Waitlist
            </Link>
            {returning ? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
              >
                Go to app
              </Link>
            ) : (
              <Link
                href="/login?mode=sign-up"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
