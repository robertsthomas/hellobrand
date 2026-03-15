"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { ProfileAuditRecord, ProfileRecord } from "@/lib/types";

const CURRENCY_OPTIONS = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD"];

function presentDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function humanizeField(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export function ProfileEditor({
  initialProfile,
  initialEmail,
  initialAudit
}: {
  initialProfile: ProfileRecord;
  initialEmail: string;
  initialAudit: ProfileAuditRecord[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: initialProfile.displayName ?? "",
    creatorLegalName: initialProfile.creatorLegalName ?? "",
    businessName: initialProfile.businessName ?? "",
    contactEmail: initialProfile.contactEmail ?? initialEmail,
    preferredSignature: initialProfile.preferredSignature ?? "",
    payoutDetails: initialProfile.payoutDetails ?? "",
    defaultCurrency: initialProfile.defaultCurrency ?? "USD",
    reminderLeadDays: String(initialProfile.reminderLeadDays ?? 3),
    conflictAlertsEnabled: initialProfile.conflictAlertsEnabled,
    paymentRemindersEnabled: initialProfile.paymentRemindersEnabled
  });
  const [audit, setAudit] = useState(initialAudit);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConfigured = useMemo(
    () =>
      Boolean(
        form.creatorLegalName.trim() ||
          form.businessName.trim() ||
          form.preferredSignature.trim()
      ),
    [form.businessName, form.creatorLegalName, form.preferredSignature]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          displayName: form.displayName.trim() || null,
          creatorLegalName: form.creatorLegalName.trim() || null,
          businessName: form.businessName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          preferredSignature: form.preferredSignature.trim() || null,
          payoutDetails: form.payoutDetails.trim() || null,
          defaultCurrency: form.defaultCurrency.trim() || null,
          reminderLeadDays:
            form.reminderLeadDays.trim().length > 0
              ? Number(form.reminderLeadDays)
              : null,
          conflictAlertsEnabled: form.conflictAlertsEnabled,
          paymentRemindersEnabled: form.paymentRemindersEnabled
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save profile.");
      }

      setSuccessMessage(payload.message ?? "Profile saved.");
      setAudit(Array.isArray(payload.recentChanges) ? payload.recentChanges : audit);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save profile."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form
        onSubmit={handleSubmit}
        className="grid gap-6 rounded-[2rem] border border-black/5 bg-white/85 p-8 shadow-panel dark:border-white/10 dark:bg-white/[0.06]"
      >
        <section className="space-y-2 border-b border-black/8 pb-6 dark:border-white/10">
          <h2 className="text-2xl font-semibold text-ink">Creator profile</h2>
          <p className="text-sm text-black/60 dark:text-white/65">
            These details feed intake defaults, workspace context, and AI-generated
            drafts.
          </p>
        </section>

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-2xl border border-clay/20 bg-clay/8 px-4 py-3 text-sm text-clay">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Display name
            <input
              className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              value={form.displayName}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, displayName: value }));
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Contact email
            <input
              className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              type="email"
              value={form.contactEmail}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, contactEmail: value }));
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Creator / legal name
            <input
              className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              value={form.creatorLegalName}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  creatorLegalName: value
                }));
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Business name / handle
            <input
              className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              value={form.businessName}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, businessName: value }));
              }}
            />
          </label>
        </section>

        <section className="grid gap-4 border-t border-black/8 pt-6 dark:border-white/10">
          <h3 className="text-lg font-semibold text-ink">Communication defaults</h3>
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Preferred email signature
            <input
              className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              value={form.preferredSignature}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  preferredSignature: value
                }));
              }}
              placeholder="Best, Sarah"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Payout details
            <textarea
              className="min-h-32 rounded-[1.5rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
              value={form.payoutDetails}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, payoutDetails: value }));
              }}
              placeholder="Invoice instructions, payment platform, or finance contact notes."
            />
          </label>
        </section>

        <section className="grid gap-4 border-t border-black/8 pt-6 dark:border-white/10">
          <h3 className="text-lg font-semibold text-ink">Preferences</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Default currency
              <Select
                value={form.defaultCurrency}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    defaultCurrency: value
                  }))
                }
              >
                <SelectTrigger className="h-auto rounded-[1.25rem] border-black/10 bg-sand/50 px-4 py-4 text-sm dark:border-white/12 dark:bg-white/[0.05]">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Reminder lead time (days)
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
                type="number"
                min={0}
                max={30}
                value={form.reminderLeadDays}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({
                    ...current,
                    reminderLeadDays: value
                  }));
                }}
              />
            </label>
          </div>
          <div className="grid gap-3">
            <label className="flex items-start gap-3 rounded-[1.25rem] border border-black/6 bg-sand/35 px-4 py-4 text-sm dark:border-white/10 dark:bg-white/[0.04]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-black/15 text-ocean focus:ring-ocean/20"
                checked={form.conflictAlertsEnabled}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setForm((current) => ({
                    ...current,
                    conflictAlertsEnabled: checked
                  }));
                }}
              />
              <span>
                <span className="block font-medium text-ink">Conflict alerts</span>
                <span className="mt-1 block text-black/55 dark:text-white/60">
                  Flag overlapping dates, brand-category conflicts, and exclusivity
                  collisions as this becomes available.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-[1.25rem] border border-black/6 bg-sand/35 px-4 py-4 text-sm dark:border-white/10 dark:bg-white/[0.04]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-black/15 text-ocean focus:ring-ocean/20"
                checked={form.paymentRemindersEnabled}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setForm((current) => ({
                    ...current,
                    paymentRemindersEnabled: checked
                  }));
                }}
              />
              <span>
                <span className="block font-medium text-ink">Payment reminders</span>
                <span className="mt-1 block text-black/55 dark:text-white/60">
                  Keep payment follow-up prompts enabled for late or overdue deals.
                </span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex justify-end border-t border-black/8 pt-6 dark:border-white/10">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving profile..." : "Save profile"}
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <h2 className="text-lg font-semibold text-ink">Profile status</h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/65">
            {isConfigured
              ? "Your creator defaults are set and available to intake and drafting flows."
              : "Your profile is still minimal. Fill in the creator fields so intake and email drafting have better defaults."}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <h2 className="text-lg font-semibold text-ink">Profile history</h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/65">
            Review the latest saved profile changes without cluttering the main
            settings page.
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-black/20 dark:border-white/12 dark:text-white"
              >
                <History className="h-4 w-4" />
                Recent changes
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-[28px] border-black/10 bg-background p-0 dark:border-white/10">
              <DialogHeader className="border-b border-black/8 px-6 py-5 text-left dark:border-white/10">
                <DialogTitle className="text-xl font-semibold text-ink">
                  Recent profile changes
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-black/60 dark:text-white/65">
                  Saved creator profile updates are listed here in reverse chronological
                  order.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-5">
                {audit.length === 0 ? (
                  <p className="text-sm text-black/60 dark:text-white/65">
                    No profile edits recorded yet.
                  </p>
                ) : (
                  audit.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-[1.25rem] bg-sand/45 px-4 py-4 text-sm dark:bg-white/[0.04]"
                    >
                      <div className="font-medium text-ink">
                        {event.changedFields.map(humanizeField).join(", ")}
                      </div>
                      <div className="mt-1 text-black/55 dark:text-white/60">
                        {presentDateTime(event.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </aside>
    </div>
  );
}
