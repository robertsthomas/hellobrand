export interface GuideStep {
  id: string;
  title: string;
  body: string;
  anchorSelector: string;
  routeMatch: RegExp | string;
  side?: "top" | "bottom" | "left" | "right";
  desktopOnly?: boolean;
  eligibility?: (ctx: GuideContext) => boolean;
  autoCompleteCondition?: (ctx: GuideContext) => boolean;
}

export interface GuideContext {
  pathname: string;
  hasActiveWorkspace: boolean;
  isMobile: boolean;
  dismissedStepIds: Set<string>;
  completedStepIds: Set<string>;
}

export const GUIDE_STEPS: GuideStep[] = [
  // Sidebar tour — shown first on dashboard for new users
  {
    id: "sidebar_new_workspace",
    title: "Create a new workspace",
    body: "Each partnership gets its own workspace. Upload contracts, briefs, or emails to get started.",
    anchorSelector: '[data-guide="sidebar-new-workspace"]',
    routeMatch: "/app",
    side: "right",
    desktopOnly: true // tooltip only on desktop; modal on mobile
  },
  {
    id: "sidebar_inbox",
    title: "Your inbox at a glance",
    body: "The Inbox aggregates email threads linked to your partnerships. Deal matches appear here automatically.",
    anchorSelector: '[data-guide="sidebar-inbox"]',
    routeMatch: "/app",
    side: "right",
    desktopOnly: true // tooltip only on desktop; modal on mobile
  },
  {
    id: "sidebar_payments",
    title: "Track your payments",
    body: "See all invoices, due dates, and payment statuses across partnerships in one place.",
    anchorSelector: '[data-guide="sidebar-payments"]',
    routeMatch: "/app",
    side: "right",
    desktopOnly: true // tooltip only on desktop; modal on mobile
  },
  {
    id: "sidebar_analytics",
    title: "Analytics overview",
    body: "View earnings trends, deal velocity, and portfolio insights to understand your creator business.",
    anchorSelector: '[data-guide="sidebar-analytics"]',
    routeMatch: "/app",
    side: "right",
    desktopOnly: true // tooltip only on desktop; modal on mobile
  },
  {
    id: "sidebar_settings",
    title: "Customize your settings",
    body: "Update your profile, notification preferences, billing, and accent color from Settings.",
    anchorSelector: '[data-guide="sidebar-settings"]',
    routeMatch: "/app",
    side: "right",
    desktopOnly: true // tooltip only on desktop; modal on mobile
  },
  // Add documents — shown on intake/new workspace page
  {
    id: "add_first_documents",
    title: "Add your first documents",
    body: "Upload a contract, brief, or email thread. HelloBrand will extract terms, flag risks, and build your workspace.",
    anchorSelector: '[data-guide="add-documents"]',
    routeMatch: "/app",
    side: "bottom",
    autoCompleteCondition: (ctx) => ctx.hasActiveWorkspace
  },
  // Notifications — shown after first workspace starts generating
  {
    id: "notifications_workspace_generating",
    title: "Your workspace is generating",
    body: "We're analyzing your documents in the background. Check the notifications drawer for status updates — you'll see when it's done.",
    anchorSelector: '[data-guide="header-notifications"]',
    routeMatch: "/app",
    side: "bottom",
    eligibility: (ctx) => ctx.hasActiveWorkspace
  },
  // AI assistant — shown on any app route
  {
    id: "assistant_intro",
    title: "Meet your AI assistant",
    body: "Ask questions about your deals, draft negotiation emails, or get help understanding contract terms. Available anywhere in the app.",
    anchorSelector: '[data-guide="assistant-fab"]',
    routeMatch: "/app",
    side: "top"
  },
  // Deal workspace tabs — shown when viewing a deal
  {
    id: "workspace_tabs_intro",
    title: "Explore your workspace tabs",
    body: "Each workspace has tabs for the overview, terms, risks, deliverables, brief, emails, documents, and notes.",
    anchorSelector: '[data-guide="workspace-tabs"]',
    routeMatch: /^\/app\/deals\/[^/]+$/,
    side: "bottom"
  },
  {
    id: "brief_tab_tip",
    title: "Check the brief tab",
    body: "If your deal includes a campaign brief, you'll find the extracted creative direction, requirements, and timelines here.",
    anchorSelector: '[data-guide="tab-brief"]',
    routeMatch: /^\/app\/deals\/[^/]+$/,
    side: "bottom"
  },
  {
    id: "documents_tab_tip",
    title: "Manage your documents",
    body: "View, re-upload, or add new documents to your workspace. HelloBrand re-analyzes terms when you add new files.",
    anchorSelector: '[data-guide="tab-documents"]',
    routeMatch: /^\/app\/deals\/[^/]+$/,
    side: "bottom"
  },
  {
    id: "emails_tab_tip",
    title: "Connected email insights",
    body: "When you connect your email, HelloBrand tracks brand communications, surfaces action items, and suggests term updates.",
    anchorSelector: '[data-guide="tab-emails"]',
    routeMatch: /^\/app\/deals\/[^/]+$/,
    side: "bottom"
  }
];

export function getActiveGuideStep(
  steps: GuideStep[],
  ctx: GuideContext
): GuideStep | null {
  for (const step of steps) {
    if (ctx.dismissedStepIds.has(step.id) || ctx.completedStepIds.has(step.id))
      continue;

    const routeMatches =
      typeof step.routeMatch === "string"
        ? ctx.pathname === step.routeMatch ||
          ctx.pathname.startsWith(step.routeMatch + "/")
        : step.routeMatch.test(ctx.pathname);

    if (!routeMatches) continue;
    if (step.desktopOnly && ctx.isMobile) continue;
    if (step.eligibility && !step.eligibility(ctx)) continue;
    if (step.autoCompleteCondition && step.autoCompleteCondition(ctx)) continue;

    return step;
  }

  return null;
}
