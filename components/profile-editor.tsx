"use client";

import type {
  FormEvent,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  History,
  Instagram,
  Plus,
  Trash2,
  Twitter,
  Upload,
  Youtube
} from "lucide-react";

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
  parseProfileMetadata,
  serializeProfileMetadata,
  splitSocialHandles,
  type ProfilePlatform,
  type SocialHandleEntry
} from "@/lib/profile-metadata";
import type { ProfileAuditRecord, ProfileRecord } from "@/lib/types";

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

function createHandleId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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
  switch (platform) {
    case "instagram":
      return <Instagram className="h-4 w-4" />;
    case "youtube":
      return <Youtube className="h-4 w-4" />;
    case "twitter":
      return <Twitter className="h-4 w-4" />;
    case "tiktok":
      return <span className="text-sm font-semibold">TT</span>;
    case "threads":
      return <span className="text-sm font-semibold">@</span>;
    case "newsletter":
      return <span className="text-[11px] font-semibold uppercase">NL</span>;
    case "podcast":
      return <span className="text-[11px] font-semibold uppercase">PC</span>;
    default:
      return <span className="text-[11px] font-semibold uppercase">ID</span>;
  }
}

function buildGeneralHandles(initialHandles: SocialHandleEntry[]) {
  const platforms: ProfilePlatform[] = [
    "instagram",
    "youtube",
    "tiktok",
    "twitter"
  ];

  return platforms.map((platform) => {
    const existing = initialHandles.find(
      (entry) => entry.platform === platform && !entry.dealContext
    );

    return (
      existing ?? {
        id: createHandleId(platform),
        platform,
        handle: "",
        audienceLabel: "",
        dealContext: null
      }
    );
  });
}

function emptyDealHandle(): SocialHandleEntry {
  return {
    id: createHandleId("deal"),
    platform: "instagram",
    handle: "",
    audienceLabel: "",
    dealContext: ""
  };
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
  const { metadata } = parseProfileMetadata(initialProfile.payoutDetails);
  const splitHandles = splitSocialHandles(metadata.socialHandles);

  const [form, setForm] = useState({
    displayName: initialProfile.displayName ?? "",
    creatorLegalName: initialProfile.creatorLegalName ?? "",
    businessName: initialProfile.businessName ?? "",
    contactEmail: initialProfile.contactEmail ?? initialEmail,
    preferredSignature: initialProfile.preferredSignature ?? "",
    bio: metadata.bio ?? "",
    location: metadata.location ?? "",
    primaryPlatform: metadata.primaryPlatform ?? "instagram",
    contentCategory: metadata.contentCategory ?? PROFILE_CATEGORY_OPTIONS[0],
    taxId: metadata.taxId ?? "",
    rateCardUrl: metadata.rateCardUrl ?? "",
    payoutNotes: metadata.payoutNotes ?? "",
    generalHandles: buildGeneralHandles(splitHandles.generalHandles),
    dealHandles:
      splitHandles.dealSpecificHandles.length > 0
        ? splitHandles.dealSpecificHandles.map((entry) => ({
            ...entry,
            audienceLabel: entry.audienceLabel ?? "",
            dealContext: entry.dealContext ?? ""
          }))
        : [emptyDealHandle()]
  });
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
    field: "dealContext" | "platform" | "handle" | "audienceLabel",
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
      const socialHandles = [
        ...form.generalHandles.map((entry) => ({
          ...entry,
          audienceLabel: entry.audienceLabel.trim() || null
        })),
        ...form.dealHandles.map((entry) => ({
          ...entry,
          audienceLabel: entry.audienceLabel.trim() || null,
          dealContext: entry.dealContext.trim() || null
        }))
      ];

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
          payoutDetails: serializeProfileMetadata({
            bio: form.bio.trim() || null,
            location: form.location.trim() || null,
            primaryPlatform:
              (form.primaryPlatform as ProfilePlatform | "").trim() || null,
            contentCategory: form.contentCategory.trim() || null,
            taxId: form.taxId.trim() || null,
            rateCardUrl: form.rateCardUrl.trim() || null,
            payoutNotes: form.payoutNotes.trim() || null,
            socialHandles
          }),
          defaultCurrency: initialProfile.defaultCurrency ?? "USD",
          reminderLeadDays: initialProfile.reminderLeadDays ?? 3,
          conflictAlertsEnabled: initialProfile.conflictAlertsEnabled,
          paymentRemindersEnabled: initialProfile.paymentRemindersEnabled
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
                ? "Your profile defaults are ready to backfill new deals."
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
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayName: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="creatorLegalName">Creator name</FieldLabel>
            <FlatInput
              id="creatorLegalName"
              value={form.creatorLegalName}
              placeholder="Sarah Miller"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  creatorLegalName: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="businessName">Business name or primary handle</FieldLabel>
            <FlatInput
              id="businessName"
              value={form.businessName}
              placeholder="@sarahmiller"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  businessName: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
            <FlatInput
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              placeholder={initialEmail}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contactEmail: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="bio">Bio</FieldLabel>
            <FlatTextarea
              id="bio"
              value={form.bio}
              placeholder="What kind of creator are you, what do you cover, and what should brands understand quickly?"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bio: event.currentTarget.value
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader
          title="Social Media Channels"
          description="Keep your core channels here so intake and deal setup can reference the right public handles."
        />

        <div className="space-y-4">
          {form.generalHandles.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-3 border-b border-border pb-4 md:grid-cols-[40px_minmax(0,1fr)_160px]"
            >
              <div className="flex h-10 w-10 items-center justify-center border border-border bg-secondary">
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
                  onChange={(event) =>
                    updateGeneralHandle(entry.id, "handle", event.currentTarget.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-audience`}>Audience</FieldLabel>
                <FlatInput
                  id={`${entry.id}-audience`}
                  value={entry.audienceLabel ?? ""}
                  placeholder="245K"
                  onChange={(event) =>
                    updateGeneralHandle(
                      entry.id,
                      "audienceLabel",
                      event.currentTarget.value
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader
          title="Deal-Specific Handles"
          description="Use this for alternate handles or platform-specific identities you only use for certain brands, campaigns, or deal types."
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
                  value={entry.dealContext ?? ""}
                  placeholder="Beauty brand deals, paid TikTok campaigns, parenthood content"
                  onChange={(event) =>
                    updateDealHandle(
                      entry.id,
                      "dealContext",
                      event.currentTarget.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-platform`}>Platform</FieldLabel>
                <FlatSelect
                  id={`${entry.id}-platform`}
                  value={entry.platform}
                  options={[...PROFILE_PLATFORM_OPTIONS]}
                  onChange={(event) =>
                    updateDealHandle(
                      entry.id,
                      "platform",
                      event.currentTarget.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-handle`}>Handle</FieldLabel>
                <FlatInput
                  id={`${entry.id}-handle`}
                  value={entry.handle}
                  placeholder="@handle"
                  onChange={(event) =>
                    updateDealHandle(entry.id, "handle", event.currentTarget.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${entry.id}-audience`}>Audience</FieldLabel>
                <FlatInput
                  id={`${entry.id}-audience`}
                  value={entry.audienceLabel ?? ""}
                  placeholder="1.2M"
                  onChange={(event) =>
                    updateDealHandle(
                      entry.id,
                      "audienceLabel",
                      event.currentTarget.value
                    )
                  }
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center border border-border bg-white text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Remove deal-specific handle"
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
            Add deal-specific handle
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
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  primaryPlatform: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="contentCategory">Content category</FieldLabel>
            <FlatSelect
              id="contentCategory"
              value={form.contentCategory}
              options={[...PROFILE_CATEGORY_OPTIONS]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contentCategory: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="location">Location</FieldLabel>
            <FlatInput
              id="location"
              value={form.location}
              placeholder="Los Angeles, CA"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  location: event.currentTarget.value
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border py-10">
        <SectionHeader
          title="Business Information"
          description="These details help when HelloBrand drafts outreach, reminders, and invoice-adjacent copy."
        />

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="businessNameInline">Business name</FieldLabel>
            <FlatInput
              id="businessNameInline"
              value={form.businessName}
              placeholder="Sarah Miller Media LLC"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  businessName: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="taxId">Tax ID / EIN</FieldLabel>
            <FlatInput
              id="taxId"
              value={form.taxId}
              placeholder="XX-XXXXXXX"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  taxId: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="rateCardUrl">Rate card link</FieldLabel>
            <FlatInput
              id="rateCardUrl"
              value={form.rateCardUrl}
              placeholder="https://yourdomain.com/rates"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  rateCardUrl: event.currentTarget.value
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="preferredSignature">Default sign-off</FieldLabel>
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
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="payoutNotes">Invoice and payout notes</FieldLabel>
            <FlatTextarea
              id="payoutNotes"
              value={form.payoutNotes}
              placeholder="Share invoice instructions, preferred payout platform, or finance details you want to reuse."
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payoutNotes: event.currentTarget.value
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
