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

import { routing } from "@/i18n/routing";

type AppRouteMeta = {
  sectionKey: string;
  titleKey: string;
  section: string;
  title: string;
};

type AppNavItem = {
  href: string;
  labelKey: string;
  label: string;
  icon: LucideIcon;
};

export const appNavItems: AppNavItem[] = [
  { href: "/app", labelKey: "dashboard", label: "Dashboard", icon: Home },
  {
    href: "/app/p/history",
    labelKey: "allPartnerships",
    label: "Partnerships",
    icon: Archive,
  },
  { href: "/app/inbox", labelKey: "inbox", label: "Inbox", icon: Inbox },
  { href: "/app/payments", labelKey: "payments", label: "Payments", icon: Receipt },
  { href: "/app/analytics", labelKey: "analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/help", labelKey: "help", label: "Help", icon: CircleHelp },
  { href: "/app/settings/profile", labelKey: "profile", label: "Profile", icon: UserRound },
  { href: "/app/settings", labelKey: "settings", label: "Settings", icon: Settings },
];

export const primaryAppNavItems = appNavItems.slice(0, 5);
export const secondaryAppNavItems = appNavItems.slice(5);

const localePrefixPattern = new RegExp(`^/(?:${routing.locales.join("|")})(?=/|$)`);

function getAppLocalePrefix(pathname: string) {
  return pathname.match(localePrefixPattern)?.[0] ?? "";
}

export function normalizeAppPathname(pathname: string) {
  const normalized = pathname.replace(localePrefixPattern, "");
  return normalized.length > 0 ? normalized : "/";
}

export function localizeAppHref(href: string, pathname: string) {
  if (!href.startsWith("/")) {
    return href;
  }

  const localePrefix = getAppLocalePrefix(pathname);
  if (!localePrefix || href === localePrefix || href.startsWith(`${localePrefix}/`)) {
    return href;
  }

  return `${localePrefix}${href}`;
}

export function isAppNavItemActive(pathname: string, href: string) {
  const normalizedPathname = normalizeAppPathname(pathname);

  if (href === "/app") {
    return normalizedPathname === "/app" || normalizedPathname === "/app/dashboard";
  }

  if (href === "/app/p/history") {
    return normalizedPathname.startsWith("/app/p/");
  }

  if (href === "/app/settings") {
    return normalizedPathname === "/app/settings";
  }

  return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
}

// fallow-ignore-next-line complexity
export function getAppRouteMeta(pathname: string): AppRouteMeta {
  const normalizedPathname = normalizeAppPathname(pathname);

  if (normalizedPathname === "/app" || normalizedPathname === "/app/dashboard") {
    return {
      sectionKey: "workspace",
      titleKey: "dashboard",
      section: "Workspace",
      title: "Dashboard",
    };
  }

  if (normalizedPathname.startsWith("/app/p/history")) {
    return {
      sectionKey: "partnerships",
      titleKey: "allPartnerships",
      section: "Partnerships",
      title: "Partnerships",
    };
  }

  if (normalizedPathname.startsWith("/app/p/")) {
    return {
      sectionKey: "partnerships",
      titleKey: "partnershipWorkspace",
      section: "Partnerships",
      title: "Partnership workspace",
    };
  }

  if (normalizedPathname.startsWith("/app/inbox")) {
    return { sectionKey: "workspace", titleKey: "inbox", section: "Workspace", title: "Inbox" };
  }

  if (normalizedPathname.startsWith("/app/payments")) {
    return {
      sectionKey: "operations",
      titleKey: "payments",
      section: "Operations",
      title: "Payments",
    };
  }

  if (normalizedPathname.startsWith("/app/analytics")) {
    return {
      sectionKey: "operations",
      titleKey: "analytics",
      section: "Operations",
      title: "Analytics",
    };
  }

  if (normalizedPathname.startsWith("/app/intake")) {
    return {
      sectionKey: "workspace",
      titleKey: "newWorkspace",
      section: "Workspace",
      title: "New workspace",
    };
  }

  if (
    normalizedPathname.startsWith("/app/settings/billing") ||
    normalizedPathname.startsWith("/app/billing")
  ) {
    return {
      sectionKey: "settings",
      titleKey: "billing",
      section: "Settings",
      title: "Billing",
    };
  }

  if (
    normalizedPathname.startsWith("/app/settings/profile") ||
    normalizedPathname.startsWith("/app/profile")
  ) {
    return {
      sectionKey: "settings",
      titleKey: "profile",
      section: "Settings",
      title: "Profile",
    };
  }

  if (
    normalizedPathname.startsWith("/app/settings/notifications") ||
    normalizedPathname.startsWith("/app/notifications")
  ) {
    return {
      sectionKey: "settings",
      titleKey: "notifications",
      section: "Settings",
      title: "Notifications",
    };
  }

  if (normalizedPathname.startsWith("/app/settings")) {
    return {
      sectionKey: "settings",
      titleKey: "settings",
      section: "Settings",
      title: "Settings",
    };
  }

  if (normalizedPathname.startsWith("/app/help")) {
    return { sectionKey: "workspace", titleKey: "help", section: "Workspace", title: "Help" };
  }

  if (normalizedPathname.startsWith("/app/search")) {
    return {
      sectionKey: "workspace",
      titleKey: "search",
      section: "Workspace",
      title: "Search",
    };
  }

  return {
    sectionKey: "workspace",
    titleKey: "helloBrand",
    section: "Workspace",
    title: "HelloBrand",
  };
}
