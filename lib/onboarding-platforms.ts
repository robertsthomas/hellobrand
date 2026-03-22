import type { ProfilePlatform } from "@/lib/profile-metadata";

export const POPULAR_PLATFORMS: ProfilePlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook"
];

export const EXTENDED_PLATFORMS: ProfilePlatform[] = [
  "linkedin",
  "twitch",
  "twitter",
  "threads",
  "newsletter",
  "podcast",
  "other"
];

export const PLATFORM_DISPLAY: Record<
  ProfilePlatform,
  { label: string; iconName: string }
> = {
  instagram: { label: "Instagram", iconName: "instagram" },
  tiktok: { label: "TikTok", iconName: "music" },
  youtube: { label: "YouTube", iconName: "youtube" },
  facebook: { label: "Facebook", iconName: "facebook" },
  linkedin: { label: "LinkedIn", iconName: "linkedin" },
  twitch: { label: "Twitch", iconName: "twitch" },
  twitter: { label: "X (Twitter)", iconName: "twitter" },
  threads: { label: "Threads", iconName: "at-sign" },
  newsletter: { label: "Newsletter", iconName: "mail" },
  podcast: { label: "Podcast", iconName: "mic" },
  other: { label: "Other", iconName: "globe" }
};
