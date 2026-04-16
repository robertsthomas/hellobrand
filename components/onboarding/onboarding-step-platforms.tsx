"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { ProfilePlatform } from "@/lib/profile-metadata";
import {
  POPULAR_PLATFORMS,
  EXTENDED_PLATFORMS,
  PLATFORM_DISPLAY,
} from "@/lib/onboarding-platforms";
import {
  InstagramIcon,
  TikTokIcon,
  YouTubeIcon,
  FacebookIcon,
  LinkedInIcon,
  TwitchIcon,
  XTwitterIcon,
  AtSymbolIcon,
  EnvelopeIcon,
  PodcastIcon,
  GlobeIcon,
  type SvgIcon,
} from "@/lib/platform-icons";

const PLATFORM_ICONS: Record<string, SvgIcon> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  twitch: TwitchIcon,
  twitter: XTwitterIcon,
  threads: AtSymbolIcon,
  newsletter: EnvelopeIcon,
  podcast: PodcastIcon,
  other: GlobeIcon,
};

function PlatformCard({
  platform,
  selected,
  onToggle,
}: {
  platform: ProfilePlatform;
  selected: boolean;
  onToggle: () => void;
}) {
  const display = PLATFORM_DISPLAY[platform];
  const Icon = PLATFORM_ICONS[platform] ?? GlobeIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 rounded-none border px-4 py-3.5 text-left text-sm font-medium transition",
        selected
          ? "border-ocean bg-ocean/6 text-ocean dark:border-ocean/60 dark:bg-ocean/12"
          : "border-black/8 bg-white text-black/70 shadow-sm hover:border-black/16 dark:border-white/12 dark:bg-white/[0.04] dark:text-white/75 dark:hover:border-white/20"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{display.label}</span>
    </button>
  );
}

export function OnboardingStepPlatforms({
  primaryHandle,
  selectedPlatforms,
  setSelectedPlatforms,
  platformHandles,
  setPlatformHandles,
  onBack,
  onContinue,
}: {
  primaryHandle: string;
  selectedPlatforms: ProfilePlatform[];
  setSelectedPlatforms: (platforms: ProfilePlatform[]) => void;
  platformHandles: Record<string, string>;
  setPlatformHandles: (handles: Record<string, string>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const canContinue = selectedPlatforms.length > 0;

  const togglePlatform = (platform: ProfilePlatform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
      const next = { ...platformHandles };
      delete next[platform];
      setPlatformHandles(next);
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
      setPlatformHandles({
        ...platformHandles,
        [platform]: primaryHandle,
      });
    }
  };

  const updateHandle = (platform: string, value: string) => {
    setPlatformHandles({ ...platformHandles, [platform]: value });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canContinue) return;
    onContinue();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Where do you create?
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-black/55 dark:text-white/60">
        Select the platforms you&apos;re active on. We&apos;ll use this to customize your workspace
        experience.
      </p>

      <div className="mt-8">
        <div className="grid grid-cols-2 gap-3">
          {POPULAR_PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform}
              platform={platform}
              selected={selectedPlatforms.includes(platform)}
              onToggle={() => togglePlatform(platform)}
            />
          ))}
        </div>

        <div
          className={cn(
            "grid grid-cols-2 gap-3 overflow-hidden transition-all duration-300",
            showMore ? "mt-3 max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          {EXTENDED_PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform}
              platform={platform}
              selected={selectedPlatforms.includes(platform)}
              onToggle={() => togglePlatform(platform)}
            />
          ))}
        </div>

        {!showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="mt-3 text-sm font-medium text-black/50 underline underline-offset-4 transition hover:text-black/70 dark:text-white/50 dark:hover:text-white/70"
          >
            View more platforms
          </button>
        )}

        {selectedPlatforms.length > 0 && (
          <div className="mt-8 space-y-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-black/40 dark:text-white/40">
              Handles per platform
            </p>
            {selectedPlatforms.map((platform) => {
              const display = PLATFORM_DISPLAY[platform];
              const Icon = PLATFORM_ICONS[platform] ?? GlobeIcon;
              return (
                <label
                  key={platform}
                  className="grid gap-1.5 text-sm font-medium text-black/70 dark:text-white/75"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {display.label}
                  </span>
                  <input
                    className="h-11 rounded-none border border-black/12 bg-white px-4 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/30 dark:border-white/12 dark:bg-white/[0.04]"
                    value={platformHandles[platform] ?? ""}
                    onChange={(e) => updateHandle(platform, e.target.value)}
                    placeholder={primaryHandle || "@handle"}
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 flex-1")}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!canContinue}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 flex-1 bg-primary text-primary-foreground hover:bg-primary/90",
            !canContinue ? "cursor-not-allowed opacity-40" : ""
          )}
        >
          Continue
        </button>
      </div>
    </form>
  );
}
