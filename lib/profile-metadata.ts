const PROFILE_METADATA_PREFIX = "__HELLOBRAND_PROFILE_V1__:";

export const PROFILE_PLATFORM_OPTIONS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "twitch",
  "twitter",
  "threads",
  "newsletter",
  "podcast",
  "other"
] as const;

export const PROFILE_CATEGORY_OPTIONS = [
  "Beauty & Skincare",
  "Lifestyle",
  "Fashion",
  "Parenting & Family",
  "Food & Drink",
  "Fitness & Wellness",
  "Travel",
  "Tech",
  "Gaming",
  "Home",
  "Business",
  "Other"
] as const;

export type ProfilePlatform = (typeof PROFILE_PLATFORM_OPTIONS)[number];

export interface SocialHandleEntry {
  id: string;
  platform: ProfilePlatform;
  handle: string;
  audienceLabel: string | null;
  partnershipContext: string | null;
}

interface ProfileMetadata {
  bio: string | null;
  location: string | null;
  primaryPlatform: ProfilePlatform | null;
  contentCategory: string | null;
  taxId: string | null;
  address: string | null;
  rateCardUrl: string | null;
  payoutNotes: string | null;
  socialHandles: SocialHandleEntry[];
}

const EMPTY_METADATA: ProfileMetadata = {
  bio: null,
  location: null,
  primaryPlatform: null,
  contentCategory: null,
  taxId: null,
  address: null,
  rateCardUrl: null,
  payoutNotes: null,
  socialHandles: []
};

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePlatform(value: unknown): ProfilePlatform | null {
  if (typeof value !== "string") {
    return null;
  }

  return PROFILE_PLATFORM_OPTIONS.includes(value as ProfilePlatform)
    ? (value as ProfilePlatform)
    : null;
}

function normalizeSocialHandleEntry(
  value: unknown,
  fallbackIndex: number
): SocialHandleEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const platform = normalizePlatform(record.platform) ?? "instagram";
  const handle = normalizeNullableString(record.handle);
  const audienceLabel = normalizeNullableString(record.audienceLabel);
  const partnershipContext =
    normalizeNullableString(record.partnershipContext) ??
    normalizeNullableString(record.dealContext);

  if (!handle && !partnershipContext) {
    return null;
  }

  return {
    id:
      normalizeNullableString(record.id) ??
      `social-${platform}-${fallbackIndex + 1}`,
    platform,
    handle: handle ?? "",
    audienceLabel,
    partnershipContext
  };
}

export function parseProfileMetadata(raw: string | null | undefined) {
  if (!raw) {
    return { metadata: { ...EMPTY_METADATA }, hasStructuredMetadata: false };
  }

  if (!raw.startsWith(PROFILE_METADATA_PREFIX)) {
    return {
      metadata: {
        ...EMPTY_METADATA,
        payoutNotes: normalizeNullableString(raw)
      },
      hasStructuredMetadata: false
    };
  }

  try {
    const parsed = JSON.parse(raw.slice(PROFILE_METADATA_PREFIX.length)) as
      | Record<string, unknown>
      | null;

    const socialHandles = Array.isArray(parsed?.socialHandles)
      ? parsed.socialHandles
          .map((entry, index) => normalizeSocialHandleEntry(entry, index))
          .filter((entry): entry is SocialHandleEntry => entry !== null)
      : [];

    return {
      metadata: {
        bio: normalizeNullableString(parsed?.bio),
        location: normalizeNullableString(parsed?.location),
        primaryPlatform: normalizePlatform(parsed?.primaryPlatform),
        contentCategory: normalizeNullableString(parsed?.contentCategory),
        taxId: normalizeNullableString(parsed?.taxId),
        address: normalizeNullableString(parsed?.address),
        rateCardUrl: normalizeNullableString(parsed?.rateCardUrl),
        payoutNotes: normalizeNullableString(parsed?.payoutNotes),
        socialHandles
      },
      hasStructuredMetadata: true
    };
  } catch {
    return {
      metadata: {
        ...EMPTY_METADATA,
        payoutNotes: normalizeNullableString(raw)
      },
      hasStructuredMetadata: false
    };
  }
}

export function serializeProfileMetadata(metadata: ProfileMetadata) {
  const socialHandles = metadata.socialHandles
    .map((entry, index) => normalizeSocialHandleEntry(entry, index))
    .filter((entry): entry is SocialHandleEntry => entry !== null);

  return `${PROFILE_METADATA_PREFIX}${JSON.stringify({
    bio: normalizeNullableString(metadata.bio),
    location: normalizeNullableString(metadata.location),
    primaryPlatform: normalizePlatform(metadata.primaryPlatform),
    contentCategory: normalizeNullableString(metadata.contentCategory),
    taxId: normalizeNullableString(metadata.taxId),
    address: normalizeNullableString(metadata.address),
    rateCardUrl: normalizeNullableString(metadata.rateCardUrl),
    payoutNotes: normalizeNullableString(metadata.payoutNotes),
    socialHandles
  })}`;
}

export function splitSocialHandles(handles: SocialHandleEntry[]) {
  const generalHandles: SocialHandleEntry[] = [];
  const dealSpecificHandles: SocialHandleEntry[] = [];

  handles.forEach((entry) => {
    if (entry.partnershipContext) {
      dealSpecificHandles.push(entry);
      return;
    }

    generalHandles.push(entry);
  });

  return { generalHandles, dealSpecificHandles };
}
