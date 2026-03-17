import type { ReactNode } from "react";

import { saveTermsAction } from "@/app/actions";
import { dealCategoryLabel } from "@/lib/conflict-intelligence";
import {
  EditableStringListField,
  TermsArrayFieldsEditor
} from "@/components/terms-array-fields-editor";
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

const FIELD_LABEL_CLASS =
  "grid gap-2 text-sm font-medium text-black/70 dark:text-white/75";
const INPUT_CLASS =
  "h-11 border border-black/10 bg-white px-4 text-[15px] text-foreground shadow-none outline-none transition focus:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:focus:border-white/20";
const SELECT_CLASS = INPUT_CLASS;
const TEXTAREA_CLASS =
  "min-h-24 border border-black/10 bg-white px-4 py-3 text-[15px] text-foreground shadow-none outline-none transition focus:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:focus:border-white/20";

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlTags(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|table)>/gi, "\n")
    .replace(/<(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function fieldValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return stripHtmlTags(value);
}

function Section({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 border-t border-black/8 pt-6 dark:border-white/10">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

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
    <details className="border-t border-black/8 pt-3 dark:border-white/10">
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
        Evidence ({Math.min(matches.length, 3)})
      </summary>
      <div className="mt-3 divide-y divide-black/8 border border-black/8 dark:divide-white/10 dark:border-white/10">
        {matches.slice(0, 3).map((entry) => (
          <div key={entry.id} className="px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
              {sections.find((section) => section.id === entry.sectionId)?.title ??
                "Detected in document"}
            </p>
            <p className="mt-1 text-xs leading-5 text-black/60 dark:text-white/65">
              {entry.snippet}
            </p>
          </div>
        ))}
      </div>
    </details>
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
    <div className="border-l-2 border-clay/60 bg-clay/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-clay">
        Needs review
      </p>
      <p className="mt-1 text-xs leading-5 text-black/65 dark:text-white/70">
        Conflicting extracted values were detected for {humanizeToken(fieldPath)}.
        Confirm this field before relying on it in outreach or tracking.
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
      className="grid gap-8 border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]"
    >
      <div>
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Key terms
        </h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/65">
          These fields are prefilled from uploaded documents. Confirm or correct
          anything before using them in outreach, tracking, or reports.
        </p>
        {conflictCount > 0 ? (
          <div className="mt-4 border-l-2 border-clay/60 bg-clay/5 px-4 py-3 text-sm text-black/70 dark:text-white/75">
            {conflictCount} field{conflictCount === 1 ? "" : "s"} have conflicting
            extracted values. Review them before using these terms in outreach or
            tracking.
          </div>
        ) : null}
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <Section
        title="Partnership"
        description="Core identifying details for the deal and the external team."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className={FIELD_LABEL_CLASS}>
          Brand name
          <input
              className={INPUT_CLASS}
            name="brandName"
            defaultValue={fieldValue(terms?.brandName)}
          />
          <FieldSignals
            fieldPath="brandName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Campaign name
          <input
              className={INPUT_CLASS}
            name="campaignName"
            defaultValue={fieldValue(terms?.campaignName)}
          />
          <FieldSignals
            fieldPath="campaignName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Creator name
          <input
              className={INPUT_CLASS}
            name="creatorName"
            defaultValue={fieldValue(terms?.creatorName)}
          />
          <FieldSignals
            fieldPath="creatorName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Agency name
          <input
              className={INPUT_CLASS}
            name="agencyName"
            defaultValue={fieldValue(terms?.agencyName)}
          />
          <FieldSignals
            fieldPath="agencyName"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Brand category
          <select
              className={SELECT_CLASS}
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
      </Section>

      <Section
        title="Payment"
        description="Commercial terms used for invoicing and revenue tracking."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className={FIELD_LABEL_CLASS}>
          Payment amount
          <input
              className={INPUT_CLASS}
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
          <label className={FIELD_LABEL_CLASS}>
          Currency
          <input
              className={INPUT_CLASS}
            name="currency"
            defaultValue={fieldValue(terms?.currency ?? "USD")}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Payment terms
          <input
              className={INPUT_CLASS}
            name="paymentTerms"
            defaultValue={fieldValue(terms?.paymentTerms)}
          />
          <FieldSignals
            fieldPath="paymentTerms"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Payment structure
          <input
              className={INPUT_CLASS}
            name="paymentStructure"
            defaultValue={fieldValue(terms?.paymentStructure)}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Net terms days
          <input
              className={INPUT_CLASS}
            name="netTermsDays"
            defaultValue={terms?.netTermsDays ?? ""}
            type="number"
            step="1"
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Payment trigger
          <input
              className={INPUT_CLASS}
            name="paymentTrigger"
            defaultValue={fieldValue(terms?.paymentTrigger)}
          />
        </label>
        </div>
      </Section>

      <Section
        title="Deliverables"
        description="Use editable rows instead of raw JSON for deliverables and channel permissions."
      >
        <TermsArrayFieldsEditor
          deliverables={terms?.deliverables ?? []}
          usageChannels={terms?.usageChannels ?? []}
          inputClassName={INPUT_CLASS}
          textareaClassName={TEXTAREA_CLASS}
        />
        <FieldSignals
          fieldPath="deliverables"
          evidence={evidence}
          sections={sections}
          extractionResults={extractionResults}
        />
      </Section>

      <Section
        title="Usage rights"
        description="Usage, paid amplification, whitelisting, and territory settings."
      >
        <div className="grid gap-4">
          <label className={FIELD_LABEL_CLASS}>
          Usage rights summary
          <textarea
              className={TEXTAREA_CLASS}
            name="usageRights"
            defaultValue={fieldValue(terms?.usageRights)}
          />
          <FieldSignals
            fieldPath="usageRights"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className={FIELD_LABEL_CLASS}>
          Organic usage allowed
          <select
              className={SELECT_CLASS}
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
          <label className={FIELD_LABEL_CLASS}>
          Paid usage allowed
          <select
              className={SELECT_CLASS}
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
          <label className={FIELD_LABEL_CLASS}>
          Whitelisting allowed
          <select
              className={SELECT_CLASS}
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
          <label className={FIELD_LABEL_CLASS}>
          Usage duration
          <input
              className={INPUT_CLASS}
            name="usageDuration"
            defaultValue={fieldValue(terms?.usageDuration)}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Usage territory
          <input
              className={INPUT_CLASS}
            name="usageTerritory"
            defaultValue={fieldValue(terms?.usageTerritory)}
          />
        </label>
        </div>
      </Section>

      <Section
        title="Exclusivity"
        description="Restrictions on competitors, timing, and category overlap."
      >
        <div className="grid gap-4">
          <label className={FIELD_LABEL_CLASS}>
          Exclusivity summary
          <textarea
              className={`${TEXTAREA_CLASS} min-h-20`}
            name="exclusivity"
            defaultValue={fieldValue(terms?.exclusivity)}
          />
          <FieldSignals
            fieldPath="exclusivity"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <EditableStringListField
            title="Restricted categories"
            description="List the brands or categories this deal blocks you from working with."
            jsonName="restrictedCategoriesJson"
            textName="exclusivityRestrictions"
            initialValues={terms?.restrictedCategories ?? []}
            fallbackText={terms?.exclusivityRestrictions}
            inputClassName={INPUT_CLASS}
            emptyLabel="No restricted categories added yet."
            addLabel="Add restriction"
            placeholder="Cookie brands"
          />
          <EditableStringListField
            title="Competitor categories"
            description="Add the competitor groups this deal should be compared against."
            jsonName="competitorCategoriesJson"
            initialValues={terms?.competitorCategories ?? []}
            inputClassName={INPUT_CLASS}
            emptyLabel="No competitor categories added yet."
            addLabel="Add competitor group"
            placeholder="Packaged snack foods"
          />
        </div>
        <FieldSignals
          fieldPath="exclusivityRestrictions"
          evidence={evidence}
          sections={sections}
          extractionResults={extractionResults}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <label className={FIELD_LABEL_CLASS}>
          Exclusivity applies
          <select
              className={SELECT_CLASS}
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
          <label className={FIELD_LABEL_CLASS}>
          Exclusivity category
          <input
              className={INPUT_CLASS}
            name="exclusivityCategory"
            defaultValue={fieldValue(terms?.exclusivityCategory)}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Exclusivity duration
          <input
              className={INPUT_CLASS}
            name="exclusivityDuration"
            defaultValue={fieldValue(terms?.exclusivityDuration)}
          />
        </label>
        </div>
      </Section>

      <Section
        title="Revisions and termination"
        description="Revision limits, termination rights, and governing terms."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className={FIELD_LABEL_CLASS}>
          Revisions
          <input
              className={INPUT_CLASS}
            name="revisions"
            defaultValue={fieldValue(terms?.revisions)}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Revision rounds
          <input
              className={INPUT_CLASS}
            name="revisionRounds"
            defaultValue={terms?.revisionRounds ?? ""}
            type="number"
            step="1"
          />
        </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className={FIELD_LABEL_CLASS}>
          Termination summary
          <textarea
              className={`${TEXTAREA_CLASS} min-h-20`}
            name="termination"
            defaultValue={fieldValue(terms?.termination)}
          />
          <FieldSignals
            fieldPath="termination"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Termination conditions
          <textarea
              className={`${TEXTAREA_CLASS} min-h-20`}
            name="terminationConditions"
            defaultValue={fieldValue(terms?.terminationConditions)}
          />
        </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className={FIELD_LABEL_CLASS}>
          Termination allowed
          <select
              className={SELECT_CLASS}
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
          <label className={FIELD_LABEL_CLASS}>
          Termination notice
          <input
              className={INPUT_CLASS}
            name="terminationNotice"
            defaultValue={fieldValue(terms?.terminationNotice)}
          />
        </label>
          <label className={FIELD_LABEL_CLASS}>
          Governing law
          <input
              className={INPUT_CLASS}
            name="governingLaw"
            defaultValue={fieldValue(terms?.governingLaw)}
          />
          <FieldSignals
            fieldPath="governingLaw"
            evidence={evidence}
            sections={sections}
            extractionResults={extractionResults}
          />
        </label>
        </div>
      </Section>

      <Section title="Notes">
        <label className={FIELD_LABEL_CLASS}>
        Workspace notes
        <textarea
            className={TEXTAREA_CLASS}
          name="notes"
          defaultValue={fieldValue(terms?.notes)}
        />
      </label>
      </Section>

      <div className="sticky bottom-6 z-10 flex justify-end">
        <button className="inline-flex bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          Save key terms
        </button>
      </div>
    </form>
  );
}
