import type { ReactNode } from "react";
import {
  FaEnvelope,
  FaGlobe,
  FaInstagram,
  FaPodcast,
  FaThreads,
  FaTiktok,
  FaXTwitter,
  FaYoutube
} from "react-icons/fa6";

import type { ProfilePlatform } from "@/lib/profile-metadata";

const ICON_CLASS_NAME = "h-4 w-4";

export function SocialPlatformIcon({
  platform
}: {
  platform: ProfilePlatform | string;
}): ReactNode {
  switch (platform) {
    case "instagram":
      return <FaInstagram className={ICON_CLASS_NAME} />;
    case "tiktok":
      return <FaTiktok className={ICON_CLASS_NAME} />;
    case "youtube":
      return <FaYoutube className={ICON_CLASS_NAME} />;
    case "twitter":
      return <FaXTwitter className={ICON_CLASS_NAME} />;
    case "threads":
      return <FaThreads className={ICON_CLASS_NAME} />;
    case "newsletter":
      return <FaEnvelope className={ICON_CLASS_NAME} />;
    case "podcast":
      return <FaPodcast className={ICON_CLASS_NAME} />;
    default:
      return <FaGlobe className={ICON_CLASS_NAME} />;
  }
}
