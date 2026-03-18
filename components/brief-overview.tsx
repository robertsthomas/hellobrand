"use client";

import type { BriefData, DocumentRecord } from "@/lib/types";

interface BriefOverviewProps {
  briefData: BriefData | null | undefined;
  documents: DocumentRecord[];
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
          {item}
        </li>
      ))}
    </ul>
  );
}

export function BriefOverview({ briefData, documents }: BriefOverviewProps) {
  if (!briefData) {
    return (
      <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Brief
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
          No campaign brief uploaded yet. Upload a campaign brief, deliverables
          brief, or pitch deck to populate this panel.
        </p>
      </section>
    );
  }

  const sourceDocNames = briefData.sourceDocumentIds
    .map((id) => documents.find((d) => d.id === id)?.fileName)
    .filter(Boolean);

  return (
    <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
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
                <p className="text-sm text-foreground">{briefData.campaignOverview}</p>
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
                <p className="text-sm text-foreground">{briefData.creativeConceptOverview}</p>
              </Section>
            </div>
          )}

          {briefData.brandGuidelines && (
            <Section title="Brand Guidelines">
              <p className="text-sm text-foreground">{briefData.brandGuidelines}</p>
            </Section>
          )}

          {briefData.approvalRequirements && (
            <Section title="Approval Requirements">
              <p className="text-sm text-foreground">{briefData.approvalRequirements}</p>
            </Section>
          )}

          {briefData.targetAudience && (
            <Section title="Target Audience">
              <p className="text-sm text-foreground">{briefData.targetAudience}</p>
            </Section>
          )}

          {briefData.toneAndStyle && (
            <Section title="Tone & Style">
              <p className="text-sm text-foreground">{briefData.toneAndStyle}</p>
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
