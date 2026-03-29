"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { createClientRowId } from "@/lib/row-identity";
import type { DeliverableItem } from "@/lib/types";

const ADD_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-sm font-medium text-black/65 underline underline-offset-4 transition hover:text-black/80 dark:text-white/65 dark:hover:text-white/80";

type EditableDeliverable = {
  id: string;
  title: string;
  dueDate: string;
  channel: string;
  quantity: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
};

type EditableLineItem = {
  id: string;
  value: string;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function sanitizeText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|table)>/gi, "\n")
    .replace(/<(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitStructuredValues(value: string | null | undefined) {
  const cleaned = sanitizeText(value);
  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(/\n|;|,(?=\s*[A-Za-z#])/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toDateValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function normalizeDeliverables(items: DeliverableItem[]) {
  return items.map((item, index) => ({
    id: item.id || `deliverable-${index + 1}`,
    title: sanitizeText(item.title),
    dueDate: toDateValue(item.dueDate),
    channel: sanitizeText(item.channel),
    quantity:
      item.quantity === null || item.quantity === undefined
        ? ""
        : String(item.quantity),
    description: sanitizeText(item.description),
    status: item.status ?? "pending"
  }));
}

function normalizeLines(values: string[], fallback?: string | null) {
  const sourceValues =
    values.length > 0 ? values : splitStructuredValues(fallback);

  return sourceValues.map((value, index) => ({
    id: `line-${index + 1}`,
    value: sanitizeText(value)
  }));
}

function ListSection({
  title,
  description,
  items,
  inputClassName,
  emptyLabel,
  addLabel,
  placeholder,
  onAdd,
  onChange,
  onRemove
}: {
  title: string;
  description: string;
  items: EditableLineItem[];
  inputClassName: string;
  emptyLabel: string;
  addLabel: string;
  placeholder: string;
  onAdd: () => void;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          className={ADD_BUTTON_CLASS}
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      </div>

      <div className="grid gap-3">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border border-black/8 p-3 dark:border-white/10"
            >
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                {index + 1}
              </span>
              <input
                className={inputClassName}
                value={item.value}
                onChange={(event) => onChange(item.id, event.target.value)}
                placeholder={placeholder}
              />
              <button
                type="button"
                className="text-black/45 hover:text-clay dark:text-white/45 dark:hover:text-clay"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${title.toLowerCase()} item ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="border border-black/8 px-4 py-3 text-sm text-muted-foreground dark:border-white/10">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export function EditableStringListField({
  title,
  description,
  jsonName,
  textName,
  initialValues,
  fallbackText,
  inputClassName,
  emptyLabel,
  addLabel,
  placeholder
}: {
  title: string;
  description: string;
  jsonName: string;
  textName?: string;
  initialValues: string[];
  fallbackText?: string | null;
  inputClassName: string;
  emptyLabel: string;
  addLabel: string;
  placeholder: string;
}) {
  const [items, setItems] = useState<EditableLineItem[]>(
    normalizeLines(initialValues, fallbackText)
  );

  const values = useMemo(
    () => items.map((item) => item.value.trim()).filter(Boolean),
    [items]
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name={jsonName} value={JSON.stringify(values)} />
      {textName ? <input type="hidden" name={textName} value={values.join("\n")} /> : null}
      <ListSection
        title={title}
        description={description}
        items={items}
        inputClassName={inputClassName}
        emptyLabel={emptyLabel}
        addLabel={addLabel}
        placeholder={placeholder}
        onAdd={() =>
          setItems((current) => [
            ...current,
            { id: createClientRowId("line"), value: "" }
          ])
        }
        onChange={(id, value) =>
          setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, value } : item))
          )
        }
        onRemove={(id) =>
          setItems((current) => current.filter((item) => item.id !== id))
        }
      />
    </div>
  );
}

export function TermsArrayFieldsEditor({
  deliverables,
  usageChannels,
  inputClassName,
  textareaClassName
}: {
  deliverables: DeliverableItem[];
  usageChannels: string[];
  inputClassName: string;
  textareaClassName: string;
}) {
  const [editableDeliverables, setEditableDeliverables] = useState<EditableDeliverable[]>(
    normalizeDeliverables(deliverables)
  );

  const deliverablesJson = useMemo(
    () =>
      JSON.stringify(
        editableDeliverables
          .map((item) => ({
            id: item.id,
            title: item.title.trim(),
            dueDate: item.dueDate.trim() || null,
            channel: item.channel.trim() || null,
            quantity: item.quantity.trim() ? Number(item.quantity) : null,
            status: item.status,
            description: item.description.trim() || null,
            source: null
          }))
          .filter((item) => item.title.length > 0)
      ),
    [editableDeliverables]
  );

  return (
    <div className="space-y-8">
      <input type="hidden" name="deliverablesJson" value={deliverablesJson} />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Deliverables</h4>
            <p className="text-sm text-muted-foreground">
              Add each deliverable as its own row.
            </p>
          </div>
          <button
            type="button"
            className={ADD_BUTTON_CLASS}
            onClick={() =>
              setEditableDeliverables((current) => [
                ...current,
                {
                  id: createClientRowId("deliverable"),
                  title: "",
                  dueDate: "",
                  channel: "",
                  quantity: "",
                  description: "",
                  status: "pending"
                }
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        <div className="grid gap-3">
          {editableDeliverables.length > 0 ? (
            editableDeliverables.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-3 border border-black/8 p-4 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">
                    Deliverable {index + 1}
                  </div>
                  <button
                    type="button"
                    className="text-black/45 hover:text-clay dark:text-white/45 dark:hover:text-clay"
                    onClick={() =>
                      setEditableDeliverables((current) =>
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
                      setEditableDeliverables((current) =>
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
                      setEditableDeliverables((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, channel: event.target.value }
                            : entry
                        )
                      )
                    }
                    placeholder="Channel"
                  />
                  <input
                    className={inputClassName}
                    type="date"
                    value={item.dueDate}
                    onChange={(event) =>
                      setEditableDeliverables((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, dueDate: event.target.value }
                            : entry
                        )
                      )
                    }
                  />
                  <input
                    className={inputClassName}
                    type="number"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      setEditableDeliverables((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, quantity: event.target.value }
                            : entry
                        )
                      )
                    }
                    placeholder="Quantity"
                  />
                </div>
                <textarea
                  className={`${textareaClassName} min-h-20`}
                  value={item.description}
                  onChange={(event) =>
                    setEditableDeliverables((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, description: event.target.value }
                          : entry
                      )
                    )
                  }
                  placeholder="Description"
                />
              </div>
            ))
          ) : (
            <div className="border border-black/8 px-4 py-3 text-sm text-muted-foreground dark:border-white/10">
              No deliverables added yet.
            </div>
          )}
        </div>
      </div>

      <EditableStringListField
        title="Usage channels"
        description="Add each approved usage channel as its own item."
        jsonName="usageChannelsJson"
        initialValues={usageChannels}
        inputClassName={inputClassName}
        emptyLabel="No usage channels added yet."
        addLabel="Add"
        placeholder="TikTok paid usage"
      />
    </div>
  );
}
