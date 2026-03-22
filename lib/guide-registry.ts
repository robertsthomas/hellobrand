export interface GuideStep {
  id: string;
  title: string;
  body: string;
  anchorSelector: string;
  routeMatch: RegExp | string;
  side?: "top" | "bottom" | "left" | "right";
  eligibility?: (ctx: GuideContext) => boolean;
  autoCompleteCondition?: (ctx: GuideContext) => boolean;
}

export interface GuideContext {
  pathname: string;
  hasActiveWorkspace: boolean;
  dismissedStepIds: Set<string>;
  completedStepIds: Set<string>;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "create_workspace",
    title: "Create your first workspace",
    body: "Upload a contract, brief, or email thread to build a partnership workspace with extracted terms and AI analysis.",
    anchorSelector: '[data-guide="sidebar-new-workspace"]',
    routeMatch: "/app",
    side: "right",
    autoCompleteCondition: (ctx) => ctx.hasActiveWorkspace
  },
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
  },
  {
    id: "sidebar_inbox",
    title: "Your inbox at a glance",
    body: "The Inbox aggregates email threads linked to your partnerships. Deal matches appear here automatically.",
    anchorSelector: '[data-guide="sidebar-inbox"]',
    routeMatch: "/app",
    side: "right"
  },
  {
    id: "sidebar_payments",
    title: "Track your payments",
    body: "See all invoices, due dates, and payment statuses across partnerships in one place.",
    anchorSelector: '[data-guide="sidebar-payments"]',
    routeMatch: "/app",
    side: "right"
  },
  {
    id: "sidebar_analytics",
    title: "Analytics overview",
    body: "View earnings trends, deal velocity, and portfolio insights to understand your creator business.",
    anchorSelector: '[data-guide="sidebar-analytics"]',
    routeMatch: "/app",
    side: "right"
  },
  {
    id: "sidebar_settings",
    title: "Customize your settings",
    body: "Update your profile, notification preferences, billing, and accent color from Settings.",
    anchorSelector: '[data-guide="sidebar-settings"]',
    routeMatch: "/app",
    side: "right"
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
    if (step.eligibility && !step.eligibility(ctx)) continue;
    if (step.autoCompleteCondition && step.autoCompleteCondition(ctx)) continue;

    return step;
  }

  return null;
}
