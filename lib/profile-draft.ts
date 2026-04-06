import { createClientRowId } from "@/lib/row-identity";
import type { ProfileRecord } from "@/lib/types";
import {
  PROFILE_CATEGORY_OPTIONS,
  parseProfileMetadata,
  serializeProfileMetadata,
  splitSocialHandles,
  type ProfilePlatform,
  type SocialHandleEntry
} from "@/lib/profile-metadata";

type ProfileIdentityDraft = {
  displayName: string;
  creatorLegalName: string;
  businessName: string;
  contactEmail: string;
  preferredSignature: string;
};

export type ProfileSettingsDraft = ProfileIdentityDraft & {
  defaultCurrency: string;
  reminderLeadDays: string;
  conflictAlertsEnabled: boolean;
  paymentRemindersEnabled: boolean;
  emailNotificationsEnabled: boolean;
  productUpdatesEnabled: boolean;
  accentColor: string;
};

export type ProfileEditorDraft = ProfileIdentityDraft & {
  bio: string;
  location: string;
  primaryPlatform: ProfilePlatform;
  contentCategory: string;
  taxId: string;
  address: string;
  rateCardUrl: string;
  payoutNotes: string;
  generalHandles: SocialHandleEntry[];
  dealHandles: Array<
    SocialHandleEntry & {
      audienceLabel: string;
      partnershipContext: string;
    }
  >;
};

function buildProfileIdentityDraft(profile: ProfileRecord, initialEmail: string): ProfileIdentityDraft {
  return {
    displayName: profile.displayName ?? "",
    creatorLegalName: profile.creatorLegalName ?? "",
    businessName: profile.businessName ?? "",
    contactEmail: profile.contactEmail ?? initialEmail,
    preferredSignature: profile.preferredSignature ?? ""
  };
}

function buildGeneralHandles(initialHandles: SocialHandleEntry[]) {
  const seen = new Set<ProfilePlatform>();

  return initialHandles
    .filter((entry) => !entry.partnershipContext)
    .filter((entry) => {
      if (seen.has(entry.platform)) {
        return false;
      }

      seen.add(entry.platform);
      return true;
    })
    .map((entry) => ({
      ...entry,
      audienceLabel: entry.audienceLabel ?? "",
      partnershipContext: null
    }));
}

export function emptyGeneralHandle(
  platform: ProfilePlatform,
  id = createClientRowId(`general-${platform}`)
): SocialHandleEntry {
  return {
    id,
    platform,
    handle: "",
    audienceLabel: "",
    partnershipContext: null
  };
}

export function emptyDealHandle(
  id = createClientRowId("deal")
): SocialHandleEntry & {
  audienceLabel: string;
  partnershipContext: string;
} {
  return {
    id,
    platform: "instagram",
    handle: "",
    audienceLabel: "",
    partnershipContext: ""
  };
}

export function buildProfileEditorDraft(
  profile: ProfileRecord,
  initialEmail: string
): ProfileEditorDraft {
  const { metadata } = parseProfileMetadata(profile.payoutDetails);
  const splitHandles = splitSocialHandles(metadata.socialHandles);

  return {
    ...buildProfileIdentityDraft(profile, initialEmail),
    bio: metadata.bio ?? "",
    location: metadata.location ?? "",
    primaryPlatform: metadata.primaryPlatform ?? "instagram",
    contentCategory: metadata.contentCategory ?? PROFILE_CATEGORY_OPTIONS[0],
    taxId: metadata.taxId ?? "",
    address: metadata.address ?? "",
    rateCardUrl: metadata.rateCardUrl ?? "",
    payoutNotes: metadata.payoutNotes ?? "",
    generalHandles: buildGeneralHandles(splitHandles.generalHandles),
    dealHandles:
      splitHandles.dealSpecificHandles.length > 0
        ? splitHandles.dealSpecificHandles.map((entry) => ({
            ...entry,
            audienceLabel: entry.audienceLabel ?? "",
            partnershipContext: entry.partnershipContext ?? ""
          }))
        : [emptyDealHandle("deal-default")]
  };
}

export function buildProfileEditorPatch(
  form: ProfileEditorDraft,
  profile: ProfileRecord
) {
  const seenGeneralPlatforms = new Set<ProfilePlatform>();
  const socialHandles = [
    ...form.generalHandles
      .filter((entry) => {
        if (seenGeneralPlatforms.has(entry.platform)) {
          return false;
        }

        seenGeneralPlatforms.add(entry.platform);
        return true;
      })
      .map((entry) => ({
        ...entry,
        audienceLabel: entry.audienceLabel?.trim() || null
      })),
    ...form.dealHandles.map((entry) => ({
      ...entry,
      audienceLabel: entry.audienceLabel?.trim() || null,
      partnershipContext: entry.partnershipContext?.trim() || null
    }))
  ];

  return {
    ...buildProfileIdentityPatch(form),
    payoutDetails: serializeProfileMetadata({
      bio: form.bio.trim() || null,
      location: form.location.trim() || null,
      primaryPlatform: form.primaryPlatform,
      contentCategory: form.contentCategory.trim() || null,
      taxId: form.taxId.trim() || null,
      address: form.address.trim() || null,
      rateCardUrl: form.rateCardUrl.trim() || null,
      payoutNotes: form.payoutNotes.trim() || null,
      socialHandles
    }),
    defaultCurrency: profile.defaultCurrency ?? "USD",
    reminderLeadDays: profile.reminderLeadDays ?? 3,
    conflictAlertsEnabled: profile.conflictAlertsEnabled,
    paymentRemindersEnabled: profile.paymentRemindersEnabled
  };
}

export function buildProfileSettingsDraft(
  profile: ProfileRecord,
  initialEmail: string,
  initialProductUpdatesEnabled = true
): ProfileSettingsDraft {
  return {
    ...buildProfileIdentityDraft(profile, initialEmail),
    defaultCurrency: profile.defaultCurrency ?? "USD",
    reminderLeadDays: String(profile.reminderLeadDays ?? 3),
    conflictAlertsEnabled: profile.conflictAlertsEnabled,
    paymentRemindersEnabled: profile.paymentRemindersEnabled,
    emailNotificationsEnabled: profile.emailNotificationsEnabled,
    productUpdatesEnabled: initialProductUpdatesEnabled,
    accentColor: profile.accentColor ?? ""
  };
}

export function buildProfileSettingsPatch(
  form: ProfileSettingsDraft,
  profile: ProfileRecord
) {
  const { metadata } = parseProfileMetadata(profile.payoutDetails);

  return {
    ...buildProfileIdentityPatch(form),
    payoutDetails: serializeProfileMetadata(metadata),
    defaultCurrency: form.defaultCurrency.trim() || "USD",
    reminderLeadDays:
      form.reminderLeadDays.trim().length > 0 ? Number(form.reminderLeadDays) : 3,
    conflictAlertsEnabled: form.conflictAlertsEnabled,
    paymentRemindersEnabled: form.paymentRemindersEnabled,
    emailNotificationsEnabled: form.emailNotificationsEnabled,
    productUpdatesEnabled: form.productUpdatesEnabled,
    accentColor: form.accentColor || null
  };
}

function buildProfileIdentityPatch(form: ProfileIdentityDraft) {
  return {
    displayName: form.displayName.trim() || null,
    creatorLegalName: form.creatorLegalName.trim() || null,
    businessName: form.businessName.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
    preferredSignature: form.preferredSignature.trim() || null
  };
}
