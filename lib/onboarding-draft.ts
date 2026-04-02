import { PROFILE_PLATFORM_OPTIONS, type ProfilePlatform } from "@/lib/profile-metadata";

export type ProfileOnboardingDraft = {
  displayName: string;
  contactEmail: string;
  timeZone?: string | null;
  primaryHandle: string;
  selectedPlatforms: ProfilePlatform[];
  platformHandles: Record<string, string>;
  contentCategory: string;
  bio: string;
  accentColor: string;
};

export function normalizeOnboardingHandle(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function stripOnboardingHandlePrefix(value: string) {
  const normalized = normalizeOnboardingHandle(value);
  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

export function isValidOnboardingPlatform(value: string): value is ProfilePlatform {
  return PROFILE_PLATFORM_OPTIONS.includes(value as ProfilePlatform);
}

export function buildProfileOnboardingSubmission(input: ProfileOnboardingDraft) {
  const normalizedPrimaryHandle = normalizeOnboardingHandle(input.primaryHandle);
  const selectedPlatforms = input.selectedPlatforms.filter(isValidOnboardingPlatform);

  return {
    displayName: input.displayName.trim(),
    contactEmail: input.contactEmail.trim(),
    timeZone: input.timeZone?.trim() || null,
    primaryHandle: normalizedPrimaryHandle,
    selectedPlatforms,
    platformHandles: Object.fromEntries(
      selectedPlatforms.map((platform) => {
        const customHandle = input.platformHandles[platform];
        const nextHandle = customHandle?.trim()
          ? normalizeOnboardingHandle(customHandle)
          : normalizedPrimaryHandle;

        return [platform, nextHandle];
      })
    ) as Record<string, string>,
    contentCategory: input.contentCategory.trim(),
    bio: input.bio.trim() || null,
    accentColor: input.accentColor || null
  };
}
