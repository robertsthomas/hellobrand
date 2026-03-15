import { saveTermsAction } from "@/app/actions";
import { dealCategoryLabel } from "@/lib/conflict-intelligence";
import type {
  DealCategory,
  DealTermsRecord,
  DocumentSectionRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord
} from "@/lib/types";
import { humanizeToken } from "@/lib/utils";

const DEAL_CATEGORY_OPTIONS: DealCategory[] = [
  "beauty_personal_care",
  "fashion_apparel",
  "food_beverage",
  "entertainment_media",
  "fitness_wellness",
  "parenting_family",
  "tech_gaming",
  "travel_hospitality",
  "finance",
  "home_lifestyle",
  "retail_ecommerce",
  "sports_outdoors",
  "other"
];

function EvidenceList({
  fieldPath,
  evidence,
  sections
}: {
  fieldPath: string;
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
}) {
  const matches = evidence.filter((entry) => entry.fieldPath === fieldPath);

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[1.25rem] bg-sand/45 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
        Evidence
      </p>
      <div className="mt-2 space-y-2">
        {matches.slice(0, 3).map((entry) => (
          <div key={entry.id} className="rounded-2xl bg-white/75 dark:bg-white/[0.05] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
              {sections.find((section) => section.id === entry.sectionId)?.title ??
                "Detected in document"}
            </p>
            <p className="mt-1 text-xs leading-5 text-black/60 dark:text-white/65">{entry.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConflictCallout({
  fieldPath,
  extractionResults
}: {
  fieldPath: string;
  extractionResults: ExtractionResultRecord[];
}) {
  const matches = extractionResults.filter((result) =>
    result.conflicts.includes(fieldPath)
  );

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[1.25rem] border border-clay/20 bg-clay/10 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-clay">
        Needs review
      </p>
      <p className="mt-1 text-xs leading-5 text-black/65 dark:text-white/70">
        HelloBrand found conflicting values for {humanizeToken(fieldPath)} across one
        or more extracted sections. Confirm this field manually before relying on it.
      </p>
    </div>
  );
}

function FieldSignals({
  fieldPath,
  evidence,
  sections,
  extractionResults
}: {
  fieldPath: string;
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
  extractionResults: ExtractionResultRecord[];
}) {
  return (
    <>
      <ConflictCallout fieldPath={fieldPath} extractionResults={extractionResults} />
      <EvidenceList fieldPath={fieldPath} evidence={evidence} sections={sections} />
    </>
  );
}

export function TermsEditor({
  dealId,
  terms,
  evidence,
  sections,
  extractionResults
}: {
  dealId: string;
  terms: DealTermsRecord | null;
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
  extractionResults: ExtractionResultRecord[];
}) {
  const conflictCount = new Set(
    extractionResults.flatMap((result) => result.conflicts)
  ).size;

  return (
    <form
      action={saveTermsAction}
      className="grid gap-5 rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-panel"
    >
      <div>
        <h2 className="font-serif text-3xl text-ocean">Key terms</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/65">
          HelloBrand pre-fills these fields from the uploaded documents, and you
          can correct anything before using them in emails or tracking.
        </p>
        {conflictCount > 0 ? (
          <div className="mt-4 rounded-[1.25rem] border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-black/70 dark:text-white/75">
            {conflictCount} extraction conflict{conflictCount === 1 ? "" : "s"} need
            manual review before you use these terms in negotiation emails or deal
            tracking.
          </div>
        ) : null}
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Brand name
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="brandName"
            defaultValue={terms?.brandName ?? ""}
          />
          <FieldSignals
            fieldPath="brandName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Campaign name
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="campaignName"
            defaultValue={terms?.campaignName ?? ""}
          />
          <FieldSignals
            fieldPath="campaignName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Creator name
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="creatorName"
            defaultValue={terms?.creatorName ?? ""}
          />
          <FieldSignals
            fieldPath="creatorName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Agency name
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="agencyName"
            defaultValue={terms?.agencyName ?? ""}
          />
          <FieldSignals
            fieldPath="agencyName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Brand category
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="brandCategory"
            defaultValue={terms?.brandCategory ?? ""}
          >
            <option value="">Not set</option>
            {DEAL_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {dealCategoryLabel(category)}
              </option>
            ))}
          </select>
          <p className="text-xs leading-5 text-black/50 dark:text-white/55">
            Override the detected category if this deal should be compared against a
            different competitor group.
          </p>
          <FieldSignals
            fieldPath="brandCategory"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Payment amount
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="paymentAmount"
            defaultValue={terms?.paymentAmount ?? ""}
            type="number"
            step="1"
          />
          <FieldSignals
            fieldPath="paymentAmount"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Currency
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="currency"
            defaultValue={terms?.currency ?? "USD"}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Payment terms
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="paymentTerms"
            defaultValue={terms?.paymentTerms ?? ""}
          />
          <FieldSignals
            fieldPath="paymentTerms"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Payment structure
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="paymentStructure"
            defaultValue={terms?.paymentStructure ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Net terms days
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="netTermsDays"
            defaultValue={terms?.netTermsDays ?? ""}
            type="number"
            step="1"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Payment trigger
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="paymentTrigger"
            defaultValue={terms?.paymentTrigger ?? ""}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
        Deliverables JSON
        <textarea
          className="min-h-32 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3 font-mono text-xs"
          name="deliverablesJson"
          defaultValue={JSON.stringify(terms?.deliverables ?? [], null, 2)}
        />
        <FieldSignals
          fieldPath="deliverables"
          evidence={evidence}
          sections={sections}
          extractionResults={extractionResults}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Usage rights summary
          <textarea
            className="min-h-24 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="usageRights"
            defaultValue={terms?.usageRights ?? ""}
          />
          <FieldSignals
            fieldPath="usageRights"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Usage channels JSON
          <textarea
            className="min-h-24 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3 font-mono text-xs"
            name="usageChannelsJson"
            defaultValue={JSON.stringify(terms?.usageChannels ?? [], null, 2)}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Organic usage allowed
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="usageRightsOrganicAllowed"
            defaultValue={
              terms?.usageRightsOrganicAllowed === null
                ? ""
                : String(terms.usageRightsOrganicAllowed)
            }
          >
            <option value="">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Paid usage allowed
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="usageRightsPaidAllowed"
            defaultValue={
              terms?.usageRightsPaidAllowed === null
                ? ""
                : String(terms.usageRightsPaidAllowed)
            }
          >
            <option value="">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Whitelisting allowed
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="whitelistingAllowed"
            defaultValue={
              terms?.whitelistingAllowed === null
                ? ""
                : String(terms.whitelistingAllowed)
            }
          >
            <option value="">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Usage duration
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="usageDuration"
            defaultValue={terms?.usageDuration ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Usage territory
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="usageTerritory"
            defaultValue={terms?.usageTerritory ?? ""}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Exclusivity summary
          <textarea
            className="min-h-20 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="exclusivity"
            defaultValue={terms?.exclusivity ?? ""}
          />
          <FieldSignals
            fieldPath="exclusivity"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Exclusivity restrictions
          <textarea
            className="min-h-20 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="exclusivityRestrictions"
            defaultValue={terms?.exclusivityRestrictions ?? ""}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Exclusivity applies
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="exclusivityApplies"
            defaultValue={
              terms?.exclusivityApplies === null
                ? ""
                : String(terms.exclusivityApplies)
            }
          >
            <option value="">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Exclusivity category
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="exclusivityCategory"
            defaultValue={terms?.exclusivityCategory ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Exclusivity duration
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="exclusivityDuration"
            defaultValue={terms?.exclusivityDuration ?? ""}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Revisions
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="revisions"
            defaultValue={terms?.revisions ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Revision rounds
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="revisionRounds"
            defaultValue={terms?.revisionRounds ?? ""}
            type="number"
            step="1"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Termination summary
          <textarea
            className="min-h-20 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="termination"
            defaultValue={terms?.termination ?? ""}
          />
          <FieldSignals
            fieldPath="termination"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Termination conditions
          <textarea
            className="min-h-20 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="terminationConditions"
            defaultValue={terms?.terminationConditions ?? ""}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Termination allowed
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="terminationAllowed"
            defaultValue={
              terms?.terminationAllowed === null
                ? ""
                : String(terms.terminationAllowed)
            }
          >
            <option value="">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Termination notice
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="terminationNotice"
            defaultValue={terms?.terminationNotice ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Governing law
          <input
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="governingLaw"
            defaultValue={terms?.governingLaw ?? ""}
          />
          <FieldSignals
            fieldPath="governingLaw"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
        Workspace notes
        <textarea
          className="min-h-24 rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
          name="notes"
          defaultValue={terms?.notes ?? ""}
        />
      </label>

      <button className="inline-flex w-fit rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white">
        Save key terms
      </button>
    </form>
  );
}
