/**
 * Helpers for the workspace detail route.
 * This file keeps route data loading and workspace-specific display logic out of the page component.
 */
import { getDisplayDealLabels } from "@/lib/deal-labels";
import {
  listEmailAccountsForViewer,
  listLinkedEmailThreadsForViewerDeal,
} from "@/lib/email/service";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import type { DealAggregate, Viewer } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { deriveWorkspaceTitleFromFileNames } from "@/lib/workspace-labels";

function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function buildNextAction(deal: {
  status: string;
  paymentStatus: string;
  nextDeliverableDate: string | null;
  riskFlags: Array<{ severity: string }>;
  pendingExtraction: boolean;
}) {
  if (deal.pendingExtraction) {
    return {
      label: "Review new changes from re-extraction",
      tone: "accent" as const,
      tab: "terms",
    };
  }
  if (deal.paymentStatus === "late") {
    return { label: "Send payment follow-up", tone: "warning" as const, tab: "deliverables" };
  }
  if (deal.riskFlags.some((flag) => flag.severity === "high")) {
    return { label: "Review high-risk clauses", tone: "warning" as const, tab: "terms" };
  }
  const days = daysUntil(deal.nextDeliverableDate);
  if (days !== null && days >= 0 && days <= 7) {
    return { label: "Prepare the next deliverable", tone: "accent" as const, tab: "deliverables" };
  }
  if (deal.status === "contract_received") {
    return { label: "Review contract and confirm terms", tone: "accent" as const, tab: "terms" };
  }
  if (deal.paymentStatus === "awaiting_payment") {
    return { label: "Track payout progress", tone: "neutral" as const, tab: "deliverables" };
  }
  return { label: "Partnership is on track", tone: "neutral" as const, tab: "overview" };
}

export function nextActionToneClass(tone: "warning" | "accent" | "neutral") {
  if (tone === "warning") return "border-clay/20 bg-clay/[0.04] dark:border-clay/25";
  if (tone === "accent")
    return "border-[#d7e7df] bg-[#f3f8f5] dark:border-[#294137] dark:bg-[#12201a]";
  return "border-black/8 bg-sand/35 dark:border-white/10 dark:bg-white/[0.04]";
}

export function resolveWorkspaceTab(input: {
  hasInvoice: boolean;
  rawTab: string;
  hasPendingExtraction: boolean;
}) {
  const validTabs = input.hasInvoice
    ? ["overview", "terms", "deliverables", "invoices", "emails", "documents"]
    : ["overview", "terms", "deliverables", "emails", "documents"];
  const tabRedirects: Record<string, string> = {
    ...(input.hasInvoice ? {} : { invoices: "deliverables" }),
    risks: "terms",
    brief: "deliverables",
    notes: "overview",
  };
  const resolvedTab = tabRedirects[input.rawTab] ?? input.rawTab;

  return validTabs.includes(resolvedTab)
    ? resolvedTab
    : input.hasPendingExtraction
      ? "terms"
      : "overview";
}

export function buildWorkspaceAttentionItems(aggregate: DealAggregate) {
  const attentionItems: Array<{ id: string; label: string; detail?: string }> = [];
  const highRiskCount = aggregate.riskFlags.filter((flag) => flag.severity === "high").length;

  if (aggregate.terms?.pendingExtraction) {
    attentionItems.push({ id: "pending", label: "New extraction changes ready to review" });
  }
  if (highRiskCount > 0) {
    attentionItems.push({
      id: "risks",
      label: `${highRiskCount} high-risk clause${highRiskCount === 1 ? "" : "s"} flagged`,
    });
  }
  if (aggregate.deal.paymentStatus === "late") {
    attentionItems.push({ id: "payment", label: "Payment is overdue" });
  }
  if ((aggregate.conflictResults?.length ?? 0) > 0) {
    attentionItems.push({
      id: "conflicts",
      label: `${aggregate.conflictResults.length} cross-partnership conflict${aggregate.conflictResults.length === 1 ? "" : "s"}`,
    });
  }

  return attentionItems;
}

export function buildWorkspaceDisplayState(aggregate: DealAggregate) {
  const normalized = buildNormalizedIntakeRecord(aggregate);
  const displayLabels = getDisplayDealLabels({
    brandName: normalized?.brandName ?? aggregate.deal.brandName,
    campaignName: normalized?.contractTitle ?? aggregate.deal.campaignName,
  });

  return {
    normalized,
    displayCampaignName:
      displayLabels.campaignName ??
      normalized?.contractTitle ??
      deriveWorkspaceTitleFromFileNames(aggregate.documents.map((document) => document.fileName)) ??
      aggregate.deal.campaignName,
    displayBrandName: displayLabels.brandName ?? aggregate.deal.brandName,
    nextDeliverableValue: formatDate(aggregate.deal.nextDeliverableDate),
  };
}

export async function loadWorkspaceRouteData(
  viewer: Viewer,
  dealId: string,
  hasPremiumInbox: boolean
) {
  const aggregatePromise = import("@/lib/cached-data").then(({ getCachedDealForViewer }) =>
    getCachedDealForViewer(viewer, dealId)
  );
  const routeEmailsPromise = hasPremiumInbox
    ? Promise.all([
        listLinkedEmailThreadsForViewerDeal(viewer, dealId),
        listEmailAccountsForViewer(viewer),
      ])
    : Promise.resolve([[], []] as [
        Awaited<ReturnType<typeof listLinkedEmailThreadsForViewerDeal>>,
        Awaited<ReturnType<typeof listEmailAccountsForViewer>>,
      ]);
  const [aggregate, routeEmails] = await Promise.all([aggregatePromise, routeEmailsPromise]);

  return {
    aggregate,
    linkedEmailThreads: routeEmails[0],
    emailAccounts: routeEmails[1],
  };
}
