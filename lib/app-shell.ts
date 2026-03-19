import {
  Archive,
  BarChart3,
  Bell,
  CircleHelp,
  Home,
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
  { href: "/app/deals/history", label: "All deals", icon: Archive },
  { href: "/app/payments", label: "Payments", icon: Receipt },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/help", label: "Help", icon: CircleHelp },
  { href: "/app/profile", label: "Profile", icon: UserRound },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

export const primaryAppNavItems = appNavItems.slice(0, 5);
export const secondaryAppNavItems = appNavItems.slice(5);

export function getAppRouteMeta(pathname: string): AppRouteMeta {
  if (pathname === "/app" || pathname === "/app/dashboard") {
    return { section: "Workspace", title: "Dashboard" };
  }

  if (pathname.startsWith("/app/deals/history")) {
    return { section: "Deals", title: "All deals" };
  }

  if (pathname.startsWith("/app/deals/")) {
    return { section: "Deals", title: "Deal workspace" };
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

  if (pathname.startsWith("/app/profile")) {
    return { section: "Settings", title: "Profile" };
  }

  if (pathname.startsWith("/app/settings")) {
    return { section: "Settings", title: "Settings" };
  }

  if (pathname.startsWith("/app/notifications")) {
    return { section: "Workspace", title: "Notifications" };
  }

  if (pathname.startsWith("/app/help")) {
    return { section: "Workspace", title: "Help" };
  }

  if (pathname.startsWith("/app/search")) {
    return { section: "Workspace", title: "Search" };
  }

  return { section: "Workspace", title: "HelloBrand" };
}
