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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
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

export function BriefOverview({
  dealId,
  briefData,
  documents,
  hasPremiumInbox
}: BriefOverviewProps) {
  if (!briefData) {
    return (
      <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#161a1f] sm:p-6">
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
                No brand brief uploaded yet. You should usually have one by now.
                Generate a working brief from your workspace for now, then upload
                the real brief later so HelloBrand can compare and update it.
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
            <span className="text-xs text-black/45 dark:text-white/45">
              Premium feature
            </span>
          ) : null}
        </div>
      </section>
    );
  }

  const sourceDocNames = briefData.sourceDocumentIds
    .map((id) => documents.find((d) => d.id === id)?.fileName)
    .filter(Boolean);

  return (
    <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#161a1f] sm:p-6">
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
                <ProseText content={briefData.campaignOverview} className="text-sm text-foreground" />
              </Section>
            </div>
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

          {briefData.creativeConceptOverview && (
            <div className="md:col-span-2">
              <Section title="Creative Concept">
                <ProseText content={briefData.creativeConceptOverview} className="text-sm text-foreground" />
              </Section>
            </div>
          )}

          {briefData.brandGuidelines && (
            <Section title="Brand Guidelines">
              <ProseText content={briefData.brandGuidelines} className="text-sm text-foreground" />
            </Section>
          )}

          {briefData.approvalRequirements && (
            <Section title="Approval Requirements">
              <ProseText content={briefData.approvalRequirements} className="text-sm text-foreground" />
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

          {briefData.doNotMention.length > 0 && (
            <Section title="Do Not Mention">
              <BulletList items={briefData.doNotMention} />
            </Section>
          )}
        </div>
      </div>
    </section>
  );
}
