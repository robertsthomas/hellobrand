import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Suspense } from "react";
import { PlanTier } from "@prisma/client";

import { PendingChangesBanner } from "@/components/pending-changes-banner";
import { BriefGenerator } from "@/components/brief-generator";
import { BriefOverview } from "@/components/brief-overview";
import { DealContextPanel } from "@/components/deal-context-panel";
import { DealEmailPanel } from "@/components/deal-email-panel";
import { DealSummaryPanel } from "@/components/deal-summary-panel";
import { DeliverableTracker } from "@/components/deliverable-tracker";
import { ConflictWarnings } from "@/components/conflict-warnings";
import { DeleteDealDialog } from "@/components/delete-deal-dialog";
import { DealNotesPanel } from "@/components/deal-notes-panel";
import { DeliverablesList } from "@/components/deliverables-list";
import { DisclosureObligations } from "@/components/disclosure-obligations";
import { DocumentsPanel } from "@/components/documents-panel";
import { FeatureUpgradeCard } from "@/components/feature-locked-state";
import { InvoiceEditorPanel } from "@/components/invoice-editor-panel";
import { RiskFlags } from "@/components/risk-flags";
import { DealDetailSkeleton } from "@/components/skeletons";
import { TermsEditor } from "@/components/terms-editor";
import { UploadContractForm } from "@/components/upload-contract-form";
import { ScrollableTabsList } from "@/components/scrollable-tabs-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getCachedDealForViewer } from "@/lib/cached-data";
import { dealCategoryLabel } from "@/lib/conflict-intelligence";
import { listEmailAccountsForViewer, listLinkedEmailThreadsForViewerDeal } from "@/lib/email/service";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

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
    extractionEvidence,
    documentSections,
    extractionResults
  } = aggregate;
  const normalized = buildNormalizedIntakeRecord(aggregate);
  const displayCampaignName = normalized?.contractTitle ?? deal.campaignName;
  const uploadedDate = formatDate(deal.createdAt);
  const nextDeliverableValue = formatDate(deal.nextDeliverableDate);
  const documentLabel = latestDocument
    ? `${humanizeToken(latestDocument.documentKind)} • ${humanizeToken(
        latestDocument.processingStatus
      )}`
    : "No documents uploaded yet";
  const riskCount = riskFlags.length;
  const currentTab =
    resolvedSearchParams?.tab &&
    ["overview", "terms", "risks", "deliverables", "brief", "emails", "documents", "invoices", "notes"].includes(
      resolvedSearchParams.tab
    )
      ? resolvedSearchParams.tab
      : "overview";
  const invoiceDocuments = documents.filter((document) => document.documentKind === "invoice");

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <section className="space-y-6">
          <Link
            href="/app/deals/history"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All Partnerships
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/8 pb-8 dark:border-white/10">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[34px] lg:text-[40px]">
                  {displayCampaignName}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#7CB08B]" />
                  <span className="text-sm font-medium text-foreground">
                    {humanizeToken(deal.status)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Contract uploaded on {uploadedDate} · Reviewed by HelloBrand AI
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:gap-8 md:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-black/8 pb-3 dark:border-white/10">
              <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Payment</p>
              <p className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                {formatCurrency(terms?.paymentAmount ?? null, terms?.currency ?? "USD")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {terms?.paymentTerms ?? "Payment timing not extracted yet"}
              </p>
            </div>
            <div className="border-b border-black/8 pb-3 dark:border-white/10">
              <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Due Date</p>
              <p className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                {nextDeliverableValue}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Stage: {humanizeToken(deal.status)}
              </p>
            </div>
            <div className="border-b border-black/8 pb-3 dark:border-white/10">
              <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Deliverables</p>
              <p className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                {terms?.deliverables?.length ?? 0} pending
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {documents.length} source{documents.length === 1 ? "" : "s"} attached
              </p>
            </div>
            <div className="border-b border-black/8 pb-3 dark:border-white/10">
              <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Risk Flags</p>
              <p className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#d76742]">
                {riskCount > 0 ? `${riskCount} flagged` : "No flags"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{documentLabel}</p>
            </div>
          </div>
        </section>

        {terms?.pendingExtraction ? (
          <PendingChangesBanner dealId={deal.id} terms={terms} />
        ) : null}

        <Tabs defaultValue={currentTab} className="gap-6">
          <ScrollableTabsList>
            <TabsList data-guide="workspace-tabs" className="inline-flex h-auto w-max flex-nowrap gap-1 border-0 bg-transparent p-1 shadow-none dark:bg-transparent">
              <TabsTrigger value="overview" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="terms" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Key Terms
              </TabsTrigger>
              <TabsTrigger value="risks" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Risks
              </TabsTrigger>
              <TabsTrigger value="deliverables" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Deliverables
              </TabsTrigger>
              <TabsTrigger value="brief" data-guide="tab-brief" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Brief
              </TabsTrigger>
              <TabsTrigger value="emails" data-guide="tab-emails" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Emails
              </TabsTrigger>
              <TabsTrigger value="documents" data-guide="tab-documents" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Documents
              </TabsTrigger>
              <TabsTrigger value="invoices" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Invoices
              </TabsTrigger>
              <TabsTrigger value="notes" className="shrink-0 px-3 py-2 text-[13px] sm:px-4 sm:text-sm">
                Notes
              </TabsTrigger>
            </TabsList>
          </ScrollableTabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            <DealContextPanel terms={terms} />
            {(aggregate.conflictResults?.length ?? 0) > 0 ? (
              <ConflictWarnings
                conflicts={aggregate.conflictResults}
                title="Cross-partnership conflict warnings"
                description="These warnings compare this partnership against your other active partnerships."
              />
            ) : null}
            {(terms?.disclosureObligations?.length ?? 0) > 0 ? (
              <DisclosureObligations obligations={terms?.disclosureObligations ?? []} />
            ) : null}
            <div className="space-y-6 border border-black/8 bg-white px-6 py-6 dark:border-white/10 dark:bg-white/[0.03]">
              <DealSummaryPanel
                dealId={deal.id}
                summaries={aggregate.summaries}
                currentSummary={aggregate.currentSummary}
              />

              <div className="grid gap-6 border-t border-black/8 pt-6 md:grid-cols-2 dark:border-white/10">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                    Rights
                  </p>
                  <p className="text-sm text-foreground">
                    {terms?.usageRightsPaidAllowed
                      ? "Paid usage"
                      : terms?.usageRightsOrganicAllowed
                        ? "Organic only"
                        : "Needs review"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {terms?.usageDuration ?? "Duration not clear yet"}
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                    Exclusivity
                  </p>
                  <p className="text-sm text-foreground">
                    {terms?.exclusivityDuration ?? "Not detected"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {terms?.exclusivityCategory ??
                      (terms?.brandCategory
                        ? dealCategoryLabel(terms.brandCategory)
                        : "Category not specified")}
                  </p>
                </div>
              </div>

              <p className="text-xs uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
                {deal.legalDisclaimer}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="terms" className="mt-0 space-y-6">
            <TermsEditor
              dealId={deal.id}
              terms={terms}
              evidence={extractionEvidence}
              sections={documentSections}
              extractionResults={extractionResults}
            />
          </TabsContent>

          <TabsContent value="risks" className="mt-0 space-y-6">
            <RiskFlags flags={riskFlags} />
          </TabsContent>

          <TabsContent value="deliverables" className="mt-0 space-y-6">
            {(terms?.deliverables?.length ?? 0) > 0 ? (
              <DeliverableTracker dealId={deal.id} deliverables={terms?.deliverables ?? []} />
            ) : null}
            <DeliverablesList deliverables={terms?.deliverables ?? []} />
          </TabsContent>

          <TabsContent value="brief" className="mt-0 space-y-6">
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
          </TabsContent>

          <TabsContent value="emails" className="mt-0 space-y-6">
            {hasPremiumInbox ? (
              <DealEmailPanel
                dealId={deal.id}
                linkedThreads={linkedEmailThreads}
                hasConnectedAccounts={emailAccounts.some((account) => account.status !== "disconnected")}
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

          <TabsContent value="documents" className="mt-0 space-y-6">
            <UploadContractForm dealId={deal.id} documents={documents} />
            <DocumentsPanel
              dealId={deal.id}
              documents={documents}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-0 space-y-6">
            <InvoiceEditorPanel
              dealId={deal.id}
              invoice={aggregate.invoiceRecord ?? null}
              invoiceDocuments={invoiceDocuments}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-0 space-y-6">
            <DealNotesPanel dealId={deal.id} notes={terms?.notes ?? null} />
          </TabsContent>
        </Tabs>

        <div className="border-t border-black/6 pt-6 dark:border-white/8">
          <DeleteDealDialog
            dealId={deal.id}
            dealName={deal.campaignName}
            redirectTo="/app/deals/history"
            className="inline-flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-clay dark:text-white/45 dark:hover:text-clay"
            triggerLabel={`Delete ${deal.campaignName}`}
          >
            <Trash2 className="h-4 w-4" />
            Delete this partnership
          </DeleteDealDialog>
        </div>
      </div>
    </div>
  );
}
