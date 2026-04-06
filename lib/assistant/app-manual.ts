import { appNavItems, getAppRouteMeta } from "@/lib/app-shell";
import type { AssistantDealTab, AssistantPageContext } from "@/lib/types";

function normalizeRouteTarget(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/^app\//, "")
    .replace(/\b(tab|page|screen|route)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const assistantAppRouteAliases = new Map<string, string>([
  ["dashboard", "/app"],
  ["home", "/app"],
  ["all partnerships", "/app/p/history"],
  ["partnerships", "/app/p/history"],
  ["history", "/app/p/history"],
  ["inbox", "/app/inbox"],
  ["payments", "/app/payments"],
  ["analytics", "/app/analytics"],
  ["help", "/app/help"],
  ["search", "/app/search"],
  ["new workspace", "/app/intake"],
  ["workspace intake", "/app/intake"],
  ["intake", "/app/intake"],
  ["profile", "/app/settings/profile"],
  ["settings", "/app/settings"],
  ["billing", "/app/settings/billing"],
  ["notifications", "/app/settings/notifications"]
]);

for (const item of appNavItems) {
  assistantAppRouteAliases.set(normalizeRouteTarget(item.label), item.href);
  assistantAppRouteAliases.set(normalizeRouteTarget(item.href), item.href);

  const hrefParts = item.href.split("/").filter(Boolean);
  const lastPart = hrefParts[hrefParts.length - 1];

  if (lastPart) {
    assistantAppRouteAliases.set(normalizeRouteTarget(lastPart), item.href);
  }
}

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

const assistantDealTabAliases = new Map<string, AssistantDealTab>([
  ["overview", "overview"],
  ["summary", "overview"],
  ["terms", "terms"],
  ["risk", "risks"],
  ["risks", "risks"],
  ["deliverable", "deliverables"],
  ["deliverables", "deliverables"],
  ["brief", "brief"],
  ["briefs", "brief"],
  ["email", "emails"],
  ["emails", "emails"],
  ["document", "documents"],
  ["documents", "documents"],
  ["note", "notes"],
  ["notes", "notes"]
]);

const pageContextRegistry: Record<string, AssistantPageContext> = {
  "/app": {
    purpose: "The main dashboard showing an at-a-glance overview of the creator's partnership portfolio, upcoming deadlines, and recent activity.",
    availableActions: [
      "View a summary of active partnerships and their status",
      "See upcoming deliverable deadlines and next actions",
      "Quick-access recent or featured workspaces",
      "Navigate to any section via the sidebar"
    ],
    dataHints: [
      "Shows high-level portfolio metrics (active deals, pending actions, overdue items)",
      "Surfaces the most time-sensitive items across all workspaces",
      "Does not show detailed contract terms or full deal data"
    ]
  },
  "/app/p/history": {
    purpose: "A list view of all partnerships, allowing the creator to browse, search, and filter their deal portfolio.",
    availableActions: [
      "Browse all partnerships with status and payment indicators",
      "Search or filter partnerships by brand or campaign name",
      "Open any partnership workspace",
      "See high-level status at a glance (risk flags, payment status)"
    ],
    dataHints: [
      "Shows a list of deal cards with brand name, campaign name, status, and risk count",
      "Does not show detailed terms, deliverables, or evidence",
      "Each deal card links to the full partnership workspace"
    ]
  },
  "/app/p/[dealId]": {
    purpose: "The partnership workspace for a specific deal, with tabs for overview, terms, deliverables, invoices, emails, and documents.",
    availableActions: [
      "Overview tab: view partnership summary, next action, attention items, conflicts, and disclosure obligations",
      "Terms tab: review extracted terms, risk flags, and evidence",
      "Deliverables tab: view deliverable tracker, deliverables list, brief overview, and brief generation",
      "Invoices tab: view invoice details, status, due dates, and download PDFs (only when an invoice exists)",
      "Emails tab: view linked email threads and negotiation communication (requires premium inbox)",
      "Documents tab: upload and manage contract documents",
      "Delete the partnership from the workspace footer"
    ],
    dataHints: [
      "The active tab is indicated by the ?tab= query parameter",
      "Overview shows next action, attention items, conflicts, and partnership summary",
      "Terms shows risk flags, extracted terms, and evidence snippets",
      "Deliverables shows the deliverable tracker, list, and brief sections",
      "Invoices tab only appears when the workspace has an invoice record",
      "Emails require premium inbox entitlement to show linked threads",
      "Documents panel shows uploaded files and an upload form"
    ]
  },
  "/app/p/[dealId]/invoice": {
    purpose: "The invoice editor for a specific partnership, used to create or edit an invoice from workspace deliverables and payment terms.",
    availableActions: [
      "Create a new invoice from deliverables and payment terms",
      "Edit an existing invoice",
      "Preview and download the invoice PDF",
      "Send the invoice to a brand contact"
    ],
    dataHints: [
      "Invoice is pre-populated from workspace deliverables and payment terms",
      "Shows invoice number, status, due date, subtotal, and currency",
      "Can generate a PDF document for the invoice"
    ]
  },
  "/app/p/[dealId]/delete": {
    purpose: "The delete confirmation page for a specific partnership.",
    availableActions: [
      "Confirm deletion of the partnership and all associated data",
      "Cancel and return to the partnership workspace"
    ],
    dataHints: [
      "This is a destructive action that removes the workspace permanently",
      "The user must confirm before deletion proceeds"
    ]
  },
  "/app/inbox": {
    purpose: "The creator's email inbox for managing communication with brands and handling negotiation threads.",
    availableActions: [
      "View and manage email threads with brands",
      "Search and filter inbox threads",
      "Open individual threads to read and respond",
      "Draft replies using the assistant"
    ],
    dataHints: [
      "Shows a list of email threads with brand contacts",
      "Threads may be linked to specific partnership workspaces",
      "Premium inbox features include linked threads and negotiation context"
    ]
  },
  "/app/payments": {
    purpose: "A centralized view of all payment activity across the creator's partnerships, including payment status, amounts, and invoicing.",
    availableActions: [
      "View payment history and upcoming payouts",
      "Filter payments by status (paid, pending, late, awaiting payment)",
      "Track invoice status and due dates",
      "Navigate to specific partnership payment details"
    ],
    dataHints: [
      "Shows payment records across all partnerships",
      "Includes payment amounts, dates, status, and associated workspace",
      "Does not show detailed contract terms or deliverable specifics"
    ]
  },
  "/app/analytics": {
    purpose: "Analytics and reporting for the creator's partnership performance, earnings, and portfolio trends.",
    availableActions: [
      "View earnings trends and totals over time",
      "Analyze partnership performance metrics",
      "Track portfolio growth and activity",
      "Filter analytics by time range and status"
    ],
    dataHints: [
      "Shows aggregated metrics across the creator's portfolio",
      "Includes earnings, deal counts, and performance trends",
      "Does not show individual contract details or terms"
    ]
  },
  "/app/intake": {
    purpose: "The workspace intake form for creating a new partnership workspace by uploading contracts or entering deal details.",
    availableActions: [
      "Upload contract documents for extraction",
      "Enter brand and campaign information manually",
      "Create a new partnership workspace",
      "Start the AI extraction pipeline"
    ],
    dataHints: [
      "Supports document upload (PDF, DOCX) for automated term extraction",
      "Creates a new workspace with extracted terms, risks, and deliverables",
      "Extraction runs asynchronously after upload"
    ]
  },
  "/app/settings": {
    purpose: "The settings hub for managing account preferences, profile information, billing, and notifications.",
    availableActions: [
      "Navigate to profile settings",
      "Navigate to billing and subscription management",
      "Navigate to notification preferences",
      "Manage account-level preferences"
    ],
    dataHints: [
      "Central hub linking to profile, billing, and notification sub-pages",
      "Does not contain detailed settings content itself"
    ]
  },
  "/app/settings/profile": {
    purpose: "Profile settings for managing the creator's display name, signature, location, and payout details.",
    availableActions: [
      "Update display name and preferred signature",
      "Set location context for the assistant",
      "Configure payout details and payment preferences",
      "Manage profile visibility settings"
    ],
    dataHints: [
      "Profile location is used by the assistant for location-aware suggestions",
      "Payout details affect payment and invoicing context",
      "Preferred signature is used in email drafts"
    ]
  },
  "/app/settings/billing": {
    purpose: "Billing and subscription management, including current plan, usage, and upgrade options.",
    availableActions: [
      "View current subscription plan and tier",
      "Manage billing history and payment methods",
      "Upgrade or change subscription tier",
      "View feature entitlements by tier"
    ],
    dataHints: [
      "Shows current tier (Basic, Standard, Premium) and feature access",
      "Premium inbox and brief generation are tier-gated features",
      "Billing insights may show creator earnings vs subscription cost"
    ]
  },
  "/app/settings/notifications": {
    purpose: "Notification preferences for managing email alerts, in-app notifications, and alert triggers.",
    availableActions: [
      "Configure email notification preferences",
      "Set in-app notification triggers",
      "Manage alert frequency and categories",
      "Configure notification email templates"
    ],
    dataHints: [
      "Controls which events trigger notifications (risk flags, payment changes, deadlines)",
      "Notification emails follow a standardized subject-line and template system"
    ]
  },
  "/app/help": {
    purpose: "Help and support center for learning about HelloBrand features, getting started guides, and troubleshooting.",
    availableActions: [
      "Browse feature documentation and guides",
      "Search for help topics",
      "Access getting started tutorials",
      "Find answers to common questions"
    ],
    dataHints: [
      "Contains documentation about HelloBrand features and workflows",
      "Does not contain user-specific data or deal information"
    ]
  },
  "/app/search": {
    purpose: "Global search across the creator's partnerships, documents, emails, and workspace content.",
    availableActions: [
      "Search partnerships by brand or campaign name",
      "Search within workspace documents and terms",
      "Find specific emails or threads",
      "Navigate directly to search results"
    ],
    dataHints: [
      "Searches across all accessible workspace content",
      "Results link directly to the relevant workspace or page"
    ]
  }
};

function matchPageContext(pathname: string): AssistantPageContext | null {
  if (pathname === "/app" || pathname === "/app/dashboard") {
    return pageContextRegistry["/app"];
  }
  if (pathname.startsWith("/app/p/history")) {
    return pageContextRegistry["/app/p/history"];
  }
  if (pathname.startsWith("/app/p/") && pathname.includes("/invoice")) {
    return pageContextRegistry["/app/p/[dealId]/invoice"];
  }
  if (pathname.startsWith("/app/p/") && pathname.includes("/delete")) {
    return pageContextRegistry["/app/p/[dealId]/delete"];
  }
  if (pathname.startsWith("/app/p/")) {
    return pageContextRegistry["/app/p/[dealId]"];
  }
  if (pathname.startsWith("/app/inbox")) {
    return pageContextRegistry["/app/inbox"];
  }
  if (pathname.startsWith("/app/payments")) {
    return pageContextRegistry["/app/payments"];
  }
  if (pathname.startsWith("/app/analytics")) {
    return pageContextRegistry["/app/analytics"];
  }
  if (pathname.startsWith("/app/intake")) {
    return pageContextRegistry["/app/intake"];
  }
  if (pathname.startsWith("/app/settings/billing") || pathname.startsWith("/app/billing")) {
    return pageContextRegistry["/app/settings/billing"];
  }
  if (pathname.startsWith("/app/settings/profile") || pathname.startsWith("/app/profile")) {
    return pageContextRegistry["/app/settings/profile"];
  }
  if (pathname.startsWith("/app/settings/notifications") || pathname.startsWith("/app/notifications")) {
    return pageContextRegistry["/app/settings/notifications"];
  }
  if (pathname.startsWith("/app/settings")) {
    return pageContextRegistry["/app/settings"];
  }
  if (pathname.startsWith("/app/help")) {
    return pageContextRegistry["/app/help"];
  }
  if (pathname.startsWith("/app/search")) {
    return pageContextRegistry["/app/search"];
  }
  return null;
}

export function getPageContext(pathname: string): AssistantPageContext | null {
  return matchPageContext(pathname);
}

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
    "HelloBrand is creator-first deal intelligence, not generic document chat. Help the creator answer: what they need to post, when it is due, how much they get paid, what is risky or unusual, and where documents disagree.",
    "You are not allowed to edit partnership terms, payment status, notes, or other records directly.",
    "Treat snapshot summaries and tool results as the source of truth for partnership facts, dates, money, deliverables, and risks.",
    "When documents, summaries, or thread facts conflict, flag the mismatch, cite the source or workspace evidence when available, and ask focused clarifying questions instead of silently choosing a winner.",
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
  if (target === "/app" || target.startsWith("/app/")) {
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

  const normalizedTarget = normalizeRouteTarget(target);
  const tabTarget = assistantDealTabAliases.get(normalizedTarget) ?? (isValidAssistantTab(target) ? target : null);

  if (options?.dealId && tabTarget) {
    return `/app/p/${options.dealId}?tab=${tabTarget}`;
  }

  const appHref = assistantAppRouteAliases.get(normalizedTarget);
  if (appHref) {
    return appHref;
  }

  return null;
}
