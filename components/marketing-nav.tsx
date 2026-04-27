"use client";

import { Hand, Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { trackPublicFunnelEvent } from "@/lib/public-funnel-events";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/components/ui/utils";

function hasRecentAccount(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("hb_has_account=1");
}

function ThemeButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-black/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-[#1a2634] dark:hover:bg-black/[0.06] dark:hover:text-[#1a2634]",
        className
      )}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function MarketingNav({ showWaitlist = false }: { showWaitlist?: boolean }) {
  const returning = useSyncExternalStore(
    () => () => {},
    hasRecentAccount,
    () => false
  );

  return (
    <nav className="sticky top-0 z-40 border-b border-black/5 bg-[#fefcfa]/95 backdrop-blur dark:border-white/10 dark:bg-[#101318]/92">
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between px-5 sm:h-[72px] sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
            <Hand className="hello-hand-wave h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
          </div>
          <span className="text-[1.45rem] font-bold tracking-[-0.05em] text-[#1a2634] sm:text-[1.625rem]">
            HelloBrand
          </span>
        </Link>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {returning ? (
            <Link
              href="/login"
              className="inline-flex h-10 items-center whitespace-nowrap rounded-none bg-primary px-4 text-sm font-medium text-white"
            >
              Go to app
            </Link>
          ) : (
            <Link
              href="/upload"
              onClick={() =>
                trackPublicFunnelEvent("landing_upload_cta_clicked", { location: "nav_mobile" })
              }
              className="inline-flex h-10 items-center whitespace-nowrap rounded-none bg-primary px-4 text-sm font-medium text-white"
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
                className="h-10 w-10 rounded-none border-black/10 bg-white/90 text-[#1a2634] dark:border-white/12 dark:bg-[#171b20] dark:text-white dark:hover:bg-[#1d232a]"
              >
                <Menu className="h-[18px] w-[18px]" />
                <span className="sr-only">Open navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[86vw] max-w-[320px] bg-[#fefcfa] [&>[data-slot=sheet-close]]:top-4 [&>[data-slot=sheet-close]]:right-4 dark:bg-[#101318]"
            >
              <ThemeButton className="absolute right-12 top-4 z-10 h-4 w-4 rounded-none text-muted-foreground dark:text-muted-foreground" />
              <SheetHeader className="gap-4 border-b border-black/5 pb-5 pr-24 dark:border-white/10">
                <div className="flex items-start gap-4">
                  <div className="space-y-1">
                    <SheetTitle className="text-left text-lg font-semibold text-[#1a2634] dark:text-[#eef2f5]">
                      HelloBrand
                    </SheetTitle>
                    <SheetDescription className="text-left text-sm text-muted-foreground dark:text-muted-foreground">
                      Explore the site and jump into the app.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-1 flex-col px-4 py-5">
                <div className="space-y-2">
                  <SheetClose asChild>
                    <Link
                      href="/"
                      className="flex h-12 items-center rounded-none px-4 text-base font-medium text-[#1a2634] transition hover:bg-black/[0.04] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                    >
                      Home
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/pricing"
                      className="flex h-12 items-center rounded-none px-4 text-base font-medium text-[#1a2634] transition hover:bg-black/[0.04] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                    >
                      Pricing
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/blog"
                      className="flex h-12 items-center rounded-none px-4 text-base font-medium text-[#1a2634] transition hover:bg-black/[0.04] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                    >
                      Blog
                    </Link>
                  </SheetClose>
                  {showWaitlist ? (
                    <SheetClose asChild>
                      <Link
                        href="/waitlist"
                        className="flex h-12 items-center rounded-none px-4 text-base font-medium text-[#1a2634] transition hover:bg-black/[0.04] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                      >
                        Waitlist
                      </Link>
                    </SheetClose>
                  ) : null}
                </div>

                <div className="mt-auto space-y-3 pt-6">
                  <SheetClose asChild>
                    {returning ? (
                      <Link
                        href="/login"
                        className="inline-flex h-12 w-full items-center justify-center rounded-none bg-primary px-5 text-base font-semibold text-white shadow-sm transition hover:bg-primary/94"
                      >
                        Go to app
                      </Link>
                    ) : (
                      <Link
                        href="/upload"
                        onClick={() =>
                          trackPublicFunnelEvent("landing_upload_cta_clicked", {
                            location: "nav_drawer",
                          })
                        }
                        className="inline-flex h-12 w-full items-center justify-center rounded-none bg-primary px-5 text-base font-semibold text-white shadow-sm transition hover:bg-primary/94"
                      >
                        Upload free
                      </Link>
                    )}
                  </SheetClose>
                  {!returning ? (
                    <SheetClose asChild>
                      <Link
                        href="/login"
                        className="inline-flex h-12 w-full items-center justify-center rounded-none border border-black/10 bg-white px-5 text-base font-semibold text-[#1a2634] transition hover:bg-black/[0.03] dark:border-white/12 dark:bg-white/[0.03] dark:text-[#eef2f5] dark:hover:bg-white/[0.06]"
                      >
                        Login
                      </Link>
                    </SheetClose>
                  ) : null}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop */}
        <div className="hidden items-center gap-4 md:flex">
          <ThemeButton />
          <div className="flex items-center gap-8 text-[14px] font-medium text-muted-foreground dark:text-muted-foreground">
            <Link href="/" className="transition hover:text-foreground dark:hover:text-foreground">
              Home
            </Link>
            <Link
              href="/pricing"
              className="transition hover:text-foreground dark:hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="transition hover:text-foreground dark:hover:text-foreground"
            >
              Blog
            </Link>
            {showWaitlist ? (
              <Link
                href="/waitlist"
                className="transition hover:text-foreground dark:hover:text-foreground"
              >
                Waitlist
              </Link>
            ) : null}
            {returning ? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-none bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
              >
                Go to app
              </Link>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/upload"
                  onClick={() =>
                    trackPublicFunnelEvent("landing_upload_cta_clicked", {
                      location: "nav_desktop",
                    })
                  }
                  className="inline-flex h-10 items-center rounded-none bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
                >
                  Upload free
                </Link>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-none px-5 text-[14px] font-semibold"
                >
                  <Link href="/login">Login</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
