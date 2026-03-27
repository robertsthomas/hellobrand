"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Hand, Menu, Plus, Search } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { MobileFab } from "@/components/mobile-fab";
import { AssistantProvider } from "@/components/assistant-provider";
import { GuideProvider } from "@/components/guide-provider";
import { GuideMobileModal } from "@/components/guide-mobile-modal";
import { GuideTooltip } from "@/components/guide-tooltip";
import { NotificationsCenter } from "@/components/notifications-center";
import type { ProductGuideState } from "@/lib/types";
import type { NotificationItem } from "@/lib/notifications";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  getAppRouteMeta,
  isAppNavItemActive,
  primaryAppNavItems,
  secondaryAppNavItems
} from "@/lib/app-shell";
import { cn } from "@/lib/utils";
import type { GuideStep } from "@/lib/guide-registry";

function isSidebarGuideStep(step: GuideStep | null) {
  return Boolean(step?.anchorSelector.includes('data-guide="sidebar-'));
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
}

export function AppFrame({
  children,
  guideState,
  hasActiveWorkspace,
  notifications,
  onboardingComplete,
  workspaceNavItems = []
}: {
  children: ReactNode;
  guideState?: ProductGuideState;
  hasActiveWorkspace?: boolean;
  notifications?: NotificationItem[];
  onboardingComplete?: boolean;
  workspaceNavItems?: Array<{
    dealId: string;
    label: string;
    brandName: string;
  }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement | null>(null);

  const meta = useMemo(() => getAppRouteMeta(pathname), [pathname]);
  const [sidebarQuery, setSidebarQuery] = useState(searchParams.get("q") ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [guideOpenedMobileMenu, setGuideOpenedMobileMenu] = useState(false);
  const isInboxRoute = pathname === "/app/inbox";
  const hasWorkspaceNotification = (notifications ?? []).some(
    (notification) => notification.category === "workspace" && notification.status === "active"
  );
  const sidebarSubItem = useMemo(() => {
    const paymentsMatch = pathname.match(/^\/app\/payments\/([^/]+)$/);

    if (paymentsMatch) {
      const workspace = workspaceNavItems.find((item) => item.dealId === paymentsMatch[1]);
      return workspace
        ? {
            parentHref: "/app/payments",
            href: `/app/payments/${workspace.dealId}`,
            label: workspace.label
          }
        : null;
    }

    const historyMatch = pathname.match(/^\/app\/deals\/history\/([^/]+)$/);

    if (historyMatch) {
      const workspace = workspaceNavItems.find((item) => item.dealId === historyMatch[1]);
      return workspace
        ? {
            parentHref: "/app/deals/history",
            href: `/app/deals/history/${workspace.dealId}`,
            label: workspace.label
          }
        : null;
    }

    const workspaceMatch = pathname.match(/^\/app\/deals\/([^/]+)$/);

    if (workspaceMatch && workspaceMatch[1] !== "history") {
      const workspace = workspaceNavItems.find((item) => item.dealId === workspaceMatch[1]);
      return workspace
        ? {
            parentHref: "/app/deals/history",
            href: `/app/deals/${workspace.dealId}`,
            label: workspace.label
          }
        : null;
    }

    return null;
  }, [pathname, workspaceNavItems]);

  useEffect(() => {
    if (!guideOpenedMobileMenu) {
      setMobileMenuOpen(false);
    }
  }, [pathname, guideOpenedMobileMenu]);

  // Mark this device as having an account so the marketing nav shows "Go to app"
  useEffect(() => {
    document.cookie = "hb_has_account=1; path=/; max-age=31536000; SameSite=Lax";
  }, []);

  useEffect(() => {
    const container = mainRef.current;

    if (container) {
      container.scrollTo({ top: 0, left: 0 });
    }

    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, searchParams]);

  useEffect(() => {
    setSidebarQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlHeight = html.style.height;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
    const previousBodyHeight = body.style.height;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    html.style.height = "100%";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.height = previousHtmlHeight;
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.height = previousBodyHeight;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, []);

  const handleSidebarSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = sidebarQuery.trim();

    if (normalizedQuery.length === 0) {
      router.push("/app/search");
      return;
    }

    const params = new URLSearchParams();
    params.set("q", normalizedQuery);
    router.push(`/app/search?${params.toString()}`);
  };

  const requestGuideStepVisibility = useCallback((step: GuideStep) => {
    if (!isSidebarGuideStep(step) || !isMobileViewport()) {
      return false;
    }

    setGuideOpenedMobileMenu(true);
    setMobileMenuOpen(true);
    return true;
  }, []);

  const handleGuideActiveStepChange = useCallback((step: GuideStep | null) => {
    if (!guideOpenedMobileMenu) {
      return;
    }

    if (!step) {
      return;
    }

    if (isSidebarGuideStep(step)) {
      return;
    }

    setGuideOpenedMobileMenu(false);
    setMobileMenuOpen(false);
  }, [guideOpenedMobileMenu]);

  const handleMobileMenuOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && guideOpenedMobileMenu) {
      return;
    }

    setMobileMenuOpen(nextOpen);

    if (!nextOpen) {
      setGuideOpenedMobileMenu(false);
    }
  }, [guideOpenedMobileMenu]);

  const renderNavItem = (
    item: (typeof primaryAppNavItems)[number],
    options?: { onClick?: () => void }
  ) => {
    const Icon = item.icon;
    const active = isAppNavItemActive(pathname, item.href);

    const guideId = `sidebar-${item.label.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <div key={item.href}>
        <Link
          href={item.href}
          data-guide={guideId}
          onClick={options?.onClick}
          className={cn(
            "group flex h-10 w-full items-center gap-3 px-3 text-[13px] font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
            active
              ? "bg-secondary/55 text-foreground"
              : "text-muted-foreground hover:bg-secondary/35 hover:text-foreground"
          )}
        >
          <Icon
            className={cn(
              "h-4.5 w-4.5 shrink-0",
              active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
          <span className="truncate">{item.label}</span>
        </Link>
        {active && sidebarSubItem?.parentHref === item.href ? (
          <Link
            href={sidebarSubItem.href}
            onClick={options?.onClick}
            className="ml-9 mt-1 flex h-9 items-center border-l border-black/10 pl-3 text-[13px] font-medium text-foreground dark:border-white/10"
          >
            <span className="truncate">{sidebarSubItem.label}</span>
          </Link>
        ) : null}
      </div>
    );
  };

  const guideWrapper = onboardingComplete && guideState
    ? (content: ReactNode) => (
        <GuideProvider
          initialGuideState={guideState}
          hasActiveWorkspace={hasActiveWorkspace ?? false}
          hasWorkspaceNotification={hasWorkspaceNotification}
          visibilityKey={mobileMenuOpen}
          onUnavailableStep={requestGuideStepVisibility}
          onActiveStepChange={handleGuideActiveStepChange}
        >
          {content}
          <GuideTooltip />
          <GuideMobileModal />
        </GuideProvider>
      )
    : (content: ReactNode) => content;

  return (
    <AssistantProvider>
      {guideWrapper(
      <div className="h-dvh min-h-dvh overflow-hidden bg-white dark:bg-[#0f1115]">
      <div className="flex h-full min-h-0 overflow-hidden dark:bg-[#0f1115]">
        <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-white lg:flex dark:border-white/10 dark:bg-[#121419]">
          <div className="flex h-[72px] items-center justify-between border-b border-border px-7 dark:border-white/8">
            <Link href="/app" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
                <Hand className="hello-hand-wave h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
              </div>
              <div className="text-[1.625rem] font-bold tracking-[-0.05em] text-foreground">
                HelloBrand
              </div>
            </Link>
          </div>

          <div className="border-b border-border px-5 py-5 dark:border-white/8">
            <form
              onSubmit={handleSidebarSearch}
              className="flex h-10 items-center gap-3 border border-border bg-secondary/35 px-3 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <Search className="h-4 w-4 shrink-0" />
              <input
                type="search"
                value={sidebarQuery}
                onChange={(event) => setSidebarQuery(event.target.value)}
                placeholder="Search partnerships"
                aria-label="Search partnerships"
                className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[13px] text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0"
              />
            </form>
          </div>

          <div className="flex-1 overflow-auto px-3 pb-4">
            <div className="mb-4 px-2 pt-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Workspace
              </p>
            </div>
            <nav className="space-y-1">{primaryAppNavItems.map((item) => renderNavItem(item))}</nav>

            <div className="mb-4 mt-8 px-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Preferences
              </p>
            </div>

            <div className="space-y-1">{secondaryAppNavItems.map((item) => renderNavItem(item))}</div>
          </div>

          <div className="border-t border-border px-5 py-5 dark:border-white/8">
            <div className="space-y-3">
              <Link
                href="/app/intake/new"
                data-guide="sidebar-new-workspace"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-11 w-full justify-between px-4"
                )}
              >
                <span>New workspace</span>
              </Link>
              <SignOutButton redirectUrl="/login">
                <button
                  type="button"
                  className="text-sm font-medium text-black/60 underline underline-offset-4 transition hover:text-black dark:text-white/60 dark:hover:text-white"
                >
                  Log out
                </button>
              </SignOutButton>
            </div>
          </div>
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-[#111318]">
          <Sheet open={mobileMenuOpen} onOpenChange={handleMobileMenuOpenChange}>
            <SheetContent
              side="left"
              className="w-64 p-0 pt-[env(safe-area-inset-top)] dark:bg-[#121419]"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
              }}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation menu</SheetTitle>
                <SheetDescription>App navigation and account actions.</SheetDescription>
              </SheetHeader>
              <div className="flex h-[72px] items-center justify-between border-b border-border px-7 dark:border-white/8">
                <Link href="/app" className="group flex items-center gap-3" onClick={() => handleMobileMenuOpenChange(false)}>
                  <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
                    <Hand className="hello-hand-wave h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
                  </div>
                  <div className="text-[1.625rem] font-bold tracking-[-0.05em] text-foreground">
                    HelloBrand
                  </div>
                </Link>
              </div>

              <div className="border-b border-border px-5 py-5 dark:border-white/8">
                <form
                  onSubmit={(e) => {
                    handleSidebarSearch(e);
                    handleMobileMenuOpenChange(false);
                  }}
                  className="flex h-10 items-center gap-3 border border-border bg-secondary/35 px-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    type="search"
                    value={sidebarQuery}
                    onChange={(event) => setSidebarQuery(event.target.value)}
                    placeholder="Search partnerships"
                    aria-label="Search partnerships"
                    className="min-w-0 flex-1 self-center appearance-none border-0 bg-transparent p-0 leading-none text-[13px] text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0"
                  />
                </form>
              </div>

              <div className="flex-1 overflow-auto px-3 pb-4">
                <div className="mb-4 px-2 pt-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Workspace
                  </p>
                </div>
                <nav className="space-y-1">
                  {primaryAppNavItems.map((item) =>
                    renderNavItem(item, {
                      onClick: () => handleMobileMenuOpenChange(false)
                    })
                  )}
                </nav>

                <div className="mb-4 mt-8 px-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Preferences
                  </p>
                </div>
                <div className="space-y-1">
                  {secondaryAppNavItems.map((item) =>
                    renderNavItem(item, {
                      onClick: () => handleMobileMenuOpenChange(false)
                    })
                  )}
                </div>
              </div>

              <div className="border-t border-border px-5 py-5 dark:border-white/8">
                <div className="space-y-3">
                  <Link
                    href="/app/intake/new"
                    data-guide="sidebar-new-workspace"
                    onClick={() => handleMobileMenuOpenChange(false)}
                    className={cn(buttonVariants({ size: "sm" }), "h-11 w-full justify-between px-4")}
                  >
                    <span>New workspace</span>
                  </Link>
                  <SignOutButton redirectUrl="/login">
                    <button
                      type="button"
                      onClick={() => handleMobileMenuOpenChange(false)}
                      className="text-left text-sm font-medium text-black/60 underline underline-offset-4 transition hover:text-black dark:text-white/60 dark:hover:text-white"
                    >
                      Log out
                    </button>
                  </SignOutButton>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:absolute dark:border-white/8 dark:bg-[#111318]/95 dark:supports-[backdrop-filter]:bg-[#111318]/90">
            <div className="flex h-16 items-center justify-between px-6 lg:h-[72px] lg:px-8">
              <div className="flex min-w-0 items-center">
                <button
                  type="button"
                  className="mr-2 inline-flex h-10 w-10 items-center justify-center lg:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground lg:hidden">{meta.title}</div>
                  <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
                    <span className="truncate">{meta.section}</span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                    <span className="truncate text-foreground">{meta.title}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <NotificationsCenter notifications={notifications ?? []} />
                <ThemeSwitch iconOnly />
              </div>
            </div>
          </header>

          <main
            ref={mainRef}
            className={cn(
              "workspace-dot-grid min-h-0 flex-1 overflow-x-hidden bg-white pt-[calc(64px+env(safe-area-inset-top))] lg:pt-[72px] dark:bg-[#111318]",
              isInboxRoute ? "overflow-hidden" : "overflow-y-auto overscroll-y-contain"
            )}
          >
            <div className="flex h-full min-h-0 flex-col">{children}</div>
          </main>

          <MobileFab
            side="left"
            className={cn(
              buttonVariants({ size: "icon" }),
              "shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
            )}
            onClick={() => router.push("/app/intake/new")}
          >
            <Plus className="h-5 w-5" />
          </MobileFab>
        </div>
      </div>
      </div>
      )}
    </AssistantProvider>
  );
}
