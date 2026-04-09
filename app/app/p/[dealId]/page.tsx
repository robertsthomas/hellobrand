import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import { Suspense } from "react";
import { PlanTier } from "@prisma/client";

import {
  BriefGenerator,
  BriefOverview,
  ConflictWarnings,
  DealEmailPanel,
  DealNotesDrawer,
  DealSummaryPanel,
  DeleteDealDialog,
  DeliverablesList,
  DeliverableTracker,
  DisclosureObligations,
  DocumentsPanel,
  FeatureUpgradeCard,
  PendingChangesBanner,
  RiskFlags,
  ScrollableTabsList,
  TermsEditor,
  UploadContractForm,
  WorkspaceDetailHeader,
  WorkspaceTabs,
} from "@/components/workspace";
import { DealDetailSkeleton } from "@/components/skeletons";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getCachedDealForViewer } from "@/lib/cached-data";
import { dealCategoryLabel } from "@/lib/conflict-intelligence";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { listEmailAccountsForViewer, listLinkedEmailThreadsForViewerDeal } from "@/lib/email/service";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";

import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";
import { deriveWorkspaceTitleFromFileNames } from "@/lib/workspace-labels";

function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function buildNextAction(deal: {
  status: string;
  paymentStatus: string;
  nextDeliverableDate: string | null;
  riskFlags: Array<{ severity: string }>;
  pendingExtraction: boolean;
}) {
  if (deal.pendingExtraction) {
    return { label: "Review new changes from re-extraction", tone: "accent" as const, tab: "terms" };
  }
  if (deal.paymentStatus === "late") {
    return { label: "Send payment follow-up", tone: "warning" as const, tab: "deliverables" };
  }
  if (deal.riskFlags.some((f) => f.severity === "high")) {
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

function nextActionToneClass(tone: "warning" | "accent" | "neutral") {
  if (tone === "warning") return "border-clay/20 bg-clay/[0.04] dark:border-clay/25";
  if (tone === "accent") return "border-[#d7e7df] bg-[#f3f8f5] dark:border-[#294137] dark:bg-[#12201a]";
  return "border-black/8 bg-sand/35 dark:border-white/10 dark:bg-white/[0.04]";
}

export default function WorkspaceDealDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ dealId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<DealDetailSkeleton />}>
      <DealDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DealDetailContent({
  params,
  searchParams
}: {
  params: Promise<{ dealId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { dealId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const viewer = await requireViewer();
  const entitlements = await getViewerEntitlements(viewer);

  const aggregate = await getCachedDealForViewer(viewer, dealId);

  if (!aggregate) {
    notFound();
  }

  const hasPremiumInbox = entitlements.features.premium_inbox;
  const hasBriefGeneration = entitlements.features.brief_generation;
  const [linkedEmailThreads, emailAccounts] = hasPremiumInbox
    ? await Promise.all([
        listLinkedEmailThreadsForViewerDeal(viewer, dealId),
        listEmailAccountsForViewer(viewer)
      ])
    : [[], []];

  const {
    deal,
    latestDocument,
    documents,
    terms,
    riskFlags,
    jobs,
    documentReviewItems,
    extractionEvidence,
    documentSections,
    extractionResults
  } = aggregate;
  const normalized = buildNormalizedIntakeRecord(aggregate);
  const displayLabels = getDisplayDealLabels({
    brandName: normalized?.brandName ?? deal.brandName,
    campaignName: normalized?.contractTitle ?? deal.campaignName
  });
  const displayCampaignName =
    displayLabels.campaignName ??
    normalized?.contractTitle ??
    deriveWorkspaceTitleFromFileNames(documents.map((document) => document.fileName)) ??
    deal.campaignName;
  const displayBrandName = displayLabels.brandName ?? deal.brandName;
  const nextDeliverableValue = formatDate(deal.nextDeliverableDate);
  const riskCount = riskFlags.length;
  const highRiskCount = riskFlags.filter((f) => f.severity === "high").length;
  const invoiceDocuments = documents.filter((document) => document.documentKind === "invoice");

  const hasInvoice = Boolean(aggregate.invoiceRecord);
  const VALID_TABS = hasInvoice
    ? ["overview", "terms", "deliverables", "invoices", "emails", "documents"]
    : ["overview", "terms", "deliverables", "emails", "documents"];
  const TAB_REDIRECTS: Record<string, string> = {
    ...(hasInvoice ? {} : { invoices: "deliverables" }),
    risks: "terms",
    brief: "deliverables",
    notes: "overview"
  };
  const rawTab = resolvedSearchParams?.tab ?? "";
  const resolvedTab = TAB_REDIRECTS[rawTab] ?? rawTab;
  const hasPendingExtraction = Boolean(terms?.pendingExtraction);
  const currentTab = VALID_TABS.includes(resolvedTab)
    ? resolvedTab
    : hasPendingExtraction
      ? "terms"
      : "overview";

  const nextAction = buildNextAction({
    status: deal.status,
    paymentStatus: deal.paymentStatus,
    nextDeliverableDate: deal.nextDeliverableDate,
    riskFlags,
    pendingExtraction: !!terms?.pendingExtraction
  });

  const attentionItems: Array<{ id: string; label: string; detail?: string }> = [];
  if (terms?.pendingExtraction) {
    attentionItems.push({ id: "pending", label: "New extraction changes ready to review" });
  }
  if (highRiskCount > 0) {
    attentionItems.push({ id: "risks", label: `${highRiskCount} high-risk clause${highRiskCount === 1 ? "" : "s"} flagged` });
  }
  if (deal.paymentStatus === "late") {
    attentionItems.push({ id: "payment", label: "Payment is overdue" });
  }
  if ((aggregate.conflictResults?.length ?? 0) > 0) {
    attentionItems.push({ id: "conflicts", label: `${aggregate.conflictResults.length} cross-partnership conflict${aggregate.conflictResults.length === 1 ? "" : "s"}` });
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1280px] space-y-6">
        <WorkspaceDetailHeader
          backHref="/app/p/history"
          backLabel="All Partnerships"
          action={<DealNotesDrawer dealId={deal.id} notes={terms?.notes ?? null} />}
          campaignName={displayCampaignName}
          brandName={displayBrandName}
          status={deal.status}
          paymentStatus={deal.paymentStatus}
          paymentAmount={terms?.paymentAmount ?? null}
          currency={terms?.currency ?? "USD"}
          nextDeliverableValue={nextDeliverableValue}
          deliverableCount={terms?.deliverables?.length ?? 0}
        />

        {/* Tabs: 5 instead of 9 */}
        <WorkspaceTabs defaultTab={currentTab}>
          <ScrollableTabsList>
            <TabsList data-guide="workspace-tabs" className="inline-flex h-auto w-max flex-nowrap gap-1 border-0 bg-transparent p-1 shadow-none dark:bg-transparent">
              <TabsTrigger value="overview" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="terms" data-guide="tab-terms" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Terms
                {riskCount > 0 ? (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center bg-clay/10 px-1 text-[11px] font-semibold text-clay transition-colors group-data-[state=active]:bg-white/10 group-data-[state=active]:text-white dark:group-data-[state=active]:bg-black/10 dark:group-data-[state=active]:text-[#111827]">
                    {riskCount}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="deliverables" data-guide="tab-deliverables" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Deliverables
              </TabsTrigger>
              {hasInvoice ? (
                <TabsTrigger value="invoices" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                  Invoices
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="emails" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Emails
              </TabsTrigger>
              <TabsTrigger value="documents" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Documents
              </TabsTrigger>
            </TabsList>
          </ScrollableTabsList>

          {/* ── Overview: "Today" view ── */}
          <TabsContent value="overview" id="tab-overview" className="mt-0 space-y-6">
            {/* Next action */}
            <div className={`flex items-center justify-between gap-4 border p-4 ${nextActionToneClass(nextAction.tone)}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Next step</p>
                <p className="mt-1 text-sm font-medium text-foreground">{nextAction.label}</p>
              </div>
              {nextAction.tab !== "overview" ? (
                <Link
                  href={`/app/p/${deal.id}?tab=${nextAction.tab}`}
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground transition hover:text-primary"
                >
                  Go <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>

            {/* Needs attention */}
            {attentionItems.length > 0 ? (
              <div className="border border-clay/15 bg-clay/[0.04] p-4 dark:border-clay/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-clay" />
                  <p className="text-sm font-semibold text-ink">Needs attention ({attentionItems.length})</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {attentionItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 bg-clay" />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Partnership snapshot (summary + disclosures) */}
            <DealSummaryPanel
              dealId={deal.id}
              summaries={aggregate.summaries}
              currentSummary={aggregate.currentSummary}
            />

            {(terms?.disclosureObligations?.length ?? 0) > 0 ? (
              <DisclosureObligations
                dealId={deal.id}
                obligations={terms?.disclosureObligations ?? []}
              />
            ) : null}

            {(aggregate.conflictResults?.length ?? 0) > 0 ? (
              <ConflictWarnings
                conflicts={aggregate.conflictResults}
                compact
                title="Cross-partnership conflicts"
                description="Overlapping category, exclusivity, or timing signals across active workspaces."
              />
            ) : null}

            <p className="text-xs uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
              {deal.legalDisclaimer}
            </p>
          </TabsContent>

          {/* ── Terms (includes risks) ── */}
          <TabsContent value="terms" id="tab-terms" className="mt-0 space-y-6">
            {terms?.pendingExtraction ? (
              <PendingChangesBanner dealId={deal.id} terms={terms} />
            ) : null}
            {riskCount > 0 ? (
              <RiskFlags dealId={deal.id} flags={riskFlags} />
            ) : null}
            <TermsEditor
              dealId={deal.id}
              terms={terms}
              evidence={extractionEvidence}
              sections={documentSections}
              extractionResults={extractionResults}
            />
          </TabsContent>

          {/* ── Deliverables (includes tracker, list, brief, invoices) ── */}
          <TabsContent value="deliverables" id="tab-deliverables" className="mt-0 space-y-6">
            {(terms?.deliverables?.length ?? 0) > 0 ? (
              <DeliverableTracker dealId={deal.id} deliverables={terms?.deliverables ?? []} />
            ) : null}
            <DeliverablesList dealId={deal.id} deliverables={terms?.deliverables ?? []} />

            {/* Brief section */}
            <BriefOverview
              dealId={deal.id}
              briefData={terms?.briefData}
              documents={documents}
              hasPremiumInbox={hasPremiumInbox}
            />
            {hasBriefGeneration ? (
              <BriefGenerator dealId={deal.id} briefData={terms?.briefData ?? null} documents={documents} />
            ) : (
              <FeatureUpgradeCard
                eyebrow="Standard briefs"
                title="AI brief generation unlocks on Standard"
                description="Basic keeps the extracted brief overview, but generated campaign briefs and regenerations are part of the Standard and Premium workflow."
                requiredTier={PlanTier.standard}
                currentTier={entitlements.effectiveTier}
                hasActiveSubscription={entitlements.hasActiveSubscription}
                actionLabel="Upgrade for brief generation"
              />
            )}

            {/* Invoice link (only when no invoice exists yet) */}
            {!hasInvoice ? (
              <div className="border border-dashed border-black/10 bg-sand/25 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-sm font-semibold text-foreground">Ready to invoice?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate an invoice from your workspace deliverables and payment terms.
                </p>
                <Link
                  href={`/app/p/${deal.id}/invoice`}
                  className="mt-3 inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  Create invoice
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}
          </TabsContent>

          {/* ── Invoices (only when invoice exists) ── */}
          {hasInvoice ? (
            <TabsContent value="invoices" className="mt-0 space-y-6">
              <div className="border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-foreground">{aggregate.invoiceRecord!.invoiceNumber}</h2>
                      <span className="bg-black/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:bg-white/10">
                        {humanizeToken(aggregate.invoiceRecord!.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Due {formatDate(aggregate.invoiceRecord!.dueDate)} · {formatCurrency(aggregate.invoiceRecord!.subtotal, aggregate.invoiceRecord!.currency ?? "USD")}
                    </p>
                    {aggregate.invoiceRecord!.sentAt ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sent {formatDate(aggregate.invoiceRecord!.sentAt)}
                        {aggregate.invoiceRecord!.lastSentToEmail ? ` to ${aggregate.invoiceRecord!.lastSentToEmail}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/app/p/${deal.id}/invoice`}
                    className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
                  >
                    Open invoice editor
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {aggregate.invoiceRecord!.pdfDocumentId ? (
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-black/8 pt-4 dark:border-white/10">
                    <Link
                      href={`/api/documents/${aggregate.invoiceRecord!.pdfDocumentId}/content`}
                      target="_blank"
                      className="inline-flex items-center gap-2 border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20 dark:border-white/10"
                    >
                      View PDF
                    </Link>
                    <Link
                      href={`/api/documents/${aggregate.invoiceRecord!.pdfDocumentId}/content?download=1`}
                      className="inline-flex items-center gap-2 border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20 dark:border-white/10"
                    >
                      Download PDF
                    </Link>
                  </div>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          {/* ── Emails ── */}
          <TabsContent value="emails" className="mt-0 space-y-6">
            {hasPremiumInbox ? (
              <DealEmailPanel
                dealId={deal.id}
                linkedThreads={linkedEmailThreads}
                hasConnectedAccounts={emailAccounts.some(
                  (account: { status: string }) => account.status !== "disconnected"
                )}
              />
            ) : (
              <FeatureUpgradeCard
                eyebrow="Premium inbox"
                title="Email intelligence unlocks on Premium"
                description="Linked threads, synced inbox search, negotiation context, and communication intelligence for this partnership live on the Premium plan."
                requiredTier={PlanTier.premium}
                currentTier={entitlements.effectiveTier}
                hasActiveSubscription={entitlements.hasActiveSubscription}
                actionLabel="Upgrade for inbox intelligence"
              />
            )}
          </TabsContent>

          {/* ── Documents ── */}
          <TabsContent value="documents" className="mt-0 space-y-6">
            <UploadContractForm
              dealId={deal.id}
              documents={documents}
              jobs={jobs}
              reviewItems={documentReviewItems}
            />
            <DocumentsPanel
              dealId={deal.id}
              documents={documents}
              jobs={jobs}
              reviewItems={documentReviewItems}
            />
          </TabsContent>
        </WorkspaceTabs>

        <div className="border-t border-black/6 pt-6 dark:border-white/8">
          <DeleteDealDialog
            dealId={deal.id}
            dealName={displayLabels.campaignName ?? displayCampaignName}
            redirectTo="/app/p/history"
            className="inline-flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-clay dark:text-white/45 dark:hover:text-clay"
            triggerLabel={`Delete ${displayLabels.campaignName ?? displayCampaignName}`}
          >
            <Trash2 className="h-4 w-4" />
            Delete this partnership
          </DeleteDealDialog>
        </div>
      </div>
    </div>
  );
}
