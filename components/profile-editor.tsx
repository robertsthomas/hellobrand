"use client";

import type {
  FormEvent,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Plus, Trash2, Upload } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  PROFILE_CATEGORY_OPTIONS,
  PROFILE_PLATFORM_OPTIONS,
  type ProfilePlatform,
  type SocialHandleEntry
} from "@/lib/profile-metadata";
import {
  buildProfileEditorDraft,
  buildProfileEditorPatch,
  emptyDealHandle,
  type ProfileEditorDraft
} from "@/lib/profile-draft";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import type { ProfileAuditRecord, ProfileRecord } from "@/lib/types";

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

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

function deriveInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "HB";
}

function iconForPlatform(platform: ProfilePlatform) {
  return <SocialPlatformIcon platform={platform} />;
}

function SectionHeader({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 md:mb-7">
      <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

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

function FlatTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full border border-border bg-white px-4 py-3 text-[15px] leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary ${props.className ?? ""}`}
    />
  );
}

function FlatSelect(
  props: SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }
) {
  const { options, className, ...rest } = props;

  return (
    <select
      {...rest}
      className={`h-12 w-full border border-border bg-white px-4 text-[15px] text-foreground outline-none transition-colors focus:border-primary ${className ?? ""}`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
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
  const [form, setForm] = useState<ProfileEditorDraft>(() =>
    buildProfileEditorDraft(initialProfile, initialEmail)
  );
  const [audit, setAudit] = useState(initialAudit);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const initials = useMemo(
    () =>
      deriveInitials(
        form.creatorLegalName.trim() ||
          form.displayName.trim() ||
          form.businessName.trim() ||
          "HelloBrand"
      ),
    [form.businessName, form.creatorLegalName, form.displayName]
  );

  const isConfigured = useMemo(
    () =>
      Boolean(
        form.creatorLegalName.trim() ||
          form.displayName.trim() ||
          form.businessName.trim() ||
          form.generalHandles.some((entry) => entry.handle.trim())
      ),
    [
      form.businessName,
      form.creatorLegalName,
      form.displayName,
      form.generalHandles
    ]
  );

  function updateGeneralHandle(
    id: string,
    field: "handle" | "audienceLabel",
    value: string
  ) {
    setForm((current) => ({
      ...current,
      generalHandles: current.generalHandles.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    }));
  }

  function updateDealHandle(
    id: string,
    field: "partnershipContext" | "platform" | "handle" | "audienceLabel",
    value: string
  ) {
    setForm((current) => ({
      ...current,
      dealHandles: current.dealHandles.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
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
          ...buildProfileEditorPatch(form, initialProfile),
          timeZone: getBrowserTimeZone()
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save profile.");
      }

      setSuccessMessage(payload.message ?? "Profile saved.");
      setAudit(
        Array.isArray(payload.recentChanges) ? payload.recentChanges : initialAudit
      );
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
    <form onSubmit={handleSubmit} className="space-y-0">
      <div className="flex flex-col gap-4 border-b border-border pb-8 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[2.5rem] font-bold tracking-[-0.05em] text-foreground">
            Profile
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
            Manage your public creator identity, social handles, and business
            defaults used across intake, drafting, and workspace setup.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <History className="h-4 w-4" />
              Recent changes
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl border border-border bg-white p-0">
            <DialogHeader className="border-b border-border px-6 py-5 text-left">
              <DialogTitle className="text-xl font-bold tracking-[-0.03em] text-foreground">
                Recent profile changes
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Review saved creator profile changes without cluttering the main
                editor.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No profile edits recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-border border-t border-border">
                  {audit.map((event) => (
                    <div key={event.id} className="py-4">
                      <p className="text-sm font-medium text-foreground">
                        {event.changedFields.map(humanizeField).join(", ")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {presentDateTime(event.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
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
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-24 w-24 items-center justify-center bg-primary text-2xl font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 bg-primary px-5 text-sm font-medium text-primary-foreground opacity-80"
            >
              <Upload className="h-4 w-4" />
              Upload photo
            </button>
            <p className="text-sm text-muted-foreground">
              Photo upload is coming soon. Initials are used in the workspace for now.
            </p>
            <p className="text-sm text-muted-foreground">
              {isConfigured
                ? "Your profile defaults are ready to backfill new partnerships."
                : "Set up your creator details so HelloBrand can draft cleaner defaults."}
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader
          title="Basic Information"
          description="These details identify you across creator-facing workflows and review screens."
        />

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="displayName">Public display name</FieldLabel>
            <FlatInput
              id="displayName"
              value={form.displayName}
              placeholder="Sarah Miller"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  displayName: value
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="creatorLegalName">Creator name</FieldLabel>
            <FlatInput
              id="creatorLegalName"
              value={form.creatorLegalName}
              placeholder="Sarah Miller"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  creatorLegalName: value
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="businessName">Business name or primary handle</FieldLabel>
            <FlatInput
              id="businessName"
              value={form.businessName}
              placeholder="@sarahmiller"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  businessName: value
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
            <FlatInput
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              placeholder={initialEmail}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  contactEmail: value
                }));
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="bio">Bio</FieldLabel>
            <FlatTextarea
              id="bio"
              value={form.bio}
              placeholder="What kind of creator are you, what do you cover, and what should brands understand quickly?"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  bio: value
                }));
              }}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader
          title="Social Media Channels"
          description="Keep your core channels here so intake and partnership setup can reference the right public handles."
        />

        <div className="space-y-0">
          {form.generalHandles.map((entry) => (
            <div
              key={entry.id}
              className="grid items-end gap-4 border-b border-border py-5 md:grid-cols-[44px_1fr_140px]"
            >
              <div className="flex h-12 w-11 items-center justify-center border border-border bg-secondary">
                {iconForPlatform(entry.platform)}
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-handle`}>
                  {entry.platform === "twitter" ? "Twitter / X" : entry.platform}
                </FieldLabel>
                <FlatInput
                  id={`${entry.id}-handle`}
                  value={entry.handle}
                  placeholder="@handle"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateGeneralHandle(entry.id, "handle", value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-audience`}>Audience</FieldLabel>
                <FlatInput
                  id={`${entry.id}-audience`}
                  value={entry.audienceLabel ?? ""}
                  placeholder="245K"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateGeneralHandle(entry.id, "audienceLabel", value);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader
          title="Partnership-Specific Handles"
          description="Use this for alternate handles or platform-specific identities you only use for certain brands, campaigns, or partnership types."
        />

        <div className="space-y-4">
          {form.dealHandles.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-3 border-b border-border pb-4 md:grid-cols-[minmax(0,1.3fr)_180px_minmax(0,1fr)_120px_44px]"
            >
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-context`}>Use for</FieldLabel>
                <FlatInput
                  id={`${entry.id}-context`}
                  value={entry.partnershipContext ?? ""}
                  placeholder="Beauty brand partnerships, paid TikTok campaigns, parenthood content"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateDealHandle(entry.id, "partnershipContext", value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-platform`}>Platform</FieldLabel>
                <FlatSelect
                  id={`${entry.id}-platform`}
                  value={entry.platform}
                  options={[...PROFILE_PLATFORM_OPTIONS]}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateDealHandle(entry.id, "platform", value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-handle`}>Handle</FieldLabel>
                <FlatInput
                  id={`${entry.id}-handle`}
                  value={entry.handle}
                  placeholder="@handle"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateDealHandle(entry.id, "handle", value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-audience`}>Audience</FieldLabel>
                <FlatInput
                  id={`${entry.id}-audience`}
                  value={entry.audienceLabel ?? ""}
                  placeholder="1.2M"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateDealHandle(entry.id, "audienceLabel", value);
                  }}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center border border-border bg-white text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Remove partnership-specific handle"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      dealHandles:
                        current.dealHandles.length > 1
                          ? current.dealHandles.filter((item) => item.id !== entry.id)
                          : [emptyDealHandle()]
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            onClick={() =>
              setForm((current) => ({
                ...current,
                dealHandles: [...current.dealHandles, emptyDealHandle()]
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Add partnership-specific handle
          </button>
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader title="Creator Details" />

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="primaryPlatform">Primary platform</FieldLabel>
            <FlatSelect
              id="primaryPlatform"
              value={form.primaryPlatform}
              options={[...PROFILE_PLATFORM_OPTIONS]}
              onChange={(event) => {
                const value = event.currentTarget.value as ProfilePlatform;
                setForm((current) => ({
                  ...current,
                  primaryPlatform: value
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="contentCategory">Content category</FieldLabel>
            <FlatSelect
              id="contentCategory"
              value={form.contentCategory}
              options={[...PROFILE_CATEGORY_OPTIONS]}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  contentCategory: value
                }));
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="location">Location</FieldLabel>
            <FlatInput
              id="location"
              value={form.location}
              placeholder="Los Angeles, CA"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  location: value
                }));
              }}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader
          title="Business and invoice details"
          description="These details prefill your invoices and help HelloBrand draft outreach and reminders."
        />

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="businessNameInline">Business name</FieldLabel>
            <FlatInput
              id="businessNameInline"
              value={form.businessName}
              placeholder="Sarah Miller Media LLC"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  businessName: value
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="taxId">Tax ID / EIN</FieldLabel>
            <FlatInput
              id="taxId"
              value={form.taxId}
              placeholder="XX-XXXXXXX"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  taxId: value
                }));
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="address">Business address</FieldLabel>
            <FlatTextarea
              id="address"
              value={form.address}
              placeholder="123 Main St, Suite 100&#10;Los Angeles, CA 90001"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  address: value
                }));
              }}
            />
            <p className="text-xs text-muted-foreground">Used as the issuer address on invoices.</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="rateCardUrl">Rate card link</FieldLabel>
            <FlatInput
              id="rateCardUrl"
              value={form.rateCardUrl}
              placeholder="https://yourdomain.com/rates"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  rateCardUrl: value
                }));
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="preferredSignature">Default sign-off</FieldLabel>
            <FlatInput
              id="preferredSignature"
              value={form.preferredSignature}
              placeholder="Best, Sarah"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  preferredSignature: value
                }));
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="payoutNotes">Invoice and payout notes</FieldLabel>
            <FlatTextarea
              id="payoutNotes"
              value={form.payoutNotes}
              placeholder="Share invoice instructions, preferred payout platform, or finance details you want to reuse."
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  payoutNotes: value
                }));
              }}
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
          {isSaving ? "Saving changes..." : "Save changes"}
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
