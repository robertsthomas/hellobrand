"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  Bell,
  CircleHelp,
  Home,
  Moon,
  Receipt,
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

export function AppFrame({
  viewer,
  children
}: {
  viewer: Viewer;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const handle = `@${viewer.displayName.toLowerCase().replace(/\s+/g, "")}`;
  const navItemClassName =
    "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium";

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active =
      item.href === "/app"
        ? pathname === "/app" || pathname === "/app/dashboard"
        : pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          navItemClassName,
          "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-[#f5f3f0] lg:flex dark:bg-[#22201d]">
          <div className="border-b border-border px-6 py-7">
            <Link href="/" className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <span className="text-xl font-semibold">H</span>
              </div>
              <span className="text-[18px] font-semibold tracking-tight text-foreground">
                HelloBrand
              </span>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-6">
            {primaryNavItems.map(renderNavItem)}
          </nav>

          <div className="space-y-3 px-3 pb-6">
            <div className="flex h-11 items-center justify-between rounded-xl px-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5" />
                <span className="font-medium">Dark mode</span>
              </div>
              <ThemeSwitch minimal />
            </div>
            {secondaryNavItems.map(renderNavItem)}
            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                <Show when="signed-in">
                  <UserButton />
                </Show>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {viewer.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{handle}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="lg:hidden">
            <div className="flex items-center justify-between border-b border-border bg-[#f5f3f0] px-5 py-4 dark:bg-[#22201d]">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="font-semibold">H</span>
                </div>
                <span className="text-lg font-semibold tracking-tight">HelloBrand</span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeSwitch compact className="rounded-xl" />
                <Link
                  href="/app/intake/new"
                  className={buttonVariants({ size: "sm" })}
                >
                  Upload documents
                </Link>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
