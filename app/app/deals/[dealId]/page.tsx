import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Fragment } from "react";

import { ConflictWarnings } from "@/components/conflict-warnings";
import { DeleteDealDialog } from "@/components/delete-deal-dialog";
import { DealNotesPanel } from "@/components/deal-notes-panel";
import { DealStatusPanel } from "@/components/deal-status-panel";
import { DeliverablesList } from "@/components/deliverables-list";
import { DisclosureObligations } from "@/components/disclosure-obligations";
import { DocumentsPanel } from "@/components/documents-panel";
import { EmailDrafts } from "@/components/email-drafts";
import { PaymentPanel } from "@/components/payment-panel";
import { RiskFlags } from "@/components/risk-flags";
import { SummaryCard } from "@/components/summary-card";
import { TermsEditor } from "@/components/terms-editor";
import { UploadContractForm } from "@/components/upload-contract-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireViewer } from "@/lib/auth";
import { dealCategoryLabel } from "@/lib/conflict-intelligence";
import { parseDealSummarySections, toPlainDealSummary } from "@/lib/deal-summary";
import { ensureDraftsForDeal, getDealForViewer } from "@/lib/deals";
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

  await ensureDraftsForDeal(viewer, dealId, [
    "clarify-clause",
    "request-faster-payment",
    "limit-usage-rights",
    "clarify-deadline"
  ]);

  const aggregate = await getDealForViewer(viewer, dealId);

  if (!aggregate) {
    notFound();
  }

  const {
    deal,
    latestDocument,
    documents,
    terms,
    paymentRecord,
    riskFlags,
    emailDrafts,
    documentSections,
    extractionEvidence,
    extractionResults,
    summaries
  } = aggregate;
  const summaryBody =
    aggregate.currentSummary?.body ??
    deal.summary ??
    "Upload documents to generate a plain-English summary, extracted creator terms, and negotiation watchouts.";
  const summarySections = parseDealSummarySections(summaryBody);
  const plainSummary = toPlainDealSummary(summaryBody) ?? summaryBody;

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-black/8 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#98a2b3] dark:text-white/45">
                  {deal.brandName}
                </p>
                <h1 className="mt-4 max-w-4xl text-[46px] font-semibold tracking-[-0.06em] text-foreground lg:text-[58px]">
                  {deal.campaignName}
                </h1>
              </div>
            </div>
            {summarySections.length > 0 ? (
              <div className="mt-6 border-t border-black/6 dark:border-white/8">
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
                      className="border-black/6 dark:border-white/8"
                    >
                      <AccordionTrigger className="py-5 hover:no-underline">
                        <div className="pr-6 text-left">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3] dark:text-white/42">
                            {section.title}
                          </p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-5">
                        <div className="space-y-3 pr-10">
                          {section.paragraphs.map((paragraph, index) => (
                            <p
                              key={`${section.id}-${index}`}
                              className="text-[15px] leading-7 text-black/68 dark:text-white/72"
                            >
                              {renderSummaryParagraph(paragraph)}
                            </p>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : (
              <p className="mt-4 max-w-3xl text-sm leading-6 text-black/65 dark:text-white/70">
                {plainSummary}
              </p>
            )}
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
              {deal.legalDisclaimer}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <SummaryCard
              label="Payment"
              value={formatCurrency(terms?.paymentAmount ?? null, terms?.currency ?? "USD")}
              caption={terms?.paymentTerms ?? "Payment timing not extracted yet"}
            />
            <SummaryCard
              label="Next deliverable"
              value={formatDate(deal.nextDeliverableDate)}
              caption={`Stage: ${humanizeToken(deal.status)}`}
              accent="sage"
            />
            <SummaryCard
              label="Documents"
              value={String(documents.length)}
              caption={
                latestDocument
                  ? `${humanizeToken(latestDocument.documentKind)} • ${humanizeToken(latestDocument.processingStatus)}`
                  : "No documents uploaded yet"
              }
              accent={latestDocument?.processingStatus === "failed" ? "clay" : "ocean"}
            />
          </div>
        </section>

        <Tabs defaultValue="overview" className="gap-6">
          <TabsList className="h-auto flex-wrap rounded-[20px] p-1.5">
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

          <TabsContent value="overview" className="space-y-6">
            <UploadContractForm dealId={deal.id} documents={documents} />
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
            <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
              <DealStatusPanel
                dealId={deal.id}
                status={deal.status}
                paymentStatus={deal.paymentStatus}
                countersignStatus={deal.countersignStatus}
              />
              <RiskFlags flags={riskFlags.slice(0, 3)} />
            </div>
            <PaymentPanel dealId={deal.id} payment={paymentRecord} />
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Rights"
                value={
                  terms?.usageRightsPaidAllowed
                    ? "Paid usage"
                    : terms?.usageRightsOrganicAllowed
                      ? "Organic only"
                      : "Needs review"
                }
                caption={terms?.usageDuration ?? "Duration not clear yet"}
              />
              <SummaryCard
                label="Exclusivity"
                value={terms?.exclusivityDuration ?? "Not detected"}
                caption={
                  terms?.exclusivityCategory ??
                  (terms?.brandCategory
                    ? dealCategoryLabel(terms.brandCategory)
                    : "Category not specified")
                }
                accent="clay"
              />
              <SummaryCard
                label="Countersign"
                value={humanizeToken(deal.countersignStatus)}
                caption={humanizeToken(deal.paymentStatus)}
                accent="sage"
              />
            </div>
          </TabsContent>

          <TabsContent value="terms" className="space-y-6">
            <TermsEditor
              dealId={deal.id}
              terms={terms}
              evidence={extractionEvidence}
              sections={documentSections}
              extractionResults={extractionResults}
            />
          </TabsContent>

          <TabsContent value="risks" className="space-y-6">
            <RiskFlags flags={riskFlags} />
          </TabsContent>

          <TabsContent value="deliverables" className="space-y-6">
            <DeliverablesList deliverables={terms?.deliverables ?? []} />
          </TabsContent>

          <TabsContent value="emails" className="space-y-6">
            <EmailDrafts dealId={deal.id} drafts={emailDrafts} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <UploadContractForm dealId={deal.id} documents={documents} />
            <DocumentsPanel
              dealId={deal.id}
              documents={documents}
              documentSections={documentSections}
              extractionEvidence={extractionEvidence}
              extractionResults={extractionResults}
              summaries={summaries}
            />
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
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
