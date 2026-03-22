"use client";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PROFILE_CATEGORY_OPTIONS } from "@/lib/profile-metadata";

export function OnboardingStepProfile({
  contentCategory,
  setContentCategory,
  bio,
  setBio,
  onBack,
  onComplete,
  isPending
}: {
  contentCategory: string;
  setContentCategory: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  onBack: () => void;
  onComplete: () => void;
  isPending: boolean;
}) {
  const canComplete = contentCategory.length > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canComplete || isPending) return;
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        About your content
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-black/55 dark:text-white/60">
        Help us personalize your experience with a few more details.
      </p>

      <div className="mt-8 grid gap-6">
        {/* Content category - required */}
        <div className="grid gap-2">
          <span className="text-sm font-medium text-black/70 dark:text-white/75">
            Content niche
          </span>
          <div className="grid grid-cols-3 gap-2">
            {PROFILE_CATEGORY_OPTIONS.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setContentCategory(category)}
                className={cn(
                  "rounded-none border px-3 py-2.5 text-[13px] font-medium transition",
                  contentCategory === category
                    ? "border-ocean bg-ocean/6 text-ocean dark:border-ocean/60 dark:bg-ocean/12"
                    : "border-black/8 bg-white text-black/65 shadow-sm hover:border-black/16 dark:border-white/12 dark:bg-white/[0.04] dark:text-white/70 dark:hover:border-white/20"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Bio - optional */}
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          <span>
            Bio{" "}
            <span className="font-normal text-black/40 dark:text-white/40">
              (optional)
            </span>
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short description of what you create"
            rows={3}
            maxLength={500}
            className="rounded-none border border-black/12 bg-white px-4 py-3 text-base text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/30 dark:border-white/12 dark:bg-white/[0.04]"
          />
        </label>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-12 flex-1"
          )}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!canComplete || isPending}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 flex-1 bg-ink text-white hover:bg-ink/90 dark:bg-white dark:text-black dark:hover:bg-white/90",
            !canComplete || isPending ? "cursor-not-allowed opacity-40" : ""
          )}
        >
          {isPending ? "Setting up..." : "Complete setup"}
        </button>
      </div>
    </form>
  );
}
