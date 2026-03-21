"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { parseProfileMetadata, serializeProfileMetadata } from "@/lib/profile-metadata";
import type { ProfileRecord } from "@/lib/types";

function FieldLabel({
  htmlFor,
  children
}: {
  htmlFor?: string;
  children: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
    >
      {children}
    </label>
  );
}

function FlatInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full border border-border bg-white px-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary ${props.className ?? ""}`}
    />
  );
}

function FlatToggleRow({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-5">
      <div className="max-w-2xl">
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 border border-border transition-colors ${
          checked ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5.5 w-5.5 bg-white transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsEditor({
  initialProfile,
  initialEmail
}: {
  initialProfile: ProfileRecord;
  initialEmail: string;
}) {
  const router = useRouter();
  const { metadata } = parseProfileMetadata(initialProfile.payoutDetails);
  const [form, setForm] = useState({
    displayName: initialProfile.displayName ?? "",
    creatorLegalName: initialProfile.creatorLegalName ?? "",
    businessName: initialProfile.businessName ?? "",
    contactEmail: initialProfile.contactEmail ?? initialEmail,
    preferredSignature: initialProfile.preferredSignature ?? "",
    defaultCurrency: initialProfile.defaultCurrency ?? "USD",
    reminderLeadDays: String(initialProfile.reminderLeadDays ?? 3),
    conflictAlertsEnabled: initialProfile.conflictAlertsEnabled,
    paymentRemindersEnabled: initialProfile.paymentRemindersEnabled
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
          payoutDetails: serializeProfileMetadata(metadata),
          defaultCurrency: form.defaultCurrency.trim() || "USD",
          reminderLeadDays:
            form.reminderLeadDays.trim().length > 0
              ? Number(form.reminderLeadDays)
              : 3,
          conflictAlertsEnabled: form.conflictAlertsEnabled,
          paymentRemindersEnabled: form.paymentRemindersEnabled
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save settings.");
      }

      setSuccessMessage(payload.message ?? "Settings saved.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      <div className="border-b border-border pb-8">
        <h1 className="text-[2.5rem] font-bold tracking-[-0.05em] text-foreground">
          Settings
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
          Set your default workflow behavior for reminders, drafting, and contract
          review preferences.
        </p>
      </div>

      {successMessage ? (
        <div className="border-b border-border py-4 text-sm text-primary">
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="border-b border-border py-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="border-b border-border py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
            Workflow Defaults
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            These defaults influence new partnership setup, reminder timing, and generated
            drafts.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="defaultCurrency">Default currency</FieldLabel>
            <select
              id="defaultCurrency"
              value={form.defaultCurrency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultCurrency: event.currentTarget.value
                }))
              }
              className="h-12 w-full border border-border bg-white px-4 text-[15px] text-foreground outline-none transition-colors focus:border-primary"
            >
              {["USD", "CAD", "EUR", "GBP", "AUD", "NZD"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="reminderLeadDays">Reminder lead days</FieldLabel>
            <FlatInput
              id="reminderLeadDays"
              type="number"
              min={0}
              max={30}
              value={form.reminderLeadDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reminderLeadDays: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="preferredSignature">Default email sign-off</FieldLabel>
            <FlatInput
              id="preferredSignature"
              value={form.preferredSignature}
              placeholder="Best, Sarah"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferredSignature: event.currentTarget.value
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
            Notifications
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Control the alerts HelloBrand surfaces as your partnerships move through review,
            deliverables, and payment follow-up.
          </p>
        </div>

        <div className="border-t border-border">
          <FlatToggleRow
            title="Payment reminders"
            description="Keep payment follow-up prompts enabled when invoices are due, pending, or overdue."
            checked={form.paymentRemindersEnabled}
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                paymentRemindersEnabled: checked
              }))
            }
          />
          <FlatToggleRow
            title="Conflict alerts"
            description="Flag overlapping dates, exclusivity collisions, and future category conflicts as the partnership graph gets richer."
            checked={form.conflictAlertsEnabled}
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                conflictAlertsEnabled: checked
              }))
            }
          />
        </div>
      </section>

      <section className="border-b border-border py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
            Account Reference
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Core account identity comes from your creator profile and sign-in
            provider. Update social handles and business details in Profile.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="settingsDisplayName">Display name</FieldLabel>
            <FlatInput
              id="settingsDisplayName"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayName: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="settingsContactEmail">Contact email</FieldLabel>
            <FlatInput
              id="settingsContactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contactEmail: event.currentTarget.value
                }))
              }
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-4 py-8">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-12 items-center justify-center bg-primary px-6 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving settings..." : "Save changes"}
        </button>
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center border border-border bg-white px-6 text-sm font-medium text-foreground"
          onClick={() => router.refresh()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
