"use client";

/**
 * This file renders the deal terms editor.
 * It manages the local editing and review experience while saving and merge logic stay in the deal domain modules.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LoaderCircle, Pencil, X } from "lucide-react";

import { confirmTermsReviewAction, saveTermsAction } from "@/app/actions";
import {
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/generic/form";
import { dealCategoryLabel } from "@/lib/conflict-categories";
import {
  EditableStringListField,
  TermsArrayFieldsEditor,
} from "@/components/terms-array-fields-editor";
import { SubmitButton } from "@/components/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DealTermsRecord,
  DocumentSectionRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord,
} from "@/lib/types";
import { ProseText } from "@/components/prose-text";
import {
  CURRENCY_OPTIONS,
  DEAL_CATEGORY_OPTIONS,
  DEAL_FIELD_LABELS,
  DEAL_REVIEW_SECTION_FIELDS,
} from "@/lib/deal-terms-constants";
import { humanizeToken, stripHtmlTags } from "@/lib/utils";

function fieldValue(value: string | null | undefined) {
  if (!value) return "";
  return stripHtmlTags(value);
}

function formatReviewValue(terms: DealTermsRecord | null, fieldPath: string) {
  switch (fieldPath) {
    case "brandCategory":
      return terms?.brandCategory ? dealCategoryLabel(terms.brandCategory) : "Not set";
    case "paymentAmount":
      return terms?.paymentAmount != null
        ? `${terms.paymentAmount} ${terms?.currency ?? "USD"}`
        : "Not set";
    case "deliverables":
      return terms?.deliverables?.length
        ? `${terms.deliverables.length} deliverable${terms.deliverables.length === 1 ? "" : "s"}`
        : "No deliverables";
    case "exclusivityRestrictions":
      return (terms?.restrictedCategories ?? []).length > 0
        ? (terms?.restrictedCategories ?? []).join(", ")
        : fieldValue(terms?.exclusivityRestrictions);
    default: {
      const value = terms?.[fieldPath as keyof DealTermsRecord];
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (typeof value === "number") return String(value);
      if (typeof value === "string") return fieldValue(value);
      if (Array.isArray(value)) {
        if (value.length === 0) return "None";
        return value.join(", ");
      }
      return "Not set";
    }
  }
}

function reviewBadgeLabel(count: number) {
  return `${count} review item${count === 1 ? "" : "s"}`;
}

function serializeFormState(form: HTMLFormElement) {
  const entries = Array.from(new FormData(form).entries())
    .filter(([_, value]) => typeof value === "string")
    .map(([key, value]) => [key, value] as const)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return JSON.stringify(entries);
}

function structuredReadOnlyRows(value: string) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const rows: Array<{ label: string; value: string }> = [];

  for (const line of lines) {
    const match = line.match(/^([^:]{2,48}):\s*(.*)$/);
    if (match) {
      rows.push({
        label: match[1].trim(),
        value: match[2].trim() || "Not set",
      });
      continue;
    }

    if (rows.length === 0) {
      return null;
    }

    const previous = rows[rows.length - 1];
    previous.value = `${previous.value} ${line}`.trim();
  }

  return rows.length >= 2 ? rows : null;
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({
  sectionKey,
  title,
  description,
  open,
  onToggleOpen,
  editing,
  showEditToggle = true,
  reviewCount = 0,
  onToggleEdit,
  onOpenReview,
  children,
}: {
  sectionKey: string;
  title: string;
  description?: string;
  open: boolean;
  onToggleOpen: () => void;
  editing: boolean;
  showEditToggle?: boolean;
  reviewCount?: number;
  onToggleEdit: () => void;
  onOpenReview?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      data-section={sectionKey}
      className="border-t border-black/8 pt-6 dark:border-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
        >
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-black/45 transition-transform dark:text-white/45 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {reviewCount > 0 && onOpenReview ? (
            <button
              type="button"
              onClick={onOpenReview}
              className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap border border-clay/20 bg-clay/5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-clay transition hover:border-clay/35"
            >
              {reviewBadgeLabel(reviewCount)}
            </button>
          ) : null}
          {showEditToggle ? (
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
          ) : null}
        </div>
      </div>
      {open ? <div className="mt-5 grid gap-5">{children}</div> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-only display helpers                                          */
/* ------------------------------------------------------------------ */

function ReadOnlyValue({ value, placeholder }: { value: string; placeholder?: string }) {
  const display = value.trim();
  if (!display) {
    return (
      <span className="text-[15px] leading-7 text-black/30 dark:text-white/30">
        {placeholder ?? "Not set"}
      </span>
    );
  }

  const rows = structuredReadOnlyRows(display);
  if (rows) {
    return (
      <dl className="grid gap-3">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="grid gap-1 border-b border-black/6 pb-3 last:border-b-0 last:pb-0 dark:border-white/10"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/45">
              {row.label}
            </dt>
            <dd className="text-[15px] leading-7 text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <span className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">{display}</span>
  );
}

function ReadOnlyBool({ value }: { value: boolean | null | undefined }) {
  if (value == null)
    return <span className="text-[15px] leading-7 text-black/30 dark:text-white/30">Unknown</span>;
  return <span className="text-[15px] leading-7 text-foreground">{value ? "Yes" : "No"}</span>;
}

function ReadOnlySelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
  const matched = options.find((o) => o.value === value);
  if (!matched || !value)
    return <span className="text-[15px] leading-7 text-black/30 dark:text-white/30">Not set</span>;
  return <span className="text-[15px] leading-7 text-foreground">{matched.label}</span>;
}

/* ------------------------------------------------------------------ */
/*  Field block – label + (read or edit) – NO signals inside           */
/* ------------------------------------------------------------------ */

function Field({
  label,
  editing,
  readOnly,
  editControl,
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
  sections,
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
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-black/60 dark:text-white/65">
              {fieldValue(entry.snippet) || "Excerpt unavailable."}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function Signals({
  fields,
  evidence,
  sections,
}: {
  fields: string[];
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
}) {
  const hasAny = fields.some((f) => evidence.some((e) => e.fieldPath === f));
  if (!hasAny) return null;

  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f} className="space-y-2">
          <EvidenceList fieldPath={f} evidence={evidence} sections={sections} />
        </div>
      ))}
    </div>
  );
}

function ReviewDialog({
  open,
  title,
  items,
  onOpenChange,
  onConfirm,
  confirmingField,
}: {
  open: boolean;
  title: string;
  items: Array<{ fieldPath: string; label: string; value: string }>;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fieldPath: string) => Promise<void>;
  confirmingField: string | null;
}) {
  const [dismissedFields, setDismissedFields] = useState<Set<string>>(new Set());

  const visibleItems = items.filter((item) => !dismissedFields.has(item.fieldPath));

  const handleConfirm = async (fieldPath: string) => {
    setDismissedFields((prev) => new Set([...prev, fieldPath]));
    await onConfirm(fieldPath);
  };

  useEffect(() => {
    if (open) {
      setDismissedFields(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (visibleItems.length === 0 && open && items.length > 0) {
      onOpenChange(false);
    }
  }, [visibleItems.length, open, items.length, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Partnership review</DialogTitle>
          <DialogDescription>
            Confirm the current value for any field that still needs review. This saves immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <div
              key={item.fieldPath}
              className="space-y-3 border border-black/8 px-4 py-4 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                {item.value ? (
                  <ProseText
                    content={item.value}
                    className="mt-2 text-sm leading-6 text-black/65 dark:text-white/70"
                  />
                ) : (
                  <p className="mt-2 text-sm text-black/65 dark:text-white/70">Not set</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleConfirm(item.fieldPath)}
                disabled={confirmingField === item.fieldPath}
                className="inline-flex h-10 w-full items-center justify-center gap-2 border border-black/10 bg-white text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
              >
                {confirmingField === item.fieldPath ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm value"
                )}
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Boolean select helper                                              */
/* ------------------------------------------------------------------ */

function BoolSelect({ name, value }: { name: string; value: boolean | null | undefined }) {
  return (
    <select
      className={FORM_SELECT_CLASS}
      name={name}
      defaultValue={value == null ? "" : String(value)}
    >
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

function mixedSectionTwoUpGrid(editing: boolean) {
  return `grid grid-cols-1 gap-x-8 gap-y-5 ${editing ? "md:grid-cols-2" : "md:grid-cols-3"}`;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function TermsEditor({
  dealId,
  terms,
  evidence,
  sections,
  extractionResults,
}: {
  dealId: string;
  terms: DealTermsRecord | null;
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
  extractionResults: ExtractionResultRecord[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const initialSnapshotRef = useRef<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    partnership: true,
    payment: true,
    workflow: true,
    deliverables: true,
    usage: true,
    exclusivity: true,
    termination: true,
    notes: true,
  });
  const [openReviewSection, setOpenReviewSection] = useState<
    keyof typeof DEAL_REVIEW_SECTION_FIELDS | null
  >(null);
  const [confirmingField, setConfirmingField] = useState<string | null>(null);
  function toggle(key: string) {
    setEditingSections((p) => ({ ...p, [key]: !p[key] }));
  }
  function ed(key: string) {
    return editingSections[key] ?? false;
  }
  function toggleOpen(key: string) {
    setOpenSections((current) => ({ ...current, [key]: !(current[key] ?? true) }));
  }
  function isOpen(key: string) {
    return openSections[key] ?? true;
  }

  const catOpts = DEAL_CATEGORY_OPTIONS.map((c) => ({
    value: c,
    label: dealCategoryLabel(c) ?? c,
  }));
  const briefTermDetails = terms?.briefData ?? null;
  const hasWorkflowTerms = Boolean(
    briefTermDetails?.campaignCode ||
      briefTermDetails?.jobNumber ||
      briefTermDetails?.referenceId ||
      briefTermDetails?.creatorHandle ||
      briefTermDetails?.agreementStartDate ||
      briefTermDetails?.agreementEndDate ||
      briefTermDetails?.executionTargetDate ||
      briefTermDetails?.campaignFlight ||
      briefTermDetails?.postingSchedule ||
      briefTermDetails?.conceptDueDate ||
      terms?.campaignDateWindow?.startDate ||
      terms?.campaignDateWindow?.endDate ||
      briefTermDetails?.draftDueDate ||
      briefTermDetails?.contentDueDate ||
      briefTermDetails?.campaignLiveDate ||
      briefTermDetails?.postDuration ||
      briefTermDetails?.amplificationPeriod ||
      briefTermDetails?.approvalRequirements ||
      briefTermDetails?.revisionRequirements ||
      briefTermDetails?.reportingRequirements
  );
  const hasOperationalPaymentTerms = Boolean(
    briefTermDetails?.paymentSchedule ||
      briefTermDetails?.paymentRequirements ||
      briefTermDetails?.paymentNotes
  );
  const manuallyReviewedFields = useMemo(
    () => new Set(terms?.manuallyEditedFields ?? []),
    [terms?.manuallyEditedFields]
  );
  const activeConflictFields = useMemo(
    () =>
      new Set(
        extractionResults
          .flatMap((result) => result.conflicts)
          .filter((fieldPath) => !manuallyReviewedFields.has(fieldPath))
      ),
    [extractionResults, manuallyReviewedFields]
  );
  const conflictCount = activeConflictFields.size;

  const sectionReviewItems = useMemo(() => {
    const entries = Object.entries(DEAL_REVIEW_SECTION_FIELDS).map(([sectionKey, fieldPaths]) => [
      sectionKey,
      fieldPaths
        .filter((fieldPath) => activeConflictFields.has(fieldPath))
        .map((fieldPath) => ({
          fieldPath,
          label: DEAL_FIELD_LABELS[fieldPath] ?? humanizeToken(fieldPath),
          value: formatReviewValue(terms, fieldPath),
        })),
    ]);

    return Object.fromEntries(entries) as Record<
      keyof typeof DEAL_REVIEW_SECTION_FIELDS,
      Array<{ fieldPath: string; label: string; value: string }>
    >;
  }, [activeConflictFields, terms]);

  useEffect(() => {
    if (openReviewSection && sectionReviewItems[openReviewSection].length === 0) {
      setOpenReviewSection(null);
    }
  }, [openReviewSection, sectionReviewItems]);

  async function handleConfirmReview(fieldPath: string) {
    setConfirmingField(fieldPath);
    try {
      const formData = new FormData();
      formData.set("dealId", dealId);
      formData.set("fieldPath", fieldPath);
      await confirmTermsReviewAction(formData);
      router.refresh();
    } finally {
      setConfirmingField(null);
    }
  }

  const syncPendingChanges = useCallback(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const snapshot = serializeFormState(form);
    if (initialSnapshotRef.current === null) {
      initialSnapshotRef.current = snapshot;
      setHasPendingChanges(false);
      return;
    }

    setHasPendingChanges(snapshot !== initialSnapshotRef.current);
  }, []);

  useEffect(() => {
    initialSnapshotRef.current = null;
    syncPendingChanges();
  }, [dealId, terms, syncPendingChanges]);

  return (
    <form
      ref={formRef}
      action={saveTermsAction}
      onInput={syncPendingChanges}
      onChange={syncPendingChanges}
      className="grid gap-8 border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6"
    >
      <div>
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Key terms</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/65">
          These fields are prefilled from uploaded documents. Tap the pencil icon to edit a section.
        </p>
        {conflictCount > 0 ? (
          <div className="mt-4 border-l-2 border-clay/60 bg-clay/5 px-4 py-3 text-sm text-black/70 dark:text-white/75">
            {conflictCount} field{conflictCount === 1 ? "" : "s"} still need review. Use the section
            badges to confirm them quickly.
          </div>
        ) : null}
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      {/* ───── Partnership ───── */}
      <Section
        sectionKey="partnership"
        title="Partnership"
        description="Core identifying details for the partnership and the external team."
        open={isOpen("partnership")}
        onToggleOpen={() => toggleOpen("partnership")}
        editing={ed("partnership")}
        reviewCount={sectionReviewItems.partnership.length}
        onOpenReview={() => setOpenReviewSection("partnership")}
        onToggleEdit={() => toggle("partnership")}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field
            label="Brand name"
            editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.brandName)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="brandName"
                type="text"
                defaultValue={fieldValue(terms?.brandName)}
              />
            }
          />
          <Field
            label="Campaign name"
            editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.campaignName)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="campaignName"
                type="text"
                defaultValue={fieldValue(terms?.campaignName)}
              />
            }
          />
          <Field
            label="Creator name"
            editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.creatorName)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="creatorName"
                type="text"
                defaultValue={fieldValue(terms?.creatorName)}
              />
            }
          />
          <Field
            label="Agency name"
            editing={ed("partnership")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.agencyName)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="agencyName"
                type="text"
                defaultValue={fieldValue(terms?.agencyName)}
              />
            }
          />
          <Field
            label="Brand category"
            editing={ed("partnership")}
            readOnly={<ReadOnlySelect value={terms?.brandCategory ?? ""} options={catOpts} />}
            editControl={
              <select
                className={FORM_SELECT_CLASS}
                name="brandCategory"
                defaultValue={terms?.brandCategory ?? ""}
              >
                <option value="">Not set</option>
                {DEAL_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {dealCategoryLabel(c)}
                  </option>
                ))}
              </select>
            }
          />
        </div>
        <Signals
          fields={["brandName", "campaignName", "creatorName", "agencyName", "brandCategory"]}
          evidence={evidence}
          sections={sections}
        />
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
      <Section
        sectionKey="payment"
        title="Payment"
        description="Commercial terms used for invoicing and revenue tracking."
        open={isOpen("payment")}
        onToggleOpen={() => toggleOpen("payment")}
        editing={ed("payment")}
        reviewCount={sectionReviewItems.payment.length}
        onOpenReview={() => setOpenReviewSection("payment")}
        onToggleEdit={() => toggle("payment")}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field
            label="Payment amount"
            editing={ed("payment")}
            readOnly={
              <ReadOnlyValue
                value={terms?.paymentAmount != null ? String(terms.paymentAmount) : ""}
                placeholder="No amount set"
              />
            }
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="paymentAmount"
                type="number"
                step="0.01"
                defaultValue={terms?.paymentAmount ?? ""}
              />
            }
          />
          <Field
            label="Currency"
            editing={ed("payment")}
            readOnly={<ReadOnlyValue value={terms?.currency ?? "USD"} />}
            editControl={
              <select
                className={FORM_SELECT_CLASS}
                name="currency"
                defaultValue={terms?.currency ?? "USD"}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            }
          />
          <Field
            label="Payment terms"
            editing={ed("payment")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.paymentTerms)} />}
            editControl={
              <textarea
                className={`${FORM_TEXTAREA_CLASS} min-h-[4.5rem]`}
                name="paymentTerms"
                defaultValue={fieldValue(terms?.paymentTerms)}
              />
            }
          />
          <Field
            label="Payment structure"
            editing={ed("payment")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.paymentStructure)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="paymentStructure"
                type="text"
                defaultValue={fieldValue(terms?.paymentStructure)}
              />
            }
          />
          <Field
            label="Net terms days"
            editing={ed("payment")}
            readOnly={
              <ReadOnlyValue
                value={terms?.netTermsDays != null ? String(terms.netTermsDays) : ""}
                placeholder="Not set"
              />
            }
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="netTermsDays"
                type="number"
                step="1"
                defaultValue={terms?.netTermsDays ?? ""}
              />
            }
          />
          <Field
            label="Payment trigger"
            editing={ed("payment")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.paymentTrigger)} />}
            editControl={
              <textarea
                className={`${FORM_TEXTAREA_CLASS} min-h-[4.5rem]`}
                name="paymentTrigger"
                defaultValue={fieldValue(terms?.paymentTrigger)}
              />
            }
          />
        </div>
        {hasOperationalPaymentTerms ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
            <Field
              label="Payment schedule"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.paymentSchedule)} />}
              editControl={null}
            />
            <Field
              label="Payment requirements"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.paymentRequirements)} />}
              editControl={null}
            />
            <Field
              label="Payment notes"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.paymentNotes)} />}
              editControl={null}
            />
          </div>
        ) : null}
        <Signals
          fields={[
            "paymentAmount",
            "paymentTerms",
            "paymentTrigger",
            "briefData.paymentSchedule",
            "briefData.paymentRequirements",
            "briefData.paymentNotes",
          ]}
          evidence={evidence}
          sections={sections}
        />
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

      {/* ───── Timeline & workflow ───── */}
      {hasWorkflowTerms ? (
        <Section
          sectionKey="workflow"
          title="Timeline and workflow"
          description="Dates, submission milestones, and approval requirements pulled from the agreement."
          open={isOpen("workflow")}
          onToggleOpen={() => toggleOpen("workflow")}
          editing={false}
          showEditToggle={false}
          onToggleEdit={() => undefined}
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            <Field
              label="Campaign code"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.campaignCode)} />}
              editControl={null}
            />
            <Field
              label="Job number"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.jobNumber)} />}
              editControl={null}
            />
            <Field
              label="Reference ID"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.referenceId)} />}
              editControl={null}
            />
            <Field
              label="Creator handle"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.creatorHandle)} />}
              editControl={null}
            />
            <Field
              label="Campaign flight"
              editing={false}
              readOnly={
                <ReadOnlyValue
                  value={
                    fieldValue(briefTermDetails?.campaignFlight) ||
                    fieldValue(terms?.campaignDateWindow?.postingWindow)
                  }
                />
              }
              editControl={null}
            />
            <Field
              label="Campaign start"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(terms?.campaignDateWindow?.startDate)} />}
              editControl={null}
            />
            <Field
              label="Campaign end"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(terms?.campaignDateWindow?.endDate)} />}
              editControl={null}
            />
            <Field
              label="Agreement start"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.agreementStartDate)} />}
              editControl={null}
            />
            <Field
              label="Agreement end"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.agreementEndDate)} />}
              editControl={null}
            />
            <Field
              label="Execution target"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.executionTargetDate)} />}
              editControl={null}
            />
            <Field
              label="Concept due"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.conceptDueDate)} />}
              editControl={null}
            />
            <Field
              label="Draft due"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.draftDueDate)} />}
              editControl={null}
            />
            <Field
              label="Content due"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.contentDueDate)} />}
              editControl={null}
            />
            <Field
              label="Live date"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.campaignLiveDate)} />}
              editControl={null}
            />
            <Field
              label="Posting schedule"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.postingSchedule)} />}
              editControl={null}
            />
            <Field
              label="Post duration"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.postDuration)} />}
              editControl={null}
            />
            <Field
              label="Amplification period"
              editing={false}
              readOnly={<ReadOnlyValue value={fieldValue(briefTermDetails?.amplificationPeriod)} />}
              editControl={null}
            />
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
            <Field
              label="Approval requirements"
              editing={false}
              readOnly={
                <ReadOnlyValue value={fieldValue(briefTermDetails?.approvalRequirements)} />
              }
              editControl={null}
            />
            <Field
              label="Revision requirements"
              editing={false}
              readOnly={
                <ReadOnlyValue value={fieldValue(briefTermDetails?.revisionRequirements)} />
              }
              editControl={null}
            />
            <Field
              label="Reporting requirements"
              editing={false}
              readOnly={
                <ReadOnlyValue value={fieldValue(briefTermDetails?.reportingRequirements)} />
              }
              editControl={null}
            />
          </div>
          <Signals
            fields={[
              "campaignDateWindow",
              "briefData.campaignCode",
              "briefData.jobNumber",
              "briefData.referenceId",
              "briefData.creatorHandle",
              "briefData.agreementStartDate",
              "briefData.agreementEndDate",
              "briefData.executionTargetDate",
              "briefData.campaignFlight",
              "briefData.postingSchedule",
              "briefData.conceptDueDate",
              "briefData.draftDueDate",
              "briefData.contentDueDate",
              "briefData.campaignLiveDate",
              "briefData.postDuration",
              "briefData.amplificationPeriod",
              "briefData.approvalRequirements",
              "briefData.revisionRequirements",
              "briefData.reportingRequirements",
            ]}
            evidence={evidence}
            sections={sections}
          />
        </Section>
      ) : null}

      {/* ───── Deliverables (always editable) ───── */}
      <Section
        sectionKey="deliverables"
        title="Deliverables"
        description="Use editable rows instead of raw JSON for deliverables and channel permissions."
        open={isOpen("deliverables")}
        onToggleOpen={() => toggleOpen("deliverables")}
        editing
        showEditToggle={false}
        reviewCount={sectionReviewItems.deliverables.length}
        onOpenReview={() => setOpenReviewSection("deliverables")}
        onToggleEdit={() => undefined}
      >
        <TermsArrayFieldsEditor
          deliverables={terms?.deliverables ?? []}
          usageChannels={terms?.usageChannels ?? []}
          inputClassName={FORM_INPUT_CLASS}
          textareaClassName={FORM_TEXTAREA_CLASS}
        />
        <Signals fields={["deliverables"]} evidence={evidence} sections={sections} />
      </Section>

      {/* ───── Usage rights ───── */}
      <Section
        sectionKey="usage"
        title="Usage rights"
        description="Usage, paid amplification, whitelisting, and territory settings."
        open={isOpen("usage")}
        onToggleOpen={() => toggleOpen("usage")}
        editing={ed("usage")}
        reviewCount={sectionReviewItems.usage.length}
        onOpenReview={() => setOpenReviewSection("usage")}
        onToggleEdit={() => toggle("usage")}
      >
        <Field
          label="Usage rights summary"
          editing={ed("usage")}
          readOnly={<ReadOnlyValue value={fieldValue(terms?.usageRights)} />}
          editControl={
            <textarea
              className={`${FORM_TEXTAREA_CLASS} min-h-24`}
              name="usageRights"
              defaultValue={fieldValue(terms?.usageRights)}
            />
          }
        />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
          <Field
            label="Organic usage allowed"
            editing={ed("usage")}
            readOnly={<ReadOnlyBool value={terms?.usageRightsOrganicAllowed} />}
            editControl={
              <BoolSelect
                name="usageRightsOrganicAllowed"
                value={terms?.usageRightsOrganicAllowed}
              />
            }
          />
          <Field
            label="Paid usage allowed"
            editing={ed("usage")}
            readOnly={<ReadOnlyBool value={terms?.usageRightsPaidAllowed} />}
            editControl={
              <BoolSelect name="usageRightsPaidAllowed" value={terms?.usageRightsPaidAllowed} />
            }
          />
          <Field
            label="Whitelisting allowed"
            editing={ed("usage")}
            readOnly={<ReadOnlyBool value={terms?.whitelistingAllowed} />}
            editControl={
              <BoolSelect name="whitelistingAllowed" value={terms?.whitelistingAllowed} />
            }
          />
        </div>
        <div className={mixedSectionTwoUpGrid(ed("usage"))}>
          <Field
            label="Usage duration"
            editing={ed("usage")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.usageDuration)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="usageDuration"
                type="text"
                defaultValue={fieldValue(terms?.usageDuration)}
              />
            }
          />
          <Field
            label="Usage territory"
            editing={ed("usage")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.usageTerritory)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="usageTerritory"
                type="text"
                defaultValue={fieldValue(terms?.usageTerritory)}
              />
            }
          />
        </div>
        <Signals fields={["usageRights"]} evidence={evidence} sections={sections} />
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
      <Section
        sectionKey="exclusivity"
        title="Exclusivity"
        description="Restrictions on competitors, timing, and category overlap."
        open={isOpen("exclusivity")}
        onToggleOpen={() => toggleOpen("exclusivity")}
        editing={ed("exclusivity")}
        reviewCount={sectionReviewItems.exclusivity.length}
        onOpenReview={() => setOpenReviewSection("exclusivity")}
        onToggleEdit={() => toggle("exclusivity")}
      >
        <Field
          label="Exclusivity summary"
          editing={ed("exclusivity")}
          readOnly={<ReadOnlyValue value={fieldValue(terms?.exclusivity)} />}
          editControl={
            <textarea
              className={`${FORM_TEXTAREA_CLASS} min-h-20`}
              name="exclusivity"
              defaultValue={fieldValue(terms?.exclusivity)}
            />
          }
        />

        {ed("exclusivity") ? (
          <div className={mixedSectionTwoUpGrid(true)}>
            <EditableStringListField
              title="Restricted categories"
              description="List the brands or categories this partnership blocks you from working with."
              jsonName="restrictedCategoriesJson"
              textName="exclusivityRestrictions"
              initialValues={terms?.restrictedCategories ?? []}
              fallbackText={terms?.exclusivityRestrictions}
              inputClassName={FORM_INPUT_CLASS}
              emptyLabel="No restricted categories added yet."
              addLabel="Add restriction"
              placeholder="Cookie brands"
            />
            <EditableStringListField
              title="Competitor categories"
              description="Add the competitor groups this partnership should be compared against."
              jsonName="competitorCategoriesJson"
              initialValues={terms?.competitorCategories ?? []}
              inputClassName={FORM_INPUT_CLASS}
              emptyLabel="No competitor categories added yet."
              addLabel="Add competitor group"
              placeholder="Packaged snack foods"
            />
          </div>
        ) : (
          <div className={mixedSectionTwoUpGrid(false)}>
            <Field
              label="Restricted categories"
              editing={false}
              readOnly={
                <ReadOnlyValue
                  value={
                    (terms?.restrictedCategories ?? []).join(", ") ||
                    fieldValue(terms?.exclusivityRestrictions)
                  }
                  placeholder="No restrictions"
                />
              }
              editControl={null}
            />
            <Field
              label="Competitor categories"
              editing={false}
              readOnly={
                <ReadOnlyValue
                  value={(terms?.competitorCategories ?? []).join(", ")}
                  placeholder="No competitor categories"
                />
              }
              editControl={null}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
          <Field
            label="Exclusivity applies"
            editing={ed("exclusivity")}
            readOnly={<ReadOnlyBool value={terms?.exclusivityApplies} />}
            editControl={<BoolSelect name="exclusivityApplies" value={terms?.exclusivityApplies} />}
          />
          <Field
            label="Exclusivity category"
            editing={ed("exclusivity")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.exclusivityCategory)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="exclusivityCategory"
                type="text"
                defaultValue={fieldValue(terms?.exclusivityCategory)}
              />
            }
          />
          <Field
            label="Exclusivity duration"
            editing={ed("exclusivity")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.exclusivityDuration)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="exclusivityDuration"
                type="text"
                defaultValue={fieldValue(terms?.exclusivityDuration)}
              />
            }
          />
        </div>
        <Signals
          fields={["exclusivity", "exclusivityRestrictions"]}
          evidence={evidence}
          sections={sections}
        />
        {!ed("exclusivity") ? (
          <>
            {textHidden("exclusivity", fieldValue(terms?.exclusivity))}
            {boolHidden("exclusivityApplies", terms?.exclusivityApplies)}
            {textHidden("exclusivityCategory", fieldValue(terms?.exclusivityCategory))}
            {textHidden("exclusivityDuration", fieldValue(terms?.exclusivityDuration))}
            {textHidden("exclusivityRestrictions", fieldValue(terms?.exclusivityRestrictions))}
            <input
              type="hidden"
              name="restrictedCategoriesJson"
              value={JSON.stringify(terms?.restrictedCategories ?? [])}
            />
            <input
              type="hidden"
              name="competitorCategoriesJson"
              value={JSON.stringify(terms?.competitorCategories ?? [])}
            />
          </>
        ) : null}
      </Section>

      {/* ───── Revisions & termination ───── */}
      <Section
        sectionKey="termination"
        title="Revisions and termination"
        description="Revision limits, termination rights, and governing terms."
        open={isOpen("termination")}
        onToggleOpen={() => toggleOpen("termination")}
        editing={ed("termination")}
        reviewCount={sectionReviewItems.termination.length}
        onOpenReview={() => setOpenReviewSection("termination")}
        onToggleEdit={() => toggle("termination")}
      >
        <div className={mixedSectionTwoUpGrid(ed("termination"))}>
          <Field
            label="Revisions"
            editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.revisions)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="revisions"
                type="text"
                defaultValue={fieldValue(terms?.revisions)}
              />
            }
          />
          <Field
            label="Revision rounds"
            editing={ed("termination")}
            readOnly={
              <ReadOnlyValue
                value={terms?.revisionRounds != null ? String(terms.revisionRounds) : ""}
                placeholder="Not set"
              />
            }
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="revisionRounds"
                type="number"
                step="1"
                defaultValue={terms?.revisionRounds ?? ""}
              />
            }
          />
        </div>
        <div className={mixedSectionTwoUpGrid(ed("termination"))}>
          <Field
            label="Termination summary"
            editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.termination)} />}
            editControl={
              <textarea
                className={`${FORM_TEXTAREA_CLASS} min-h-20`}
                name="termination"
                defaultValue={fieldValue(terms?.termination)}
              />
            }
          />
          <Field
            label="Termination conditions"
            editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.terminationConditions)} />}
            editControl={
              <textarea
                className={`${FORM_TEXTAREA_CLASS} min-h-20`}
                name="terminationConditions"
                defaultValue={fieldValue(terms?.terminationConditions)}
              />
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
          <Field
            label="Termination allowed"
            editing={ed("termination")}
            readOnly={<ReadOnlyBool value={terms?.terminationAllowed} />}
            editControl={<BoolSelect name="terminationAllowed" value={terms?.terminationAllowed} />}
          />
          <Field
            label="Termination notice"
            editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.terminationNotice)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="terminationNotice"
                type="text"
                defaultValue={fieldValue(terms?.terminationNotice)}
              />
            }
          />
          <Field
            label="Governing law"
            editing={ed("termination")}
            readOnly={<ReadOnlyValue value={fieldValue(terms?.governingLaw)} />}
            editControl={
              <input
                className={FORM_INPUT_CLASS}
                name="governingLaw"
                type="text"
                defaultValue={fieldValue(terms?.governingLaw)}
              />
            }
          />
        </div>
        <Signals fields={["termination", "governingLaw"]} evidence={evidence} sections={sections} />
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
      <Section
        sectionKey="notes"
        title="Notes"
        open={isOpen("notes")}
        onToggleOpen={() => toggleOpen("notes")}
        editing={ed("notes")}
        onToggleEdit={() => toggle("notes")}
      >
        {ed("notes") ? (
          <textarea
            className={`${FORM_TEXTAREA_CLASS} min-h-24`}
            name="notes"
            defaultValue={fieldValue(terms?.notes)}
            placeholder="Add workspace notes..."
          />
        ) : (
          <>
            <ReadOnlyValue value={fieldValue(terms?.notes)} placeholder="No notes yet" />
            {textHidden("notes", fieldValue(terms?.notes))}
          </>
        )}
      </Section>

      {openReviewSection ? (
        <ReviewDialog
          open
          title={
            openReviewSection === "usage"
              ? "Usage rights"
              : openReviewSection === "termination"
                ? "Revisions and termination"
                : openReviewSection.charAt(0).toUpperCase() + openReviewSection.slice(1)
          }
          items={sectionReviewItems[openReviewSection]}
          confirmingField={confirmingField}
          onOpenChange={(open) => {
            if (!open) {
              setOpenReviewSection(null);
            }
          }}
          onConfirm={handleConfirmReview}
        />
      ) : null}

      <div className="sticky bottom-6 z-10 flex justify-end">
        <SubmitButton
          pendingLabel="Saving key terms..."
          showSpinner
          disabled={!hasPendingChanges}
          className="inline-flex items-center gap-2 bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          Save key terms
        </SubmitButton>
      </div>
    </form>
  );
}
