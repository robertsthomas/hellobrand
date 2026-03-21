"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil, X, Check } from "lucide-react";

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

const CURRENCY_OPTIONS = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "JPY", "CHF",
  "SEK", "NOK", "DKK", "SGD", "HKD", "BRL", "MXN", "INR",
  "KRW", "ZAR", "AED", "PLN", "CZK", "ILS", "THB", "PHP",
  "MYR", "IDR", "TWD", "VND", "CLP", "COP", "PEN", "ARS"
];

const INPUT_CLASS =
  "h-11 w-full border border-black/10 bg-white px-4 text-[15px] text-foreground shadow-none outline-none transition focus:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:focus:border-white/20";
const SELECT_CLASS = INPUT_CLASS;
const TEXTAREA_CLASS =
  "w-full resize-none border border-black/10 bg-white px-4 py-3 text-[15px] text-foreground shadow-none outline-none transition focus:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:focus:border-white/20";

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
  if (!value) return "";
  return stripHtmlTags(value);
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({
  title,
  description,
  editing,
  onToggleEdit,
  children
}: {
  title: string;
  description?: string;
  editing: boolean;
  onToggleEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 border-t border-black/8 pt-6 dark:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleEdit}
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
            editing
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-black/8 text-black/40 hover:border-black/15 hover:text-black/60 dark:border-white/10 dark:text-white/40 dark:hover:border-white/20 dark:hover:text-white/60"
          }`}
        >
          {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </button>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-only display helpers                                          */
/* ------------------------------------------------------------------ */

function ReadOnlyValue({ value, placeholder }: { value: string; placeholder?: string }) {
  const display = value.trim();
  if (!display) {
    return <span className="text-[15px] leading-7 text-black/30 dark:text-white/30">{placeholder ?? "Not set"}</span>;
  }
  return <span className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">{display}</span>;
}

function ReadOnlyBool({ value }: { value: boolean | null | undefined }) {
  if (value == null) return <span className="text-[15px] leading-7 text-black/30 dark:text-white/30">Unknown</span>;
  return <span className="text-[15px] leading-7 text-foreground">{value ? "Yes" : "No"}</span>;
}

function ReadOnlySelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const matched = options.find((o) => o.value === value);
  if (!matched || !value) return <span className="text-[15px] leading-7 text-black/30 dark:text-white/30">Not set</span>;
  return <span className="text-[15px] leading-7 text-foreground">{matched.label}</span>;
}

/* ------------------------------------------------------------------ */
/*  Field block – label + (read or edit) – NO signals inside           */
/* ------------------------------------------------------------------ */

function Field({
  label,
  editing,
  readOnly,
  editControl
}: {
  label: string;
  editing: boolean;
  readOnly: ReactNode;
  editControl: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-black/70 dark:text-white/75">{label}</span>
      {editing ? editControl : readOnly}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Signals – rendered outside grid rows to prevent misalignment       */
/* ------------------------------------------------------------------ */

function EvidenceList({
  fieldPath,
  evidence,
  sections
}: {
  fieldPath: string;
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
}) {
  const matches = evidence.filter((e) => e.fieldPath === fieldPath);
  if (matches.length === 0) return null;

  return (
    <details className="border-t border-black/8 pt-3 dark:border-white/10">
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
        Evidence ({Math.min(matches.length, 3)})
      </summary>
      <div className="mt-3 divide-y divide-black/8 border border-black/8 dark:divide-white/10 dark:border-white/10">
        {matches.slice(0, 3).map((entry) => (
          <div key={entry.id} className="px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
              {sections.find((s) => s.id === entry.sectionId)?.title ?? "Detected in document"}
            </p>
            <p className="mt-1 text-xs leading-5 text-black/60 dark:text-white/65">{entry.snippet}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ConflictCallout({ fieldPath, extractionResults }: { fieldPath: string; extractionResults: ExtractionResultRecord[] }) {
  const matches = extractionResults.filter((r) => r.conflicts.includes(fieldPath));
  if (matches.length === 0) return null;
  return (
    <div className="border-l-2 border-clay/60 bg-clay/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-clay">Needs review</p>
      <p className="mt-1 text-xs leading-5 text-black/65 dark:text-white/70">
        Conflicting extracted values were detected for {humanizeToken(fieldPath)}.
        Confirm this field before relying on it in outreach or tracking.
      </p>
    </div>
  );
}

function Signals({
  fields,
  evidence,
  sections,
  extractionResults
}: {
  fields: string[];
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
  extractionResults: ExtractionResultRecord[];
}) {
  const hasAny = fields.some(
    (f) =>
      evidence.some((e) => e.fieldPath === f) ||
      extractionResults.some((r) => r.conflicts.includes(f))
  );
  if (!hasAny) return null;

  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f} className="space-y-2">
          <ConflictCallout fieldPath={f} extractionResults={extractionResults} />
          <EvidenceList fieldPath={f} evidence={evidence} sections={sections} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Boolean select helper                                              */
/* ------------------------------------------------------------------ */

function BoolSelect({ name, value }: { name: string; value: boolean | null | undefined }) {
  return (
    <select className={SELECT_CLASS} name={name} defaultValue={value == null ? "" : String(value)}>
      <option value="">Unknown</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  );
}

function boolHidden(name: string, value: boolean | null | undefined) {
  return <input type="hidden" name={name} value={value == null ? "" : String(value)} />;
}

function textHidden(name: string, value: string) {
  return <input type="hidden" name={name} value={value} />;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

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
  const conflictCount = new Set(extractionResults.flatMap((r) => r.conflicts)).size;
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});
  function toggle(key: string) { setEditingSections((p) => ({ ...p, [key]: !p[key] })); }
  function ed(key: string) { return editingSections[key] ?? false; }

  const catOpts = DEAL_CATEGORY_OPTIONS.map((c) => ({ value: c, label: dealCategoryLabel(c) ?? c }));
  const curOpts = CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }));

  return (
    <form
      action={saveTermsAction}
      className="grid gap-8 border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]"
    >
      <div>
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Key terms</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/65">
          These fields are prefilled from uploaded documents. Tap the pencil icon to edit a section.
        </p>
        {conflictCount > 0 ? (
          <div className="mt-4 border-l-2 border-clay/60 bg-clay/5 px-4 py-3 text-sm text-black/70 dark:text-white/75">
            {conflictCount} field{conflictCount === 1 ? "" : "s"} have conflicting extracted values. Review them before using these terms.
          </div>
        ) : null}
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      {/* ───── Partnership ───── */}
      <Section title="Partnership" description="Core identifying details for the partnership and the external team." editing={ed("partnership")} onToggleEdit={() => toggle("partnership")}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Brand name" editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.brandName)} />}
            editControl={<input className={INPUT_CLASS} name="brandName" type="text" defaultValue={fieldValue(terms?.brandName)} />}
          />
          <Field label="Campaign name" editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.campaignName)} />}
            editControl={<input className={INPUT_CLASS} name="campaignName" type="text" defaultValue={fieldValue(terms?.campaignName)} />}
          />
          <Field label="Creator name" editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.creatorName)} />}
            editControl={<input className={INPUT_CLASS} name="creatorName" type="text" defaultValue={fieldValue(terms?.creatorName)} />}
          />
          <Field label="Agency name" editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.agencyName)} />}
            editControl={<input className={INPUT_CLASS} name="agencyName" type="text" defaultValue={fieldValue(terms?.agencyName)} />}
          />
          <Field label="Brand category" editing={ed("partnership")}
            readOnly={<ReadOnlySelect value={terms?.brandCategory ?? ""} options={catOpts} />}
            editControl={
              <select className={SELECT_CLASS} name="brandCategory" defaultValue={terms?.brandCategory ?? ""}>
                <option value="">Not set</option>
                {DEAL_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{dealCategoryLabel(c)}</option>)}
              </select>
            }
          />
        </div>
        <Signals fields={["brandName", "campaignName", "creatorName", "agencyName", "brandCategory"]} evidence={evidence} sections={sections} extractionResults={extractionResults} />
        {!ed("partnership") ? (
          <>
            {textHidden("brandName", fieldValue(terms?.brandName))}
            {textHidden("campaignName", fieldValue(terms?.campaignName))}
            {textHidden("creatorName", fieldValue(terms?.creatorName))}
            {textHidden("agencyName", fieldValue(terms?.agencyName))}
            {textHidden("brandCategory", terms?.brandCategory ?? "")}
          </>
        ) : null}
      </Section>

      {/* ───── Payment ───── */}
      <Section title="Payment" description="Commercial terms used for invoicing and revenue tracking." editing={ed("payment")} onToggleEdit={() => toggle("payment")}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Payment amount" editing={ed("payment")}
            readOnly={<ReadOnlyValue value={terms?.paymentAmount != null ? String(terms.paymentAmount) : ""} placeholder="No amount set" />}
            editControl={<input className={INPUT_CLASS} name="paymentAmount" type="number" step="0.01" defaultValue={terms?.paymentAmount ?? ""} />}
          />
          <Field label="Currency" editing={ed("payment")}
            readOnly={<ReadOnlyValue value={terms?.currency ?? "USD"} />}
            editControl={
              <select className={SELECT_CLASS} name="currency" defaultValue={terms?.currency ?? "USD"}>
                {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            }
          />
          <Field label="Payment terms" editing={ed("payment")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.paymentTerms)} />}
            editControl={<textarea className={`${TEXTAREA_CLASS} min-h-[4.5rem]`} name="paymentTerms" defaultValue={fieldValue(terms?.paymentTerms)} />}
          />
          <Field label="Payment structure" editing={ed("payment")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.paymentStructure)} />}
            editControl={<input className={INPUT_CLASS} name="paymentStructure" type="text" defaultValue={fieldValue(terms?.paymentStructure)} />}
          />
          <Field label="Net terms days" editing={ed("payment")}
            readOnly={<ReadOnlyValue value={terms?.netTermsDays != null ? String(terms.netTermsDays) : ""} placeholder="Not set" />}
            editControl={<input className={INPUT_CLASS} name="netTermsDays" type="number" step="1" defaultValue={terms?.netTermsDays ?? ""} />}
          />
          <Field label="Payment trigger" editing={ed("payment")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.paymentTrigger)} />}
            editControl={<textarea className={`${TEXTAREA_CLASS} min-h-[4.5rem]`} name="paymentTrigger" defaultValue={fieldValue(terms?.paymentTrigger)} />}
          />
        </div>
        <Signals fields={["paymentAmount", "paymentTerms"]} evidence={evidence} sections={sections} extractionResults={extractionResults} />
        {!ed("payment") ? (
          <>
            {textHidden("paymentAmount", String(terms?.paymentAmount ?? ""))}
            {textHidden("currency", terms?.currency ?? "USD")}
            {textHidden("paymentTerms", fieldValue(terms?.paymentTerms))}
            {textHidden("paymentStructure", fieldValue(terms?.paymentStructure))}
            {textHidden("netTermsDays", String(terms?.netTermsDays ?? ""))}
            {textHidden("paymentTrigger", fieldValue(terms?.paymentTrigger))}
          </>
        ) : null}
      </Section>

      {/* ───── Deliverables (always editable) ───── */}
      <section className="grid gap-5 border-t border-black/8 pt-6 dark:border-white/10">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Deliverables</h3>
          <p className="text-sm text-muted-foreground">Use editable rows instead of raw JSON for deliverables and channel permissions.</p>
        </div>
        <TermsArrayFieldsEditor
          deliverables={terms?.deliverables ?? []}
          usageChannels={terms?.usageChannels ?? []}
          inputClassName={INPUT_CLASS}
          textareaClassName={TEXTAREA_CLASS}
        />
        <Signals fields={["deliverables"]} evidence={evidence} sections={sections} extractionResults={extractionResults} />
      </section>

      {/* ───── Usage rights ───── */}
      <Section title="Usage rights" description="Usage, paid amplification, whitelisting, and territory settings." editing={ed("usage")} onToggleEdit={() => toggle("usage")}>
        <Field label="Usage rights summary" editing={ed("usage")}
          readOnly={<ReadOnlyValue value={fieldValue(terms?.usageRights)} />}
          editControl={<textarea className={`${TEXTAREA_CLASS} min-h-24`} name="usageRights" defaultValue={fieldValue(terms?.usageRights)} />}
        />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
          <Field label="Organic usage allowed" editing={ed("usage")}
            readOnly={<ReadOnlyBool value={terms?.usageRightsOrganicAllowed} />}
            editControl={<BoolSelect name="usageRightsOrganicAllowed" value={terms?.usageRightsOrganicAllowed} />}
          />
          <Field label="Paid usage allowed" editing={ed("usage")}
            readOnly={<ReadOnlyBool value={terms?.usageRightsPaidAllowed} />}
            editControl={<BoolSelect name="usageRightsPaidAllowed" value={terms?.usageRightsPaidAllowed} />}
          />
          <Field label="Whitelisting allowed" editing={ed("usage")}
            readOnly={<ReadOnlyBool value={terms?.whitelistingAllowed} />}
            editControl={<BoolSelect name="whitelistingAllowed" value={terms?.whitelistingAllowed} />}
          />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Usage duration" editing={ed("usage")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.usageDuration)} />}
            editControl={<input className={INPUT_CLASS} name="usageDuration" type="text" defaultValue={fieldValue(terms?.usageDuration)} />}
          />
          <Field label="Usage territory" editing={ed("usage")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.usageTerritory)} />}
            editControl={<input className={INPUT_CLASS} name="usageTerritory" type="text" defaultValue={fieldValue(terms?.usageTerritory)} />}
          />
        </div>
        <Signals fields={["usageRights"]} evidence={evidence} sections={sections} extractionResults={extractionResults} />
        {!ed("usage") ? (
          <>
            {textHidden("usageRights", fieldValue(terms?.usageRights))}
            {boolHidden("usageRightsOrganicAllowed", terms?.usageRightsOrganicAllowed)}
            {boolHidden("usageRightsPaidAllowed", terms?.usageRightsPaidAllowed)}
            {boolHidden("whitelistingAllowed", terms?.whitelistingAllowed)}
            {textHidden("usageDuration", fieldValue(terms?.usageDuration))}
            {textHidden("usageTerritory", fieldValue(terms?.usageTerritory))}
          </>
        ) : null}
      </Section>

      {/* ───── Exclusivity ───── */}
      <Section title="Exclusivity" description="Restrictions on competitors, timing, and category overlap." editing={ed("exclusivity")} onToggleEdit={() => toggle("exclusivity")}>
        <Field label="Exclusivity summary" editing={ed("exclusivity")}
          readOnly={<ReadOnlyValue value={fieldValue(terms?.exclusivity)} />}
          editControl={<textarea className={`${TEXTAREA_CLASS} min-h-20`} name="exclusivity" defaultValue={fieldValue(terms?.exclusivity)} />}
        />

        {ed("exclusivity") ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            <EditableStringListField
              title="Restricted categories"
              description="List the brands or categories this partnership blocks you from working with."
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
              description="Add the competitor groups this partnership should be compared against."
              jsonName="competitorCategoriesJson"
              initialValues={terms?.competitorCategories ?? []}
              inputClassName={INPUT_CLASS}
              emptyLabel="No competitor categories added yet."
              addLabel="Add competitor group"
              placeholder="Packaged snack foods"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            <Field label="Restricted categories" editing={false}
              readOnly={<ReadOnlyValue value={(terms?.restrictedCategories ?? []).join(", ") || fieldValue(terms?.exclusivityRestrictions)} placeholder="No restrictions" />}
              editControl={null}
            />
            <Field label="Competitor categories" editing={false}
              readOnly={<ReadOnlyValue value={(terms?.competitorCategories ?? []).join(", ")} placeholder="No competitor categories" />}
              editControl={null}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
          <Field label="Exclusivity applies" editing={ed("exclusivity")}
            readOnly={<ReadOnlyBool value={terms?.exclusivityApplies} />}
            editControl={<BoolSelect name="exclusivityApplies" value={terms?.exclusivityApplies} />}
          />
          <Field label="Exclusivity category" editing={ed("exclusivity")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.exclusivityCategory)} />}
            editControl={<input className={INPUT_CLASS} name="exclusivityCategory" type="text" defaultValue={fieldValue(terms?.exclusivityCategory)} />}
          />
          <Field label="Exclusivity duration" editing={ed("exclusivity")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.exclusivityDuration)} />}
            editControl={<input className={INPUT_CLASS} name="exclusivityDuration" type="text" defaultValue={fieldValue(terms?.exclusivityDuration)} />}
          />
        </div>
        <Signals fields={["exclusivity", "exclusivityRestrictions"]} evidence={evidence} sections={sections} extractionResults={extractionResults} />
        {!ed("exclusivity") ? (
          <>
            {textHidden("exclusivity", fieldValue(terms?.exclusivity))}
            {boolHidden("exclusivityApplies", terms?.exclusivityApplies)}
            {textHidden("exclusivityCategory", fieldValue(terms?.exclusivityCategory))}
            {textHidden("exclusivityDuration", fieldValue(terms?.exclusivityDuration))}
            {textHidden("exclusivityRestrictions", fieldValue(terms?.exclusivityRestrictions))}
            <input type="hidden" name="restrictedCategoriesJson" value={JSON.stringify(terms?.restrictedCategories ?? [])} />
            <input type="hidden" name="competitorCategoriesJson" value={JSON.stringify(terms?.competitorCategories ?? [])} />
          </>
        ) : null}
      </Section>

      {/* ───── Revisions & termination ───── */}
      <Section title="Revisions and termination" description="Revision limits, termination rights, and governing terms." editing={ed("termination")} onToggleEdit={() => toggle("termination")}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Revisions" editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.revisions)} />}
            editControl={<input className={INPUT_CLASS} name="revisions" type="text" defaultValue={fieldValue(terms?.revisions)} />}
          />
          <Field label="Revision rounds" editing={ed("termination")}
            readOnly={<ReadOnlyValue value={terms?.revisionRounds != null ? String(terms.revisionRounds) : ""} placeholder="Not set" />}
            editControl={<input className={INPUT_CLASS} name="revisionRounds" type="number" step="1" defaultValue={terms?.revisionRounds ?? ""} />}
          />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Termination summary" editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.termination)} />}
            editControl={<textarea className={`${TEXTAREA_CLASS} min-h-20`} name="termination" defaultValue={fieldValue(terms?.termination)} />}
          />
          <Field label="Termination conditions" editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.terminationConditions)} />}
            editControl={<textarea className={`${TEXTAREA_CLASS} min-h-20`} name="terminationConditions" defaultValue={fieldValue(terms?.terminationConditions)} />}
          />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
          <Field label="Termination allowed" editing={ed("termination")}
            readOnly={<ReadOnlyBool value={terms?.terminationAllowed} />}
            editControl={<BoolSelect name="terminationAllowed" value={terms?.terminationAllowed} />}
          />
          <Field label="Termination notice" editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.terminationNotice)} />}
            editControl={<input className={INPUT_CLASS} name="terminationNotice" type="text" defaultValue={fieldValue(terms?.terminationNotice)} />}
          />
          <Field label="Governing law" editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.governingLaw)} />}
            editControl={<input className={INPUT_CLASS} name="governingLaw" type="text" defaultValue={fieldValue(terms?.governingLaw)} />}
          />
        </div>
        <Signals fields={["termination", "governingLaw"]} evidence={evidence} sections={sections} extractionResults={extractionResults} />
        {!ed("termination") ? (
          <>
            {textHidden("revisions", fieldValue(terms?.revisions))}
            {textHidden("revisionRounds", String(terms?.revisionRounds ?? ""))}
            {textHidden("termination", fieldValue(terms?.termination))}
            {textHidden("terminationConditions", fieldValue(terms?.terminationConditions))}
            {boolHidden("terminationAllowed", terms?.terminationAllowed)}
            {textHidden("terminationNotice", fieldValue(terms?.terminationNotice))}
            {textHidden("governingLaw", fieldValue(terms?.governingLaw))}
          </>
        ) : null}
      </Section>

      {/* ───── Notes ───── */}
      <Section title="Notes" editing={ed("notes")} onToggleEdit={() => toggle("notes")}>
        {ed("notes") ? (
          <textarea className={`${TEXTAREA_CLASS} min-h-24`} name="notes" defaultValue={fieldValue(terms?.notes)} placeholder="Add workspace notes..." />
        ) : (
          <>
            <ReadOnlyValue value={fieldValue(terms?.notes)} placeholder="No notes yet" />
            {textHidden("notes", fieldValue(terms?.notes))}
          </>
        )}
      </Section>

      <div className="sticky bottom-6 z-10 flex justify-end">
        <button className="inline-flex items-center gap-2 bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          <Check className="h-4 w-4" />
          Save key terms
        </button>
      </div>
    </form>
  );
}
