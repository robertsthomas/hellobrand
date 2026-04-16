"use client";

/**
 * This file renders the signed-in app shell.
 * It connects navigation, shell-level interactions, and shared frame UI for the authenticated product experience.
 */
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, ChevronRight, Hand, Menu, MessageSquareMore, Search } from "lucide-react";

import { PostHogActionLink } from "@/components/posthog-action-link";
import { SidebarMilestonesCard } from "@/components/sidebar-milestones-card";
import { buttonVariants } from "@/components/ui/button";
import { AssistantProvider, useAssistant } from "@/components/assistant-provider";
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
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeSwitch } from "@/components/theme-switch";
import { FeedbackWidget } from "@/components/feedback-widget";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  getAppRouteMeta,
  isAppNavItemActive,
  primaryAppNavItems,
  secondaryAppNavItems,
} from "@/lib/app-shell";
import type { SidebarMilestones } from "@/lib/sidebar-milestones";

import { cn } from "@/lib/utils";
import type { GuideStep } from "@/lib/guide-registry";

function MobileAssistantButton({ onClick }: { onClick?: () => void }) {
  const { openAssistant } = useAssistant();

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        openAssistant();
      }}
      className="group flex h-10 w-full items-center gap-3 px-3 text-[13px] font-medium transition-colors hover:bg-secondary/35 lg:hidden"
    >
      <span className="assistant-shimmer inline-flex shrink-0 items-center gap-3 bg-gradient-to-r from-[#1a4d3e] via-[#81b29a] to-[#1a4d3e] bg-[length:200%_100%] bg-clip-text text-transparent dark:from-[#81b29a] dark:via-[#d4e7dc] dark:to-[#81b29a]">
        <Bot className="h-4.5 w-4.5 shrink-0 stroke-[#1a4d3e] dark:stroke-[#81b29a]" />
        AI Assistant
      </span>
    </button>
  );
}

function isSidebarGuideStep(step: GuideStep | null) {
  return Boolean(step?.anchorSelector.includes('data-guide="sidebar-'));
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
}

export function AppFrame({
  children,
  viewerId,
  banner,
  guideState,
  hasActiveWorkspace,
  hasEverCreatedWorkspace,
  notifications,
  onboardingComplete,
  sidebarMilestones,
  workspaceNavItems = [],
}: {
  children: ReactNode;
  viewerId: string;
  banner?: ReactNode;
  guideState?: ProductGuideState;
  hasActiveWorkspace?: boolean;
  hasEverCreatedWorkspace?: boolean;
  notifications?: NotificationItem[];
  onboardingComplete?: boolean;
  sidebarMilestones?: SidebarMilestones;
  workspaceNavItems?: Array<{
    dealId: string;
    label: string;
    brandName: string;
  }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLDivElement | null>(null);
  const sidebarPanelRef = usePanelRef();
  const { signOut } = useClerk();

  const meta = useMemo(() => getAppRouteMeta(pathname), [pathname]);
  const [sidebarQuery, setSidebarQuery] = useState(searchParams.get("q") ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_collapsed") === "true";
  });
  const [guideOpenedMobileMenu, setGuideOpenedMobileMenu] = useState(false);
  const [feedbackOpenRequestKey, setFeedbackOpenRequestKey] = useState(0);

  const toggleSidebar = useCallback(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, []);
  const isInboxRoute = pathname === "/app/inbox";
  const hasVisibleSidebarMilestones = sidebarMilestones?.visible === true;
  const hasWorkspaceNotification = (notifications ?? []).some(
    (notification) => notification.category === "workspace" && notification.status === "active"
  );
  const feedbackDealId =
    pathname.match(/^\/app\/p\/([^/]+)/)?.[1] ??
    pathname.match(/^\/app\/payments\/([^/]+)/)?.[1] ??
    null;
  const sidebarSubItem = useMemo(() => {
    const paymentsMatch = pathname.match(/^\/app\/payments\/([^/]+)$/);

    if (paymentsMatch) {
      const workspace = workspaceNavItems.find((item) => item.dealId === paymentsMatch[1]);
      return workspace
        ? {
            parentHref: "/app/payments",
            href: `/app/payments/${workspace.dealId}`,
            label: workspace.label,
          }
        : null;
    }

    const historyMatch = pathname.match(/^\/app\/p\/history\/([^/]+)$/);

    if (historyMatch) {
      const workspace = workspaceNavItems.find((item) => item.dealId === historyMatch[1]);
      return workspace
        ? {
            parentHref: "/app/p/history",
            href: `/app/p/${workspace.dealId}`,
            label: workspace.label,
          }
        : null;
    }

    const workspaceMatch = pathname.match(/^\/app\/p\/([^/]+)$/);

    if (workspaceMatch && workspaceMatch[1] !== "history") {
      const workspace = workspaceNavItems.find((item) => item.dealId === workspaceMatch[1]);
      return workspace
        ? {
            parentHref: "/app/p/history",
            href: `/app/p/${workspace.dealId}`,
            label: workspace.label,
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

  const handleGuideActiveStepChange = useCallback(
    (step: GuideStep | null) => {
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
    },
    [guideOpenedMobileMenu]
  );

  const handleMobileMenuOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && guideOpenedMobileMenu) {
        return;
      }

      setMobileMenuOpen(nextOpen);

      if (!nextOpen) {
        setGuideOpenedMobileMenu(false);
      }
    },
    [guideOpenedMobileMenu]
  );

  const renderNavItem = (
    item: (typeof primaryAppNavItems)[number],
    options?: { onClick?: () => void; collapsed?: boolean }
  ) => {
    const Icon = item.icon;
    const active = isAppNavItemActive(pathname, item.href);

    const guideId = `sidebar-${item.label.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <div key={item.href}>
        <Link
          href={item.href}
          prefetch={false}
          data-guide={guideId}
          title={options?.collapsed ? item.label : undefined}
          onClick={options?.onClick}
          className={cn(
            "group flex h-10 w-full items-center gap-3 text-[13px] font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
            options?.collapsed ? "justify-center px-0" : "px-3",
            active
              ? "bg-secondary/55 text-foreground"
              : "text-muted-foreground hover:bg-secondary/35 hover:text-foreground"
          )}
        >
          <Icon
            className={cn(
              options?.collapsed ? "h-5.5 w-5.5" : "h-6.5 w-6.5",
              "shrink-0",
              active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
          {options?.collapsed ? null : <span className="truncate">{item.label}</span>}
        </Link>
        {!options?.collapsed && active && sidebarSubItem?.parentHref === item.href ? (
          <Link
            href={sidebarSubItem.href}
            prefetch={false}
            onClick={options?.onClick}
            className="ml-9 mt-1 flex h-9 items-center border-l border-black/10 pl-3 text-[13px] font-medium text-foreground dark:border-white/10"
          >
            <span className="truncate">{sidebarSubItem.label}</span>
          </Link>
        ) : null}
      </div>
    );
  };

  const renderFeedbackItem = (options?: { onClick?: () => void; collapsed?: boolean }) =>
    hasVisibleSidebarMilestones ? null : (
      <button
        type="button"
        title={options?.collapsed ? "App feedback" : undefined}
        onClick={() => {
          setFeedbackOpenRequestKey((current) => current + 1);
          options?.onClick?.();
        }}
        className={cn(
          "group flex h-10 w-full items-center gap-3 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:bg-secondary/35 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
          options?.collapsed ? "justify-center px-0" : "px-3"
        )}
      >
        <MessageSquareMore
          className={cn(
            options?.collapsed ? "h-4 w-4" : "h-4.5 w-4.5",
            "shrink-0 text-muted-foreground group-hover:text-foreground"
          )}
        />
        {options?.collapsed ? null : <span className="truncate">App feedback</span>}
      </button>
    );

  const renderSidebarMilestones = (options?: { onNavigate?: () => void }) =>
    sidebarMilestones ? (
      <SidebarMilestonesCard milestones={sidebarMilestones} onNavigate={options?.onNavigate} />
    ) : null;

  const guideWrapper = guideState
    ? (content: ReactNode) => (
        <GuideProvider
          initialGuideState={guideState}
          hasActiveWorkspace={hasActiveWorkspace ?? false}
          hasWorkspaceNotification={hasWorkspaceNotification}
          hasEverCreatedWorkspace={hasEverCreatedWorkspace ?? guideState.hasEverCreatedWorkspace}
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

  const renderSheet = () => (
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
          <Link
            href="/app"
            prefetch={false}
            className="group flex items-center gap-3"
            onClick={() => handleMobileMenuOpenChange(false)}
          >
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
        <div className="flex flex-1 flex-col overflow-auto px-3 pb-4">
          <div>
            <div className="mb-4 px-2 pt-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Workspace
              </p>
            </div>
            <nav className="space-y-1">
              {primaryAppNavItems.map((item) =>
                renderNavItem(item, { onClick: () => handleMobileMenuOpenChange(false) })
              )}
            </nav>
            <div className="mb-4 mt-8 px-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Preferences
              </p>
            </div>
            <div className="space-y-1">
              {secondaryAppNavItems.map((item) =>
                renderNavItem(item, { onClick: () => handleMobileMenuOpenChange(false) })
              )}
              <MobileAssistantButton onClick={() => handleMobileMenuOpenChange(false)} />
            </div>
            {renderSidebarMilestones({ onNavigate: () => handleMobileMenuOpenChange(false) })}
          </div>
          <div className="mt-auto pt-4">
            {renderFeedbackItem({ onClick: () => handleMobileMenuOpenChange(false) })}
          </div>
        </div>
        <div className="border-t border-border px-5 py-5 dark:border-white/8">
          <div className="space-y-3">
            <PostHogActionLink
              href="/app/intake/new"
              prefetch={false}
              eventName="workspace_entry_cta_clicked"
              payload={{ source: "sidebar_mobile" }}
              data-guide="sidebar-new-workspace"
              onClick={() => handleMobileMenuOpenChange(false)}
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-11 w-full justify-between rounded-none px-4"
              )}
            >
              <span>New workspace</span>
            </PostHogActionLink>
            <button
              type="button"
              onClick={() => {
                handleMobileMenuOpenChange(false);
                signOut({ redirectUrl: "/login" });
              }}
              className="text-left text-sm font-medium text-black/60 underline underline-offset-4 transition hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  const renderHeader = () => (
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
          <NotificationsCenter
            notifications={notifications ?? []}
            hasEverCreatedWorkspace={hasEverCreatedWorkspace ?? false}
          />
          <ThemeSwitch iconOnly />
        </div>
      </div>
    </header>
  );

  const renderMain = (content: ReactNode) => (
    <>
      <main
        className={cn(
          "workspace-dot-grid flex min-h-0 flex-1 flex-col overflow-hidden bg-white pt-[calc(64px+env(safe-area-inset-top))] lg:pt-[72px] dark:bg-[#111318]"
        )}
      >
        {banner ? <div className="shrink-0">{banner}</div> : null}
        <div
          ref={mainRef}
          data-workspace-scroll-container
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-x-hidden",
            isInboxRoute ? "overflow-hidden" : "overflow-y-auto overscroll-y-contain"
          )}
        >
          <div className="flex min-h-full min-w-0 flex-col">{content}</div>
        </div>
      </main>
      <FeedbackWidget
        viewerId={viewerId}
        pagePath={pathname}
        pageTitle={meta.title}
        dealId={feedbackDealId}
        openRequestKey={feedbackOpenRequestKey}
      />
    </>
  );

  const renderDesktopSidebar = () => (
    <>
      <div
        className={cn(
          "flex h-[72px] items-center",
          sidebarCollapsed ? "justify-center px-0" : "justify-between px-7"
        )}
      >
        <Link href="/app" prefetch={false} className="group flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center bg-primary text-primary-foreground",
              sidebarCollapsed ? "h-8 w-8" : "h-10 w-10"
            )}
          >
            <Hand
              className={cn(
                "hello-hand-wave rotate-[18deg]",
                sidebarCollapsed ? "h-4 w-4" : "h-5 w-5"
              )}
              strokeWidth={2.15}
            />
          </div>
          {sidebarCollapsed ? null : (
            <div className="text-[1.625rem] font-bold tracking-[-0.05em] text-foreground">
              HelloBrand
            </div>
          )}
        </Link>
      </div>
      {sidebarCollapsed ? null : (
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
      )}
      <div className="flex flex-1 flex-col overflow-auto px-3 pb-4">
        <div>
          {sidebarCollapsed ? null : (
            <div className="mb-4 px-2 pt-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Workspace
              </p>
            </div>
          )}
          <nav className={cn("space-y-1", sidebarCollapsed ? "pt-5" : "")}>
            {primaryAppNavItems.map((item) => renderNavItem(item, { collapsed: sidebarCollapsed }))}
          </nav>
          {sidebarCollapsed ? null : (
            <div className="mb-4 mt-8 px-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Preferences
              </p>
            </div>
          )}
          <div className={cn("space-y-1", sidebarCollapsed ? "mt-4" : "")}>
            {secondaryAppNavItems.map((item) =>
              renderNavItem(item, { collapsed: sidebarCollapsed })
            )}
          </div>
          {sidebarCollapsed ? null : renderSidebarMilestones()}
        </div>
        <div className="mt-auto pt-4">{renderFeedbackItem({ collapsed: sidebarCollapsed })}</div>
      </div>
      <div className="border-t border-border px-5 py-5 dark:border-white/8">
        <div className="space-y-3">
          {sidebarCollapsed ? null : (
            <>
              <PostHogActionLink
                href="/app/intake/new"
                prefetch={false}
                eventName="workspace_entry_cta_clicked"
                payload={{ source: "sidebar_desktop" }}
                data-guide="sidebar-new-workspace"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-11 w-full justify-between rounded-none px-4"
                )}
              >
                <span>New workspace</span>
              </PostHogActionLink>
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: "/login" })}
                className="text-sm font-medium text-black/60 underline underline-offset-4 transition hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <AssistantProvider>
      {guideWrapper(
        <div className="h-dvh min-h-dvh overflow-hidden bg-white dark:bg-[#0f1115]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden lg:hidden dark:bg-[#0f1115]">
            {renderSheet()}
            {renderHeader()}
            {renderMain(children)}
          </div>
          <ResizablePanelGroup
            orientation="horizontal"
            onLayoutChanged={(layout) => {
              const sidebarSize = layout["sidebar"];
              if (sidebarSize == null) return;
              if (sidebarSize < 10) {
                sidebarPanelRef.current?.collapse();
              } else if (!sidebarCollapsed) {
                sidebarPanelRef.current?.resize("14%");
              }
            }}
            className="hidden h-full min-h-0 overflow-hidden lg:flex dark:bg-[#0f1115]"
          >
            <ResizablePanel
              panelRef={sidebarPanelRef}
              id="sidebar"
              defaultSize={sidebarCollapsed ? "6%" : "14%"}
              minSize="6%"
              maxSize="14%"
              collapsible
              collapsedSize="6%"
              onResize={(size) => {
                const isNowCollapsed = sidebarPanelRef.current?.isCollapsed?.() ?? false;
                if (isNowCollapsed !== sidebarCollapsed) {
                  setSidebarCollapsed(isNowCollapsed);
                  try {
                    localStorage.setItem("sidebar_collapsed", String(isNowCollapsed));
                  } catch {}
                }
              }}
              className="flex h-full flex-col border-r border-border bg-white dark:border-white/10 dark:bg-[#121419]"
            >
              {renderDesktopSidebar()}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel className="relative flex min-h-0 min-w-0 flex-col bg-white dark:bg-[#111318]">
              {renderSheet()}
              {renderHeader()}
              {renderMain(children)}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </AssistantProvider>
  );
}
