import type { ReactNode } from "react";

import type { ProfilePlatform } from "@/lib/profile-metadata";
import {
  InstagramIcon,
  TikTokIcon,
  YouTubeIcon,
  XTwitterIcon,
  ThreadsIcon,
  EnvelopeIcon,
  PodcastIcon,
  GlobeIcon,
} from "@/lib/platform-icons";

const ICON_CLASS_NAME = "h-4 w-4";

const PLATFORM_ICON_MAP: Record<string, typeof InstagramIcon> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  twitter: XTwitterIcon,
  threads: ThreadsIcon,
  newsletter: EnvelopeIcon,
  podcast: PodcastIcon,
};

export function SocialPlatformIcon({
  platform,
}: {
  platform: ProfilePlatform | string;
}): ReactNode {
  const Icon = PLATFORM_ICON_MAP[platform] ?? GlobeIcon;
  return <Icon className={ICON_CLASS_NAME} />;
}
