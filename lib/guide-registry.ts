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
  hasWorkspaceNotification: boolean;
  isMobile: boolean;
  dismissedStepIds: Set<string>;
  completedStepIds: Set<string>;
}

const WORKSPACE_TOUR_STEP_IDS = [
  "workspace_overview",
  "workspace_terms",
  "workspace_risks",
  "workspace_deliverables"
];

function isWorkspaceTourDone(ctx: GuideContext) {
  return WORKSPACE_TOUR_STEP_IDS.every(
    (id) => ctx.dismissedStepIds.has(id) || ctx.completedStepIds.has(id)
  );
}

export const GUIDE_STEPS: GuideStep[] = [
  // ── Phase 1: First landing (dashboard, no workspaces) ──
  {
    id: "welcome_start_here",
    title: "Start here",
    body: "Upload a contract, brief, or email from a brand. HelloBrand extracts the terms, flags risks, and builds your workspace automatically.",
    anchorSelector: '[data-guide="add-documents"]',
    routeMatch: /^\/app$/,
    side: "bottom",
    autoCompleteCondition: (ctx) =>
      ctx.hasActiveWorkspace || ctx.hasWorkspaceNotification
  },

  // ── Phase 2: Workspace generating ──
  {
    id: "workspace_generating",
    title: "Your workspace is being built",
    body: "We're analyzing your documents now. You'll get a notification here when it's ready to review.",
    anchorSelector: '[data-guide="header-notifications"]',
    routeMatch: /^\/app$/,
    side: "bottom",
    eligibility: (ctx) => ctx.hasWorkspaceNotification
  },

  // ── Phase 2b: Nudge to open workspace (dashboard, has workspaces) ──
  {
    id: "open_first_workspace",
    title: "Open your workspace",
    body: "Click into a partnership to see the terms, risks, and deliverables HelloBrand extracted from your documents.",
    anchorSelector: '[data-guide="active-partnerships"]',
    routeMatch: /^\/app$/,
    side: "top",
    eligibility: (ctx) => ctx.hasActiveWorkspace && !isWorkspaceTourDone(ctx)
  },

  // ── Phase 3: Workspace tour (partnership page) ──
  {
    id: "workspace_overview",
    title: "Your partnership workspace",
    body: "Everything HelloBrand extracted from your documents lives here. Use the tabs to review terms, check risks, and track deliverables.",
    anchorSelector: '[data-guide="workspace-tabs"]',
    routeMatch: /^\/app\/p\/[^/]+$/,
    side: "bottom"
  },
  {
    id: "workspace_terms",
    title: "Review your contract terms",
    body: "Payment amounts, usage rights, exclusivity, and deadlines are extracted automatically. You can edit any field if something looks off.",
    anchorSelector: '[data-guide="tab-terms"]',
    routeMatch: /^\/app\/p\/[^/]+$/,
    side: "bottom"
  },
  {
    id: "workspace_risks",
    title: "Check flagged risks",
    body: "HelloBrand highlights clauses that could cost you money or limit your future work. Review these before signing.",
    anchorSelector: '[data-guide="tab-risks"]',
    routeMatch: /^\/app\/p\/[^/]+$/,
    side: "bottom"
  },
  {
    id: "workspace_deliverables",
    title: "Track what you owe",
    body: "Deliverables, due dates, and posting requirements extracted from your contract. The dashboard will remind you when things are due.",
    anchorSelector: '[data-guide="tab-deliverables"]',
    routeMatch: /^\/app\/p\/[^/]+$/,
    side: "bottom"
  },

  // ── Phase 4: Contextual discovery ──
  {
    id: "assistant_intro",
    title: "Your AI assistant",
    body: "Ask questions about your contracts, draft negotiation emails, or get help with any partnership decision.",
    anchorSelector: '[data-guide="assistant-fab"]',
    routeMatch: "/app",
    side: "top",
    eligibility: (ctx) => isWorkspaceTourDone(ctx)
  },
  {
    id: "payments_intro",
    title: "Payment tracking",
    body: "All invoices, due dates, and payment statuses across your partnerships in one view. Overdue payments surface on your dashboard automatically.",
    anchorSelector: '[data-guide="payments-summary"]',
    routeMatch: /^\/app\/payments$/,
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
