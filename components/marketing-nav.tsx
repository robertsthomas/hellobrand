"use client";

import { Hand, Sun, Moon, Menu } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { trackPublicFunnelEvent } from "@/lib/public-funnel-events";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { cn } from "@/components/ui/utils";

function hasRecentAccount(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("hb_has_account=1");
}

function ThemeButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]",
        className
      )}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function MarketingNav({ showWaitlist = false }: { showWaitlist?: boolean }) {
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
          <span className="text-[1.45rem] font-bold tracking-[-0.05em] text-[#1a2634] sm:text-[1.625rem] dark:text-[#eef2f5]">
            HelloBrand
          </span>
        </Link>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {returning ? (
            <Link
              href="/login"
              className="inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-white"
            >
              Go to app
            </Link>
          ) : (
            <Link
              href="/upload"
              onClick={() => trackPublicFunnelEvent("landing_upload_cta_clicked", { location: "nav_mobile" })}
              className="inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-white"
            >
              Upload free
            </Link>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-lg border-black/10 bg-white/90 text-[#1a2634] dark:border-white/12 dark:bg-white/5 dark:text-[#eef2f5]"
              >
                <Menu className="h-[18px] w-[18px]" />
                <span className="sr-only">Open navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-[320px] bg-[#fefcfa] dark:bg-[#101318]">
              <SheetHeader className="gap-4 border-b border-black/5 pb-5 pr-14 dark:border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <SheetTitle className="text-left text-lg font-semibold text-[#1a2634] dark:text-[#eef2f5]">
                      HelloBrand
                    </SheetTitle>
                    <SheetDescription className="text-left text-sm text-[#667085] dark:text-[#c4cad2]">
                      Explore the site and jump into the app.
                    </SheetDescription>
                  </div>
                  <ThemeButton className="border border-black/8 bg-white text-[#667085] dark:border-white/10 dark:bg-white/5 dark:text-[#c4cad2]" />
                </div>
              </SheetHeader>

              <div className="flex flex-1 flex-col px-4 py-5">
                <div className="space-y-2">
                  <SheetClose asChild>
                    <Link
                      href="/pricing"
                      className="flex h-12 items-center rounded-xl px-4 text-base font-medium text-[#1a2634] transition hover:bg-black/[0.04] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                    >
                      Pricing
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/blog"
                      className="flex h-12 items-center rounded-xl px-4 text-base font-medium text-[#1a2634] transition hover:bg-black/[0.04] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                    >
                      Blog
                    </Link>
                  </SheetClose>
                  {showWaitlist ? (
                    <SheetClose asChild>
                      <Link
                        href="/waitlist"
                        className="flex h-12 items-center rounded-xl px-4 text-base font-medium text-[#1a2634] transition hover:bg-black/[0.04] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                      >
                        Waitlist
                      </Link>
                    </SheetClose>
                  ) : null}
                </div>

                <div className="mt-auto pt-6">
                  <SheetClose asChild>
                    {returning ? (
                      <Link
                        href="/login"
                        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-white shadow-sm transition hover:bg-primary/94"
                      >
                        Go to app
                      </Link>
                    ) : (
                      <Link
                        href="/upload"
                        onClick={() => trackPublicFunnelEvent("landing_upload_cta_clicked", { location: "nav_drawer" })}
                        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-white shadow-sm transition hover:bg-primary/94"
                      >
                        Upload free
                      </Link>
                    )}
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop */}
        <div className="hidden items-center gap-4 md:flex">
          <ThemeButton />
          <div className="flex items-center gap-8 text-[14px] font-medium text-[#667085] dark:text-[#c4cad2]">
            <Link href="/pricing" className="transition hover:text-foreground">
              Pricing
            </Link>
            <Link href="/blog" className="transition hover:text-foreground">
              Blog
            </Link>
            {showWaitlist ? (
              <Link href="/waitlist" className="transition hover:text-foreground">
                Waitlist
              </Link>
            ) : null}
            {returning ? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
              >
                Go to app
              </Link>
            ) : (
              <Link
                href="/upload"
                onClick={() => trackPublicFunnelEvent("landing_upload_cta_clicked", { location: "nav_desktop" })}
                className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
              >
                Upload free
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
