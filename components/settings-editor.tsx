"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { SettingsSection } from "@/components/patterns/settings";
import {
  buildProfileSettingsDraft,
  buildProfileSettingsPatch,
  type ProfileSettingsDraft
} from "@/lib/profile-draft";
import type { ProfileRecord } from "@/lib/types";

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

const ACCENT_PRESETS = [
  { label: "Forest", hex: "#1a4d3e" },
  { label: "Ocean", hex: "#1a5276" },
  { label: "Indigo", hex: "#3730a3" },
  { label: "Violet", hex: "#6d28d9" },
  { label: "Berry", hex: "#9d174d" },
  { label: "Coral", hex: "#c2410c" },
  { label: "Amber", hex: "#b45309" },
  { label: "Slate", hex: "#334155" },
] as const;

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
  initialEmail,
  initialProductUpdatesEnabled
}: {
  initialProfile: ProfileRecord;
  initialEmail: string;
  initialProductUpdatesEnabled: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileSettingsDraft>(() =>
    buildProfileSettingsDraft(
      initialProfile,
      initialEmail,
      initialProductUpdatesEnabled
    )
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function updateFormField<Key extends keyof ProfileSettingsDraft>(
    key: Key,
    value: ProfileSettingsDraft[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

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
          ...buildProfileSettingsPatch(form, initialProfile),
          timeZone: getBrowserTimeZone()
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

      <SettingsSection
        title="Workflow Defaults"
        description="These defaults influence new partnership setup, reminder timing, and generated drafts."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="defaultCurrency">Default currency</FieldLabel>
            <select
              id="defaultCurrency"
              value={form.defaultCurrency}
              onChange={(event) => updateFormField("defaultCurrency", event.currentTarget.value)}
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
              onChange={(event) => updateFormField("reminderLeadDays", event.currentTarget.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="preferredSignature">Default email sign-off</FieldLabel>
            <FlatInput
              id="preferredSignature"
              value={form.preferredSignature}
              placeholder="Best, Sarah"
              onChange={(event) => updateFormField("preferredSignature", event.currentTarget.value)}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Control the alerts HelloBrand surfaces as your partnerships move through review, deliverables, and payment follow-up."
      >
        <div className="border-t border-border">
          <FlatToggleRow
            title="Email notifications"
            description="Send email only when a workspace is ready for review or fails. Test sends use your approved Resend inbox while onboarding@resend.dev is configured."
            checked={form.emailNotificationsEnabled}
            onChange={(checked) => updateFormField("emailNotificationsEnabled", checked)}
          />
          <FlatToggleRow
            title="Product updates"
            description="Receive launch notes, feature announcements, and other non-transactional HelloBrand emails. Turning this off also powers one-click unsubscribe links."
            checked={form.productUpdatesEnabled}
            onChange={(checked) => updateFormField("productUpdatesEnabled", checked)}
          />
          <FlatToggleRow
            title="Payment reminders"
            description="Keep payment follow-up prompts enabled when invoices are due, pending, or overdue."
            checked={form.paymentRemindersEnabled}
            onChange={(checked) => updateFormField("paymentRemindersEnabled", checked)}
          />
          <FlatToggleRow
            title="Conflict alerts"
            description="Flag overlapping dates, exclusivity collisions, and future category conflicts as the partnership graph gets richer."
            checked={form.conflictAlertsEnabled}
            onChange={(checked) => updateFormField("conflictAlertsEnabled", checked)}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Accent Color"
        description="Choose the primary accent color used across the app. This tints buttons, highlights, and key UI surfaces."
      >
        <div className="flex flex-wrap items-center gap-3">
          {ACCENT_PRESETS.map((preset) => {
            const isSelected = form.accentColor.toLowerCase() === preset.hex;
            return (
              <button
                key={preset.hex}
                type="button"
                title={preset.label}
                onClick={() => updateFormField("accentColor", preset.hex)}
                className={`group relative flex h-11 w-11 items-center justify-center border-2 transition-all ${
                  isSelected
                    ? "border-foreground scale-110"
                    : "border-transparent hover:border-border"
                }`}
              >
                <span
                  className="block h-full w-full"
                  style={{ backgroundColor: preset.hex }}
                />
                {isSelected ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-white drop-shadow-sm"
                    >
                      <path
                        d="M3.5 8.5L6.5 11.5L12.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : null}
              </button>
            );
          })}

          <div className="flex items-center gap-2 pl-2">
            <label
              htmlFor="customAccentColor"
              className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Custom
            </label>
            <input
              id="customAccentColor"
              type="color"
              value={form.accentColor || "#1a4d3e"}
              onChange={(event) => updateFormField("accentColor", event.currentTarget.value)}
              className="h-11 w-11 cursor-pointer border border-border bg-transparent p-0.5"
            />
          </div>

          {form.accentColor ? (
            <button
              type="button"
              onClick={() => updateFormField("accentColor", "")}
              className="ml-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Reset to default
            </button>
          ) : null}
        </div>

        {form.accentColor ? (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <span
              className="inline-flex h-9 items-center justify-center px-4 text-sm font-medium text-white"
              style={{ backgroundColor: form.accentColor }}
            >
              Button
            </span>
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: form.accentColor }}
            />
            <span className="text-xs font-mono text-muted-foreground">
              {form.accentColor}
            </span>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Account Reference"
        description="Core account identity comes from your creator profile and sign-in provider. Update social handles and business details in Profile."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="settingsDisplayName">Display name</FieldLabel>
            <FlatInput
              id="settingsDisplayName"
              value={form.displayName}
              onChange={(event) => updateFormField("displayName", event.currentTarget.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="settingsContactEmail">Contact email</FieldLabel>
            <FlatInput
              id="settingsContactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(event) => updateFormField("contactEmail", event.currentTarget.value)}
            />
          </div>
        </div>
      </SettingsSection>

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
