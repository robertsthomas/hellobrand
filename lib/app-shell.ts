import {
  Archive,
  BarChart3,
  CircleHelp,
  Home,
  Inbox,
  Receipt,
  Settings,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppRouteMeta = {
  section: string;
  title: string;
};

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const appNavItems: AppNavItem[] = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/p/history", label: "All partnerships", icon: Archive },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/payments", label: "Payments", icon: Receipt },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/help", label: "Help", icon: CircleHelp },
  { href: "/app/settings/profile", label: "Profile", icon: UserRound },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

export const primaryAppNavItems = appNavItems.slice(0, 5);
export const secondaryAppNavItems = appNavItems.slice(5);

export function isAppNavItemActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === "/app" || pathname === "/app/dashboard";
  }

  if (href === "/app/p/history") {
    return pathname.startsWith("/app/p/");
  }

  if (href === "/app/settings") {
    return pathname === "/app/settings";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAppRouteMeta(pathname: string): AppRouteMeta {
  if (pathname === "/app" || pathname === "/app/dashboard") {
    return { section: "Workspace", title: "Dashboard" };
  }

  if (pathname.startsWith("/app/p/history")) {
    return { section: "Partnerships", title: "All partnerships" };
  }

  if (pathname.startsWith("/app/p/")) {
    return { section: "Partnerships", title: "Partnership workspace" };
  }

  if (pathname.startsWith("/app/inbox")) {
    return { section: "Workspace", title: "Inbox" };
  }

  if (pathname.startsWith("/app/payments")) {
    return { section: "Operations", title: "Payments" };
  }

  if (pathname.startsWith("/app/analytics")) {
    return { section: "Operations", title: "Analytics" };
  }

  if (pathname.startsWith("/app/intake")) {
    return { section: "Workspace", title: "New workspace" };
  }

  if (pathname.startsWith("/app/settings/billing") || pathname.startsWith("/app/billing")) {
    return { section: "Settings", title: "Billing" };
  }

  if (pathname.startsWith("/app/settings/profile") || pathname.startsWith("/app/profile")) {
    return { section: "Settings", title: "Profile" };
  }

  if (pathname.startsWith("/app/settings/notifications") || pathname.startsWith("/app/notifications")) {
    return { section: "Settings", title: "Notifications" };
  }

  if (pathname.startsWith("/app/settings")) {
    return { section: "Settings", title: "Settings" };
  }

  if (pathname.startsWith("/app/help")) {
    return { section: "Workspace", title: "Help" };
  }

  if (pathname.startsWith("/app/search")) {
    return { section: "Workspace", title: "Search" };
  }

  return { section: "Workspace", title: "HelloBrand" };
}
