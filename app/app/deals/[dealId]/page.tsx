import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Fragment } from "react";

import { PendingChangesBanner } from "@/components/pending-changes-banner";
import { BriefGenerator } from "@/components/brief-generator";
import { BriefOverview } from "@/components/brief-overview";
import { DealContextPanel } from "@/components/deal-context-panel";
import { DeliverableTracker } from "@/components/deliverable-tracker";
import { ConflictWarnings } from "@/components/conflict-warnings";
import { DeleteDealDialog } from "@/components/delete-deal-dialog";
import { DealNotesPanel } from "@/components/deal-notes-panel";
import { DeliverablesList } from "@/components/deliverables-list";
import { DisclosureObligations } from "@/components/disclosure-obligations";
import { DocumentsPanel } from "@/components/documents-panel";
import { RiskFlags } from "@/components/risk-flags";
import { TermsEditor } from "@/components/terms-editor";
import { UploadContractForm } from "@/components/upload-contract-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { dealCategoryLabel } from "@/lib/conflict-intelligence";
import { parseDealSummarySections, toPlainDealSummary } from "@/lib/deal-summary";
import { getDealForViewer } from "@/lib/deals";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

function renderSummaryParagraph(paragraph: string) {
  const pattern =
    /(\$[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|\bNet\s+\d+\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b|\bTikTok\b|\bInstagram\b|\bYouTube\b|\b#ad\b|\bpaid partnership\b)/gi;
  const parts = paragraph.split(pattern);

  return parts.map((part, index) => {
    if (!part) {
      return null;
    }

    const isEmphasis = pattern.test(part);
    pattern.lastIndex = 0;

    return isEmphasis ? (
      <strong key={`${part}-${index}`} className="font-semibold text-ink">
        {part}
      </strong>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    );
  });
}

export default async function WorkspaceDealDetailPage({
  params
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const viewer = await requireViewer();

  const aggregate = await getDealForViewer(viewer, dealId);

  if (!aggregate) {
    notFound();
  }

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
  const summaryBody =
    aggregate.currentSummary?.body ??
    deal.summary ??
    "Upload documents to generate a plain-English summary, extracted creator terms, and negotiation watchouts.";
  const summarySections = parseDealSummarySections(summaryBody);
  const plainSummary = toPlainDealSummary(summaryBody) ?? summaryBody;
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

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <section className="space-y-6">
          <Link
            href="/app/deals/history"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All Deals
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/8 pb-8 dark:border-white/10">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-foreground lg:text-[40px]">
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

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
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

        <Tabs defaultValue="overview" className="gap-6">
          <TabsList className="h-auto flex-wrap rounded-md border border-black/8 bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]">
            <TabsTrigger value="overview" className="px-4 py-2">
              Overview
            </TabsTrigger>
            <TabsTrigger value="terms" className="px-4 py-2">
              Key Terms
            </TabsTrigger>
            <TabsTrigger value="risks" className="px-4 py-2">
              Risks
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="px-4 py-2">
              Deliverables
            </TabsTrigger>
            <TabsTrigger value="brief" className="px-4 py-2">
              Brief
            </TabsTrigger>
            <TabsTrigger value="emails" className="px-4 py-2">
              Emails
            </TabsTrigger>
            <TabsTrigger value="documents" className="px-4 py-2">
              Documents
            </TabsTrigger>
            <TabsTrigger value="notes" className="px-4 py-2">
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            <DealContextPanel terms={terms} />
            {(aggregate.conflictResults?.length ?? 0) > 0 ? (
              <ConflictWarnings
                conflicts={aggregate.conflictResults}
                title="Cross-deal conflict warnings"
                description="These warnings compare this deal against your other active deals."
              />
            ) : null}
            {(terms?.disclosureObligations?.length ?? 0) > 0 ? (
              <DisclosureObligations obligations={terms?.disclosureObligations ?? []} />
            ) : null}
            <div className="space-y-6 border border-black/8 bg-white px-6 py-6 dark:border-white/10 dark:bg-white/[0.03]">
              {summarySections.length > 0 ? (
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={summarySections[0]?.id}
                  className="w-full"
                >
                  {summarySections.map((section) => (
                    <AccordionItem
                      key={section.id}
                      value={section.id}
                      className="border-black/8 dark:border-white/10"
                    >
                      <AccordionTrigger className="py-5 hover:no-underline">
                        <div className="pr-6 text-left">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3] dark:text-white/42">
                            {section.title}
                          </p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-5">
                        <div className="max-w-4xl space-y-3">
                          {section.paragraphs.map((paragraph, index) => (
                            <p
                              key={`${section.id}-${index}`}
                              className="text-[15px] leading-8 text-black/72 dark:text-white/72"
                            >
                              {renderSummaryParagraph(paragraph)}
                            </p>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="max-w-4xl">
                  <p className="text-[15px] leading-8 text-black/72 dark:text-white/72">
                    {plainSummary}
                  </p>
                </div>
              )}

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
            <DeliverableTracker dealId={deal.id} deliverables={terms?.deliverables ?? []} />
            <DeliverablesList deliverables={terms?.deliverables ?? []} />
          </TabsContent>

          <TabsContent value="brief" className="mt-0 space-y-6">
            <BriefOverview briefData={terms?.briefData} documents={documents} />
            <BriefGenerator dealId={deal.id} briefData={terms?.briefData ?? null} documents={documents} />
          </TabsContent>

          <TabsContent value="emails" className="mt-0 space-y-6">
            <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
                Emails
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
                Email drafting will be available after you connect an email provider.
              </p>
              <button className="mt-5 border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20">
                Connect email
              </button>
            </section>
          </TabsContent>

          <TabsContent value="documents" className="mt-0 space-y-6">
            <UploadContractForm dealId={deal.id} documents={documents} />
            <DocumentsPanel
              dealId={deal.id}
              documents={documents}
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
            Delete this deal
          </DeleteDealDialog>
        </div>
      </div>
    </div>
  );
}
