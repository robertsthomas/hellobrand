"use client";

/**
 * This file renders the signed-in app shell.
 * It connects navigation, shell-level interactions, and shared frame UI for the authenticated product experience.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, ChevronRight, Hand, Menu, MessageSquareMore, Search } from "lucide-react";

import { PostHogActionLink } from "@/components/posthog-action-link";
import { AppFrameSignOutButton } from "@/components/app-frame-sign-out-button";
import { SidebarMilestonesCard } from "@/components/sidebar-milestones-card";
import { buttonVariants } from "@/components/ui/button";
import { AssistantProvider, useAssistant } from "@/components/assistant-provider";
import { GuideProvider } from "@/components/guide-provider";
import { GuideMobileModal } from "@/components/guide-mobile-modal";
import { GuideTooltip } from "@/components/guide-tooltip";
import { ThemeSwitch } from "@/components/theme-switch";
import type { ProductGuideState } from "@/lib/types";
import type { NotificationItem } from "@/lib/notifications";

const NotificationsCenter = lazy(() =>
  import("@/components/notifications-center").then((m) => ({
    default: m.NotificationsCenter,
  }))
);
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  getAppRouteMeta,
  localizeAppHref,
  normalizeAppPathname,
  isAppNavItemActive,
  primaryAppNavItems,
  secondaryAppNavItems,
} from "@/lib/app-shell";
import type { SidebarMilestones } from "@/lib/sidebar-milestones";

import { cn } from "@/lib/utils";
import type { GuideStep } from "@/lib/guide-registry";

const FeedbackWidget = lazy(() =>
  import("@/components/feedback-widget").then((m) => ({ default: m.FeedbackWidget }))
);

function MobileAssistantButton({ onClick }: { onClick?: () => void }) {
  const { openAssistant } = useAssistant();
  const t = useTranslations("appShell");

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        openAssistant();
      }}
      className="group flex h-10 w-full items-center gap-3 px-3 text-sm font-medium transition-colors hover:bg-secondary/35 lg:hidden"
    >
      <span className="assistant-shimmer inline-flex shrink-0 items-center gap-3 bg-gradient-to-r from-[#1a4d3e] via-[#81b29a] to-[#1a4d3e] bg-[length:200%_100%] bg-clip-text text-transparent dark:from-[#81b29a] dark:via-[#d4e7dc] dark:to-[#81b29a]">
        <Bot className="h-4.5 w-4.5 shrink-0 stroke-[#1a4d3e] dark:stroke-[#81b29a]" />
        {t("aiAssistant")}
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
  const t = useTranslations("appShell");

  const meta = useMemo(() => getAppRouteMeta(pathname), [pathname]);
  const normalizedPathname = useMemo(() => normalizeAppPathname(pathname), [pathname]);
  const [sidebarQuery, setSidebarQuery] = useState(searchParams.get("q") ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("sidebar_collapsed") !== "true";
  });
  const [guideOpenedMobileMenu, setGuideOpenedMobileMenu] = useState(false);
  const [feedbackOpenRequestKey, setFeedbackOpenRequestKey] = useState(0);

  const handleSidebarOpenChange = useCallback((nextOpen: boolean) => {
    setSidebarOpen(nextOpen);
    try {
      localStorage.setItem("sidebar_collapsed", String(!nextOpen));
    } catch {}
  }, []);
  const isInboxRoute = normalizedPathname === "/app/inbox";
  const hasVisibleSidebarMilestones = sidebarMilestones?.visible === true;
  const hasWorkspaceNotification = (notifications ?? []).some(
    (notification) => notification.category === "workspace" && notification.status === "active"
  );
  const feedbackDealId =
    normalizedPathname.match(/^\/app\/p\/([^/]+)/)?.[1] ??
    normalizedPathname.match(/^\/app\/payments\/([^/]+)/)?.[1] ??
    null;
  const sidebarSubItem = useMemo(() => {
    const paymentsMatch = normalizedPathname.match(/^\/app\/payments\/([^/]+)$/);

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

    const historyMatch = normalizedPathname.match(/^\/app\/p\/history\/([^/]+)$/);

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

    const workspaceMatch = normalizedPathname.match(/^\/app\/p\/([^/]+)$/);

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
  }, [normalizedPathname, workspaceNavItems]);

  const localizeHref = useCallback((href: string) => localizeAppHref(href, pathname), [pathname]);

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
      router.push(localizeHref("/app/search"));
      return;
    }

    const params = new URLSearchParams();
    params.set("q", normalizedQuery);
    router.push(localizeHref(`/app/search?${params.toString()}`));
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
    const itemLabel = t(`nav.${item.labelKey}`);
    const guideId = `sidebar-${item.labelKey.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={itemLabel}
          className={cn(
            "h-10 rounded-none text-sm font-medium shadow-none ring-0 focus-visible:ring-0",
            options?.collapsed ? "justify-center px-0" : "px-3",
            active
              ? "bg-secondary/55 text-foreground"
              : "text-muted-foreground hover:bg-secondary/35 hover:text-foreground"
          )}
        >
          <Link
            href={localizeHref(item.href)}
            prefetch={false}
            data-guide={guideId}
            onClick={options?.onClick}
          >
            <Icon
              className={cn(
                options?.collapsed ? "h-5.5 w-5.5" : "h-6.5 w-6.5",
                "shrink-0",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            {options?.collapsed ? null : <span>{itemLabel}</span>}
          </Link>
        </SidebarMenuButton>
        {!options?.collapsed && active && sidebarSubItem?.parentHref === item.href ? (
          <SidebarMenuSub className="mt-1 border-black/10 dark:border-white/10">
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                asChild
                isActive
                className="h-9 rounded-none pl-3 text-sm font-medium text-foreground"
              >
                <Link
                  href={localizeHref(sidebarSubItem.href)}
                  prefetch={false}
                  onClick={options?.onClick}
                >
                  <span>{sidebarSubItem.label}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
    );
  };

  const renderFeedbackItem = (options?: { onClick?: () => void; collapsed?: boolean }) =>
    hasVisibleSidebarMilestones ? null : (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={t("feedback")}
          onClick={() => {
            setFeedbackOpenRequestKey((current) => current + 1);
            options?.onClick?.();
          }}
          className={cn(
            "h-10 rounded-none text-sm font-medium text-muted-foreground shadow-none ring-0 hover:bg-secondary/35 hover:text-foreground focus-visible:ring-0",
            options?.collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <MessageSquareMore
            className={cn(
              options?.collapsed ? "h-4 w-4" : "h-4.5 w-4.5",
              "shrink-0 text-muted-foreground group-hover:text-foreground"
            )}
          />
          {options?.collapsed ? null : <span>{t("feedback")}</span>}
        </SidebarMenuButton>
      </SidebarMenuItem>
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

  const renderHeader = () => (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:absolute dark:border-white/8 dark:bg-[#111318]/95 dark:supports-[backdrop-filter]:bg-[#111318]/90">
      <div className="flex h-16 items-center justify-between px-6 lg:h-[72px] lg:px-8">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            className="mr-2 inline-flex h-10 w-10 items-center justify-center lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label={t("openMenuAriaLabel")}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm text-foreground lg:hidden">
              {t(`routes.${meta.titleKey}`)}
            </div>
            <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
              <span className="truncate">{t(`sections.${meta.sectionKey}`)}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span className="truncate text-foreground">{t(`routes.${meta.titleKey}`)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Suspense fallback={<div className="h-5 w-5" />}>
            <NotificationsCenter
              notifications={notifications ?? []}
              hasEverCreatedWorkspace={hasEverCreatedWorkspace ?? false}
            />
          </Suspense>
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
      <Suspense fallback={null}>
        <FeedbackWidget
          viewerId={viewerId}
          pagePath={pathname}
          pageTitle={t(`routes.${meta.titleKey}`)}
          dealId={feedbackDealId}
          openRequestKey={feedbackOpenRequestKey}
        />
      </Suspense>
    </>
  );

  const SidebarStateSync = () => {
    const { openMobile, setOpenMobile } = useSidebar();

    useEffect(() => {
      if (openMobile !== mobileMenuOpen) {
        setOpenMobile(mobileMenuOpen);
      }
    }, [mobileMenuOpen, openMobile, setOpenMobile]);

    useEffect(() => {
      handleMobileMenuOpenChange(openMobile);
    }, [handleMobileMenuOpenChange, openMobile]);

    return null;
  };

  const AppSidebarContainer = () => {
    const { isMobile, state } = useSidebar();
    const compactSidebar = !isMobile && state === "collapsed";
    const navigationLabel = t(isMobile ? "mobileNavigationAriaLabel" : "mainNavigationAriaLabel");
    const closeSidebar = isMobile ? () => handleMobileMenuOpenChange(false) : undefined;

    return (
      <Sidebar
        collapsible="icon"
        className="border-r border-border bg-white dark:border-white/10 dark:bg-[#121419]"
      >
        <SidebarHeader className="gap-0 p-0 pt-[env(safe-area-inset-top)] lg:pt-0">
          <div
            className={cn(
              "flex h-[72px] items-center",
              compactSidebar ? "justify-center px-0" : "justify-between px-7"
            )}
          >
            <Link
              href={localizeHref("/app")}
              prefetch={false}
              className={cn("group/logo flex items-center", compactSidebar ? "gap-0" : "gap-3")}
              onClick={closeSidebar}
            >
              <div
                className={cn(
                  "flex items-center justify-center bg-primary text-primary-foreground",
                  compactSidebar ? "h-8 w-8" : "h-10 w-10"
                )}
              >
                <Hand
                  className={cn(
                    "hello-hand-wave rotate-[18deg]",
                    compactSidebar ? "h-4 w-4" : "h-5 w-5"
                  )}
                  strokeWidth={2.15}
                />
              </div>
              {compactSidebar ? null : (
                <div className="text-[1.625rem] font-bold tracking-[-0.05em] text-foreground">
                  HelloBrand
                </div>
              )}
            </Link>
          </div>
          {compactSidebar ? null : (
            <div className="border-b border-border px-5 py-5 dark:border-white/8">
              <form
                onSubmit={(event) => {
                  handleSidebarSearch(event);
                  closeSidebar?.();
                }}
                className="flex h-10 items-center gap-3 border border-border bg-secondary/35 px-3 focus-within:ring-2 focus-within:ring-ring/30 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <Search className="h-4 w-4 shrink-0" />
                <SidebarInput
                  type="search"
                  value={sidebarQuery}
                  onChange={(event) => setSidebarQuery(event.target.value)}
                  placeholder="Search"
                  aria-label={t("searchAriaLabel")}
                  className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-sm text-foreground shadow-none ring-0 placeholder:text-muted-foreground focus-visible:ring-0"
                />
              </form>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent className="gap-0 px-3 pb-4">
          <SidebarGroup className="gap-0 p-0">
            {compactSidebar ? null : (
              <SidebarGroupLabel className="mb-4 px-2 pt-5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("sections.workspace")}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu
                aria-label={navigationLabel}
                className={cn("gap-1", compactSidebar ? "pt-5" : "")}
              >
                {primaryAppNavItems.map((item) =>
                  renderNavItem(item, {
                    collapsed: compactSidebar,
                    onClick: closeSidebar,
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="gap-0 p-0">
            {compactSidebar ? null : (
              <SidebarGroupLabel className="mb-4 mt-8 px-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("sections.preferences")}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className={cn("gap-1", compactSidebar ? "mt-4" : "")}>
                {secondaryAppNavItems.map((item) =>
                  renderNavItem(item, {
                    collapsed: compactSidebar,
                    onClick: closeSidebar,
                  })
                )}
              </SidebarMenu>
              {isMobile ? <MobileAssistantButton onClick={closeSidebar} /> : null}
            </SidebarGroupContent>
          </SidebarGroup>
          {compactSidebar ? null : renderSidebarMilestones({ onNavigate: closeSidebar })}
          <div className="mt-auto pt-4">
            <SidebarMenu>
              {renderFeedbackItem({ collapsed: compactSidebar, onClick: closeSidebar })}
            </SidebarMenu>
          </div>
        </SidebarContent>
        <SidebarFooter className="gap-0 border-t border-border px-5 py-5 dark:border-white/8">
          {compactSidebar ? null : (
            <div className="space-y-3">
              <PostHogActionLink
                href={localizeHref("/app/intake/new")}
                prefetch={false}
                eventName="workspace_entry_cta_clicked"
                payload={{ source: isMobile ? "sidebar_mobile" : "sidebar_desktop" }}
                data-guide="sidebar-new-workspace"
                onClick={closeSidebar}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-11 w-full justify-center rounded-none px-4 text-sm shadow-sm transition-[transform,box-shadow,background-color] hover:shadow-md active:translate-y-px active:shadow-sm"
                )}
              >
                <span>{t("newWorkspace")}</span>
              </PostHogActionLink>
              <AppFrameSignOutButton
                onBeforeSignOut={closeSidebar}
                className="text-left text-sm font-medium text-black/60 underline underline-offset-4 transition hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                {t("logOut")}
              </AppFrameSignOutButton>
            </div>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  };

  return (
    <AssistantProvider>
      {guideWrapper(
        <SidebarProvider
          open={sidebarOpen}
          onOpenChange={handleSidebarOpenChange}
          className="h-dvh min-h-dvh overflow-hidden bg-white dark:bg-[#0f1115]"
          style={
            {
              "--sidebar-width": "14rem",
              "--sidebar-width-icon": "3.5rem",
            } as CSSProperties
          }
        >
          <SidebarStateSync />
          <AppSidebarContainer />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-[#111318]">
            {renderHeader()}
            {renderMain(children)}
          </div>
        </SidebarProvider>
      )}
    </AssistantProvider>
  );
}
