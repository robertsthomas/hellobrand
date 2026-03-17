"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  BarChart3,
  Bell,
  ChevronRight,
  CircleHelp,
  Hand,
  Home,
  Receipt,
  Search,
  Settings,
  UserRound
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Show } from "@/components/clerk-show";
import { ThemeSwitch } from "@/components/theme-switch";
import type { Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/deals/history", label: "All deals", icon: Archive },
  { href: "/app/payments", label: "Payments", icon: Receipt },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/help", label: "Help", icon: CircleHelp },
  { href: "/app/profile", label: "Profile", icon: UserRound },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

const primaryNavItems = navItems.slice(0, 5);
const secondaryNavItems = navItems.slice(5);

function labelForPath(pathname: string) {
  if (pathname === "/app" || pathname === "/app/dashboard") {
    return {
      section: "Workspace",
      title: "Dashboard"
    };
  }

  if (pathname.startsWith("/app/deals/history")) {
    return {
      section: "Deals",
      title: "All deals"
    };
  }

  if (pathname.startsWith("/app/deals/")) {
    return {
      section: "Deals",
      title: "Deal workspace"
    };
  }

  if (pathname.startsWith("/app/payments")) {
    return {
      section: "Operations",
      title: "Payments"
    };
  }

  if (pathname.startsWith("/app/analytics")) {
    return {
      section: "Operations",
      title: "Analytics"
    };
  }

  if (pathname.startsWith("/app/intake")) {
    return {
      section: "Workspace",
      title: "New workspace"
    };
  }

  if (pathname.startsWith("/app/profile")) {
    return {
      section: "Settings",
      title: "Profile"
    };
  }

  if (pathname.startsWith("/app/settings")) {
    return {
      section: "Settings",
      title: "Settings"
    };
  }

  if (pathname.startsWith("/app/notifications")) {
    return {
      section: "Workspace",
      title: "Notifications"
    };
  }

  if (pathname.startsWith("/app/help")) {
    return {
      section: "Workspace",
      title: "Help"
    };
  }

  return {
    section: "Workspace",
    title: "HelloBrand"
  };
}

export function AppFrame({
  viewer,
  children
}: {
  viewer: Viewer;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement | null>(null);

  const meta = useMemo(() => labelForPath(pathname), [pathname]);
  const handle =
    viewer.displayName.startsWith("@")
      ? viewer.displayName
      : `@${viewer.displayName.toLowerCase().replace(/\s+/g, "")}`;
  const [sidebarQuery, setSidebarQuery] = useState(searchParams.get("q") ?? "");

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

  const handleSidebarSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = sidebarQuery.trim();

    if (normalizedQuery.length === 0) {
      router.push("/app/deals/history");
      return;
    }

    const params = new URLSearchParams();
    params.set("q", normalizedQuery);
    router.push(`/app/deals/history?${params.toString()}`);
  };

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active =
      item.href === "/app"
        ? pathname === "/app" || pathname === "/app/dashboard"
        : item.href === "/app/deals/history"
          ? pathname.startsWith("/app/deals/")
          : pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
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
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-white dark:bg-[#0f1115]">
      <div className="flex h-full overflow-hidden dark:bg-[#0f1115]">
        <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-white lg:flex dark:border-white/10 dark:bg-[#121419]">
          <div className="flex h-[72px] items-center justify-between border-b border-border px-7 dark:border-white/8">
            <Link href="/app" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
                <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
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
                placeholder="Search deals"
                aria-label="Search deals"
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
            <nav className="space-y-1">{primaryNavItems.map(renderNavItem)}</nav>

            <div className="mb-4 mt-8 px-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Preferences
              </p>
            </div>

            <div className="space-y-1">{secondaryNavItems.map(renderNavItem)}</div>
          </div>

          <div className="border-t border-border px-5 py-5 dark:border-white/8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Show when="signed-in">
                  <UserButton />
                </Show>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {viewer.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{handle}</p>
                </div>
              </div>

              <Link
                href="/app/intake/new"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-11 w-full justify-between px-4"
                )}
              >
                <span>New workspace</span>
              </Link>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-[#111318]">
          <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-6 lg:px-8 dark:border-white/8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{meta.section}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="truncate text-foreground">{meta.title}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <ThemeSwitch iconOnly />
            </div>
          </header>

          <main
            ref={mainRef}
            className="workspace-dot-grid flex-1 overflow-auto bg-white dark:bg-[#111318]"
          >
            <div className="min-h-full">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
