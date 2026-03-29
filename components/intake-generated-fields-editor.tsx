"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { dealCategoryLabel, dealCategoryOptions } from "@/lib/conflict-intelligence";
import { createClientRowId, dedupeRowsById } from "@/lib/row-identity";
import type {
  CampaignDateWindow,
  DealCategory,
  DeliverableItem,
  DisclosureObligation,
  IntakeAnalyticsRecord,
  IntakeTimelineItem
} from "@/lib/types";

function joinLines(values: string[]) {
  return values.join("\n");
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function normalizeDeliverables(deliverables: DeliverableItem[]) {
  return dedupeRowsById(
    deliverables.map((item, index) => ({
      id: item.id || `deliverable-${index + 1}`,
      title: item.title ?? "",
      dueDate: toDateInputValue(item.dueDate),
      channel: item.channel ?? "",
      quantity: item.quantity,
      status: item.status ?? "pending",
      description: item.description ?? "",
      source: item.source ?? null
    }))
  );
}

function normalizeTimelineItems(items: IntakeTimelineItem[]) {
  return dedupeRowsById(
    items.map((item, index) => ({
      id: item.id || `timeline-${index + 1}`,
      label: item.label ?? "",
      date: toDateInputValue(item.date),
      source: item.source ?? "",
      status: item.status ?? "unknown"
    }))
  );
}

function normalizeDisclosureObligations(items: DisclosureObligation[]) {
  return dedupeRowsById(
    items.map((item, index) => ({
      id: item.id || `disclosure-${index + 1}`,
      title: item.title ?? "",
      detail: item.detail ?? "",
      source: item.source ?? ""
    }))
  );
}

export function IntakeGeneratedFieldsEditor({
  inputClassName,
  textareaClassName,
  initialBrandCategory,
  initialCompetitorCategories,
  initialRestrictedCategories,
  initialCampaignDateWindow,
  initialDisclosureObligations,
  initialDeliverables,
  initialTimelineItems,
  initialAnalytics,
  conflictMessagesByField = {}
}: {
  inputClassName: string;
  textareaClassName: string;
  initialBrandCategory: DealCategory | null;
  initialCompetitorCategories: string[];
  initialRestrictedCategories: string[];
  initialCampaignDateWindow: CampaignDateWindow | null;
  initialDisclosureObligations: DisclosureObligation[];
  initialDeliverables: DeliverableItem[];
  initialTimelineItems: IntakeTimelineItem[];
  initialAnalytics: IntakeAnalyticsRecord | null;
  conflictMessagesByField?: Partial<Record<ConflictFieldId, string[]>>;
}) {
  const [brandCategory, setBrandCategory] = useState<DealCategory | "">(
    initialBrandCategory ?? ""
  );
  const [competitorCategories, setCompetitorCategories] = useState(
    joinLines(initialCompetitorCategories)
  );
  const [restrictedCategories, setRestrictedCategories] = useState(
    joinLines(initialRestrictedCategories)
  );
  const [campaignDateWindow, setCampaignDateWindow] = useState({
    startDate: toDateInputValue(initialCampaignDateWindow?.startDate),
    endDate: toDateInputValue(initialCampaignDateWindow?.endDate),
    postingWindow: initialCampaignDateWindow?.postingWindow ?? ""
  });
  const [disclosureObligations, setDisclosureObligations] = useState(
    normalizeDisclosureObligations(initialDisclosureObligations)
  );
  const [deliverables, setDeliverables] = useState(
    normalizeDeliverables(initialDeliverables)
  );
  const [timelineItems, setTimelineItems] = useState(
    normalizeTimelineItems(initialTimelineItems)
  );
  const [analyticsHighlights, setAnalyticsHighlights] = useState(
    joinLines(initialAnalytics?.highlights ?? [])
  );

  const deliverablesJson = useMemo(
    () =>
      JSON.stringify(
        deliverables
          .map((item) => ({
            id: item.id,
            title: item.title.trim(),
            dueDate: item.dueDate?.trim() ? item.dueDate.trim() : null,
            channel: item.channel?.trim() ? item.channel.trim() : null,
            quantity:
              typeof item.quantity === "number" && Number.isFinite(item.quantity)
                ? item.quantity
                : null,
            status: item.status,
            description: item.description?.trim() ? item.description.trim() : null,
            source: item.source
          }))
          .filter((item) => item.title.length > 0)
      ),
    [deliverables]
  );

  const timelineItemsJson = useMemo(
    () =>
      JSON.stringify(
        timelineItems
          .map((item) => ({
            id: item.id,
            label: item.label.trim(),
            date: item.date?.trim() ? item.date.trim() : null,
            source: item.source?.trim() ? item.source.trim() : null,
            status: item.status
          }))
          .filter((item) => item.label.length > 0)
      ),
    [timelineItems]
  );

  const disclosureObligationsJson = useMemo(
    () =>
      JSON.stringify(
        disclosureObligations
          .map((item) => ({
            id: item.id,
            title: item.title.trim(),
            detail: item.detail.trim(),
            source: item.source?.trim() ? item.source.trim() : null
          }))
          .filter((item) => item.title.length > 0 && item.detail.length > 0)
      ),
    [disclosureObligations]
  );

  const competitorCategoriesJson = useMemo(
    () => JSON.stringify(splitLines(competitorCategories)),
    [competitorCategories]
  );

  const restrictedCategoriesJson = useMemo(
    () => JSON.stringify(splitLines(restrictedCategories)),
    [restrictedCategories]
  );

  const campaignDateWindowJson = useMemo(
    () =>
      JSON.stringify({
        startDate: campaignDateWindow.startDate || null,
        endDate: campaignDateWindow.endDate || null,
        postingWindow: campaignDateWindow.postingWindow.trim() || null
      }),
    [campaignDateWindow]
  );

  const analyticsJson = useMemo(
    () =>
      JSON.stringify({
        highlights: splitLines(analyticsHighlights)
      }),
    [analyticsHighlights]
  );

  function fieldClass(fieldId: ConflictFieldId) {
    const hasConflict = (conflictMessagesByField[fieldId] ?? []).length > 0;
    if (!hasConflict) {
      return "";
    }

    return "border-clay/40 bg-clay/[0.03] focus-visible:ring-clay/15";
  }

  function renderConflictNote(fieldId: ConflictFieldId) {
    const messages = conflictMessagesByField[fieldId] ?? [];
    if (messages.length === 0) {
      return null;
    }

    return (
      <div className="border-l-2 border-clay/45 pl-3 text-xs text-clay">
        {messages[0]}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input type="hidden" name="deliverablesJson" value={deliverablesJson} />
      <input type="hidden" name="timelineItemsJson" value={timelineItemsJson} />
      <input
        type="hidden"
        name="disclosureObligationsJson"
        value={disclosureObligationsJson}
      />
      <input
        type="hidden"
        name="competitorCategoriesJson"
        value={competitorCategoriesJson}
      />
      <input
        type="hidden"
        name="restrictedCategoriesJson"
        value={restrictedCategoriesJson}
      />
      <input
        type="hidden"
        name="campaignDateWindowJson"
        value={campaignDateWindowJson}
      />
      <input type="hidden" name="analyticsJson" value={analyticsJson} />

      <div className="grid gap-5 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Brand category
          <select
            className={`${inputClassName} ${fieldClass("brandCategory")}`}
            name="brandCategory"
            value={brandCategory}
            onChange={(event) =>
              setBrandCategory((event.target.value as DealCategory | "") ?? "")
            }
          >
            <option value="">Not set</option>
            {dealCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {dealCategoryLabel(category)}
              </option>
            ))}
          </select>
          {renderConflictNote("brandCategory")}
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Posting window start
          <input
            className={`${inputClassName} ${fieldClass("campaignDateWindow")}`}
            type="date"
            value={campaignDateWindow.startDate}
            onChange={(event) =>
              setCampaignDateWindow((current) => ({
                ...current,
                startDate: event.target.value
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Posting window end
          <input
            className={`${inputClassName} ${fieldClass("campaignDateWindow")}`}
            type="date"
            value={campaignDateWindow.endDate}
            onChange={(event) =>
              setCampaignDateWindow((current) => ({
                ...current,
                endDate: event.target.value
              }))
            }
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
        Posting window label
        <input
          className={`${inputClassName} ${fieldClass("campaignDateWindow")}`}
          value={campaignDateWindow.postingWindow}
          onChange={(event) =>
            setCampaignDateWindow((current) => ({
              ...current,
              postingWindow: event.target.value
            }))
          }
          placeholder="Apr 19, 2026 to Apr 22, 2026"
        />
        {renderConflictNote("campaignDateWindow")}
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Competitor categories
          <textarea
            className={`${textareaClassName} min-h-24 ${fieldClass("competitorCategories")}`}
            value={competitorCategories}
            onChange={(event) => setCompetitorCategories(event.target.value)}
            placeholder="One category per line"
          />
          <span className="text-xs font-normal text-black/50 dark:text-white/50">
            Use one category per line.
          </span>
          {renderConflictNote("competitorCategories")}
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Restricted categories
          <textarea
            className={`${textareaClassName} min-h-24 ${fieldClass("restrictedCategories")}`}
            value={restrictedCategories}
            onChange={(event) => setRestrictedCategories(event.target.value)}
            placeholder="One category per line"
          />
          <span className="text-xs font-normal text-black/50 dark:text-white/50">
            Use one category per line.
          </span>
          {renderConflictNote("restrictedCategories")}
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-black/70 dark:text-white/75">
              Disclosure obligations
            </div>
            <div className="text-xs text-black/50 dark:text-white/50">
              Edit or add disclosure and approval requirements before confirmation.
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-black/65 underline underline-offset-4 dark:text-white/65"
            onClick={() =>
              setDisclosureObligations((current) => [
                ...current,
                {
                  id: createClientRowId("disclosure"),
                  title: "",
                  detail: "",
                  source: ""
                }
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {disclosureObligations.length > 0 ? (
          <div className="grid gap-3">
            {disclosureObligations.map((item, index) => (
              <div key={item.id} className="grid gap-3 border border-black/8 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-ink">
                    Obligation {index + 1}
                  </div>
                  <button
                    type="button"
                    className="text-black/45 hover:text-clay dark:text-white/45 dark:hover:text-clay"
                    onClick={() =>
                      setDisclosureObligations((current) =>
                        current.filter((entry) => entry.id !== item.id)
                      )
                    }
                    aria-label={`Remove obligation ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  className={inputClassName}
                  value={item.title}
                  onChange={(event) =>
                    setDisclosureObligations((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, title: event.target.value } : entry
                      )
                    )
                  }
                  placeholder="Disclosure title"
                />
                <textarea
                  className={`${textareaClassName} min-h-24`}
                  value={item.detail}
                  onChange={(event) =>
                    setDisclosureObligations((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, detail: event.target.value } : entry
                      )
                    )
                  }
                  placeholder="Explain the requirement"
                />
                <input
                  className={inputClassName}
                  value={item.source}
                  onChange={(event) =>
                    setDisclosureObligations((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, source: event.target.value } : entry
                      )
                    )
                  }
                  placeholder="Source label"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-black/70 dark:text-white/75">
              Deliverables
            </div>
            <div className="text-xs text-black/50 dark:text-white/50">
              These can be corrected before the workspace is created.
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-black/65 underline underline-offset-4 dark:text-white/65"
            onClick={() =>
              setDeliverables((current) => [
                ...current,
                {
                  id: createClientRowId("deliverable"),
                  title: "",
                  dueDate: "",
                  channel: "",
                  quantity: null,
                  status: "pending",
                  description: "",
                  source: null
                }
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <div className={`grid gap-3 ${(conflictMessagesByField.deliverables ?? []).length > 0 ? "border-l-2 border-clay/45 pl-3" : ""}`}>
          {deliverables.map((item, index) => (
            <div key={item.id} className="grid gap-3 border border-black/8 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-ink">Deliverable {index + 1}</div>
                <button
                  type="button"
                  className="text-black/45 hover:text-clay dark:text-white/45 dark:hover:text-clay"
                  onClick={() =>
                    setDeliverables((current) =>
                      current.filter((entry) => entry.id !== item.id)
                    )
                  }
                  aria-label={`Remove deliverable ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className={inputClassName}
                  value={item.title}
                  onChange={(event) =>
                    setDeliverables((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, title: event.target.value } : entry
                      )
                    )
                  }
                  placeholder="Deliverable title"
                />
                <input
                  className={inputClassName}
                  value={item.channel}
                  onChange={(event) =>
                    setDeliverables((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, channel: event.target.value } : entry
                      )
                    )
                  }
                  placeholder="Channel"
                />
                <input
                  className={inputClassName}
                  type="number"
                  value={item.quantity ?? ""}
                  onChange={(event) =>
                    setDeliverables((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              quantity:
                                event.target.value.trim().length > 0
                                  ? Number(event.target.value)
                                  : null
                            }
                          : entry
                      )
                    )
                  }
                  placeholder="Quantity"
                />
                <input
                  className={inputClassName}
                  type="date"
                  value={item.dueDate}
                  onChange={(event) =>
                    setDeliverables((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, dueDate: event.target.value } : entry
                      )
                    )
                  }
                />
              </div>
              <textarea
                className={`${textareaClassName} min-h-24`}
                value={item.description}
                onChange={(event) =>
                  setDeliverables((current) =>
                    current.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, description: event.target.value }
                        : entry
                    )
                  )
                }
                placeholder="Optional description"
              />
            </div>
          ))}
        </div>
        {renderConflictNote("deliverables")}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-black/70 dark:text-white/75">
              Timeline
            </div>
            <div className="text-xs text-black/50 dark:text-white/50">
              Edit milestone dates and labels directly here.
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-black/65 underline underline-offset-4 dark:text-white/65"
            onClick={() =>
              setTimelineItems((current) => [
                ...current,
                {
                  id: createClientRowId("timeline"),
                  label: "",
                  date: "",
                  source: "",
                  status: "unknown"
                }
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <div className={`grid gap-3 ${(conflictMessagesByField.timelineItems ?? []).length > 0 ? "border-l-2 border-clay/45 pl-3" : ""}`}>
          {timelineItems.map((item, index) => (
            <div key={item.id} className="grid gap-3 border border-black/8 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-ink">Timeline item {index + 1}</div>
                <button
                  type="button"
                  className="text-black/45 hover:text-clay dark:text-white/45 dark:hover:text-clay"
                  onClick={() =>
                    setTimelineItems((current) =>
                      current.filter((entry) => entry.id !== item.id)
                    )
                  }
                  aria-label={`Remove timeline item ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className={inputClassName}
                  value={item.label}
                  onChange={(event) =>
                    setTimelineItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, label: event.target.value } : entry
                      )
                    )
                  }
                  placeholder="Milestone label"
                />
                <input
                  className={inputClassName}
                  type="date"
                  value={item.date}
                  onChange={(event) =>
                    setTimelineItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, date: event.target.value } : entry
                      )
                    )
                  }
                />
                <input
                  className={inputClassName}
                  value={item.source}
                  onChange={(event) =>
                    setTimelineItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, source: event.target.value } : entry
                      )
                    )
                  }
                  placeholder="Source"
                />
                <select
                  className={inputClassName}
                  value={item.status}
                  onChange={(event) =>
                    setTimelineItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              status: event.target.value as IntakeTimelineItem["status"]
                            }
                          : entry
                      )
                    )
                  }
                >
                  <option value="unknown">Unknown</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        {renderConflictNote("timelineItems")}
      </div>

      <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
        Analytics highlights
        <textarea
          className={`${textareaClassName} min-h-24`}
          value={analyticsHighlights}
          onChange={(event) => setAnalyticsHighlights(event.target.value)}
          placeholder="One highlight per line"
        />
      </label>
    </div>
  );
}

type ConflictFieldId =
  | "brandCategory"
  | "competitorCategories"
  | "restrictedCategories"
  | "campaignDateWindow"
  | "deliverables"
  | "timelineItems";
