"use client";

import Link from "next/link";
import { Info } from "lucide-react";

import { ProseText } from "@/components/prose-text";
import type { BriefData, DocumentRecord } from "@/lib/types";

interface BriefOverviewProps {
  dealId: string;
  briefData: BriefData | null | undefined;
  documents: DocumentRecord[];
  hasPremiumInbox: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-foreground">
          <ProseText content={item} className="inline text-sm text-foreground" />
        </li>
      ))}
    </ul>
  );
}

function safeItems(items: string[] | null | undefined) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

export function BriefOverview({
  dealId,
  briefData,
  documents,
  hasPremiumInbox,
}: BriefOverviewProps) {
  if (!briefData) {
    return (
      <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
          Brief
        </h2>
        <div className="mt-4 border border-black/8 bg-[#faf8f3] px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-black/45 dark:text-white/45">
              <Info className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                Brief Missing
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/65 dark:text-white/70">
                No brand brief uploaded yet. You should usually have one by now. Generate a working
                brief from your workspace for now, then upload the real brief later so HelloBrand
                can compare and update it.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/app/p/${dealId}?tab=emails`}
            className="inline-flex items-center justify-center border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
          >
            Search inbox
          </Link>
          {!hasPremiumInbox ? (
            <span className="text-xs text-black/45 dark:text-white/45">Premium feature</span>
          ) : null}
        </div>
      </section>
    );
  }

  const sourceDocNames = briefData.sourceDocumentIds
    .map((id) => documents.find((d) => d.id === id)?.fileName)
    .filter(Boolean);

  return (
    <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            Brief
          </h2>
          {sourceDocNames.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Source: {sourceDocNames.join(", ")}
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {briefData.campaignOverview && (
            <div className="md:col-span-2">
              <Section title="Campaign Overview">
                <ProseText
                  content={briefData.campaignOverview}
                  className="text-sm text-foreground"
                />
              </Section>
            </div>
          )}

          {briefData.campaignObjective && (
            <div className="md:col-span-2">
              <Section title="Objective">
                <ProseText
                  content={briefData.campaignObjective}
                  className="text-sm text-foreground"
                />
              </Section>
            </div>
          )}

          {(briefData.productName || briefData.productDescription) && (
            <Section title="Product">
              {briefData.productName ? (
                <ProseText
                  content={briefData.productName}
                  className="text-sm font-medium text-foreground"
                />
              ) : null}
              {briefData.productDescription ? (
                <ProseText
                  content={briefData.productDescription}
                  className="mt-1 text-sm text-foreground"
                />
              ) : null}
            </Section>
          )}

          {(briefData.deliverablesSummary ||
            safeItems(briefData.deliverablePlatforms).length > 0) && (
            <Section title="Deliverables">
              {briefData.deliverablesSummary ? (
                <ProseText
                  content={briefData.deliverablesSummary}
                  className="text-sm text-foreground"
                />
              ) : null}
              <BulletList items={safeItems(briefData.deliverablePlatforms)} />
            </Section>
          )}

          {(briefData.agreementStartDate ||
            briefData.agreementEndDate ||
            briefData.executionTargetDate ||
            briefData.campaignFlight ||
            briefData.postingSchedule ||
            briefData.conceptDueDate ||
            briefData.campaignLiveDate ||
            briefData.draftDueDate ||
            briefData.contentDueDate ||
            briefData.postDuration) && (
            <Section title="Key Dates">
              <BulletList
                items={[
                  briefData.agreementStartDate
                    ? `Agreement start: ${briefData.agreementStartDate}`
                    : null,
                  briefData.agreementEndDate
                    ? `Agreement end: ${briefData.agreementEndDate}`
                    : null,
                  briefData.executionTargetDate
                    ? `Execution target: ${briefData.executionTargetDate}`
                    : null,
                  briefData.campaignFlight ? `Campaign flight: ${briefData.campaignFlight}` : null,
                  briefData.postingSchedule
                    ? `Posting schedule: ${briefData.postingSchedule}`
                    : null,
                  briefData.conceptDueDate ? `Concept due: ${briefData.conceptDueDate}` : null,
                  briefData.campaignLiveDate ? `Live date: ${briefData.campaignLiveDate}` : null,
                  briefData.draftDueDate ? `Draft due: ${briefData.draftDueDate}` : null,
                  briefData.contentDueDate ? `Content due: ${briefData.contentDueDate}` : null,
                  briefData.postDuration ? `Post duration: ${briefData.postDuration}` : null,
                ].filter((item): item is string => Boolean(item))}
              />
            </Section>
          )}

          {briefData.messagingPoints.length > 0 && (
            <Section title="Messaging Points">
              <BulletList items={briefData.messagingPoints} />
            </Section>
          )}

          {briefData.talkingPoints.length > 0 && (
            <Section title="Talking Points">
              <BulletList items={briefData.talkingPoints} />
            </Section>
          )}

          {safeItems(briefData.requiredClaims).length > 0 && (
            <Section title="Required Claims">
              <BulletList items={safeItems(briefData.requiredClaims)} />
            </Section>
          )}

          {safeItems(briefData.contentPillars).length > 0 && (
            <Section title="Content Pillars">
              <BulletList items={safeItems(briefData.contentPillars)} />
            </Section>
          )}

          {safeItems(briefData.requiredElements).length > 0 && (
            <Section title="Required Elements">
              <BulletList items={safeItems(briefData.requiredElements)} />
            </Section>
          )}

          {briefData.creativeConceptOverview && (
            <div className="md:col-span-2">
              <Section title="Creative Concept">
                <ProseText
                  content={briefData.creativeConceptOverview}
                  className="text-sm text-foreground"
                />
              </Section>
            </div>
          )}

          {briefData.visualDirection && (
            <Section title="Visual Direction">
              <ProseText content={briefData.visualDirection} className="text-sm text-foreground" />
            </Section>
          )}

          {briefData.brandGuidelines && (
            <Section title="Brand Guidelines">
              <ProseText content={briefData.brandGuidelines} className="text-sm text-foreground" />
            </Section>
          )}

          {briefData.approvalRequirements && (
            <Section title="Approval Requirements">
              <ProseText
                content={briefData.approvalRequirements}
                className="text-sm text-foreground"
              />
            </Section>
          )}

          {briefData.revisionRequirements && (
            <Section title="Revision Requirements">
              <ProseText
                content={briefData.revisionRequirements}
                className="text-sm text-foreground"
              />
            </Section>
          )}

          {briefData.reportingRequirements && (
            <Section title="Reporting Requirements">
              <ProseText
                content={briefData.reportingRequirements}
                className="text-sm text-foreground"
              />
            </Section>
          )}

          {briefData.targetAudience && (
            <Section title="Target Audience">
              <ProseText content={briefData.targetAudience} className="text-sm text-foreground" />
            </Section>
          )}

          {briefData.toneAndStyle && (
            <Section title="Tone & Style">
              <ProseText content={briefData.toneAndStyle} className="text-sm text-foreground" />
            </Section>
          )}

          {(briefData.usageNotes || briefData.amplificationPeriod) && (
            <Section title="Usage Notes">
              {briefData.usageNotes ? (
                <ProseText content={briefData.usageNotes} className="text-sm text-foreground" />
              ) : null}
              {briefData.amplificationPeriod ? (
                <ProseText
                  content={`Amplification period: ${briefData.amplificationPeriod}`}
                  className="mt-1 text-sm text-foreground"
                />
              ) : null}
            </Section>
          )}

          {(briefData.paymentSchedule ||
            briefData.paymentRequirements ||
            briefData.paymentNotes) && (
            <Section title="Payment Details">
              <BulletList
                items={[
                  briefData.paymentSchedule
                    ? `Payment schedule: ${briefData.paymentSchedule}`
                    : null,
                  briefData.paymentRequirements
                    ? `Payment requirements: ${briefData.paymentRequirements}`
                    : null,
                ].filter((item): item is string => Boolean(item))}
              />
              {briefData.paymentNotes ? (
                <ProseText content={briefData.paymentNotes} className="text-sm text-foreground" />
              ) : null}
            </Section>
          )}

          {safeItems(briefData.disclosureRequirements).length > 0 && (
            <Section title="Disclosure Requirements">
              <BulletList items={safeItems(briefData.disclosureRequirements)} />
            </Section>
          )}

          {briefData.doNotMention.length > 0 && (
            <Section title="Do Not Mention">
              <BulletList items={briefData.doNotMention} />
            </Section>
          )}

          {safeItems(briefData.competitorRestrictions).length > 0 && (
            <Section title="Competitor Restrictions">
              <BulletList items={safeItems(briefData.competitorRestrictions)} />
            </Section>
          )}

          {(briefData.campaignCode ||
            briefData.jobNumber ||
            briefData.referenceId ||
            briefData.creatorHandle ||
            briefData.promoCode ||
            safeItems(briefData.linksAndAssets).length > 0) && (
            <Section title="Links & Codes">
              <BulletList
                items={[
                  briefData.campaignCode ? `Campaign code: ${briefData.campaignCode}` : null,
                  briefData.jobNumber ? `Job number: ${briefData.jobNumber}` : null,
                  briefData.referenceId ? `Reference ID: ${briefData.referenceId}` : null,
                  briefData.creatorHandle ? `Creator handle: ${briefData.creatorHandle}` : null,
                  briefData.promoCode ? `Promo code: ${briefData.promoCode}` : null,
                  ...safeItems(briefData.linksAndAssets),
                ].filter((item): item is string => Boolean(item))}
              />
            </Section>
          )}

          {briefData.campaignNotes && (
            <div className="md:col-span-2">
              <Section title="Notes">
                <ProseText content={briefData.campaignNotes} className="text-sm text-foreground" />
              </Section>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
