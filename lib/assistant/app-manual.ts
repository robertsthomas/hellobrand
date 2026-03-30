import { appNavItems, getAppRouteMeta } from "@/lib/app-shell";
import type { AssistantDealTab } from "@/lib/types";

export const assistantDealTabs: AssistantDealTab[] = [
  "overview",
  "terms",
  "risks",
  "deliverables",
  "brief",
  "emails",
  "documents",
  "notes"
];

export const assistantRouteTargets = [
  ...appNavItems.map((item) => ({
    id: item.href,
    label: item.label,
    href: item.href
  })),
  ...assistantDealTabs.map((tab) => ({
    id: `deal-tab:${tab}`,
    label: `Partnership ${tab}`,
    href: tab
  }))
] as const;

export function assistantPageTitle(pathname: string) {
  return getAppRouteMeta(pathname).title;
}

export function isValidAssistantTab(value: string | null | undefined): value is AssistantDealTab {
  return assistantDealTabs.includes(value as AssistantDealTab);
}

export function buildAssistantAppManual() {
  return [
    "You are HelloBrand's action-oriented assistant for creator partnership workflows.",
    "You can answer grounded questions about partnerships, suggest negotiation moves, draft creator-professional replies, and navigate to valid pages or partnership tabs inside the app.",
    "You are not allowed to edit partnership terms, payment status, notes, or other records directly.",
    "Treat snapshot summaries and tool results as the source of truth for partnership facts, dates, money, deliverables, and risks.",
    "Only reference HelloBrand routes that exist in this route catalog:",
    ...appNavItems.map((item) => `- ${item.label}: ${item.href}`),
    `- Partnership tabs: ${assistantDealTabs.join(", ")}`,
    "When discussing partnership facts, rely on provided snapshot summaries or tool results and explicitly acknowledge uncertainty when evidence is missing.",
    "Do not claim to give legal advice. Keep tone direct, practical, and creator-professional."
  ].join("\n");
}

export function buildAssistantHref(
  target: string,
  options?: { dealId?: string | null; tab?: AssistantDealTab | null }
) {
  if (target.startsWith("/app/")) {
    return target;
  }

  if (target.startsWith("deal-tab:")) {
    if (!options?.dealId) {
      return null;
    }

    const tab = target.replace("deal-tab:", "");
    if (!isValidAssistantTab(tab)) {
      return null;
    }

    return `/app/p/${options.dealId}?tab=${tab}`;
  }

  if (options?.dealId && isValidAssistantTab(target)) {
    return `/app/p/${options.dealId}?tab=${target}`;
  }

  return null;
}
