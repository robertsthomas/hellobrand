"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const ACCENT_PRESETS = [
  { label: "Forest", hex: "#1a4d3e" },
  { label: "Ocean", hex: "#1a5276" },
  { label: "Indigo", hex: "#3730a3" },
  { label: "Violet", hex: "#6d28d9" },
  { label: "Berry", hex: "#9d174d" },
  { label: "Coral", hex: "#c2410c" },
  { label: "Amber", hex: "#b45309" },
  { label: "Slate", hex: "#334155" }
] as const;

/** Strip leading @ for storage. */
function stripAt(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export function OnboardingStepIdentity({
  displayName,
  setDisplayName,
  contactEmail,
  primaryHandle,
  setPrimaryHandle,
  accentColor,
  setAccentColor,
  onContinue
}: {
  displayName: string;
  setDisplayName: (value: string) => void;
  contactEmail: string;
  primaryHandle: string;
  setPrimaryHandle: (value: string) => void;
  accentColor: string;
  setAccentColor: (value: string) => void;
  onContinue: () => void;
}) {
  const canContinue = displayName.trim().length > 0 && stripAt(primaryHandle).length > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canContinue) return;
    setPrimaryHandle(stripAt(primaryHandle));
    onContinue();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Welcome to HelloBrand
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-black/55 dark:text-white/60">
        Let&apos;s set up your creator profile for a better HelloBrand experience.
      </p>

      <div className="mt-8 grid gap-6">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Name
          <input
            className="h-12 rounded-none border border-black/12 bg-white px-4 text-base text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/30 dark:border-white/12 dark:bg-white/[0.04]"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="First and last name"
            autoFocus
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Handle
          <input
            className="h-12 rounded-none border border-black/12 bg-white px-4 text-base text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/30 dark:border-white/12 dark:bg-white/[0.04]"
            value={primaryHandle}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                setPrimaryHandle("");
              } else if (val.startsWith("@")) {
                setPrimaryHandle(val);
              } else {
                setPrimaryHandle("@" + val);
              }
            }}
            placeholder="@handle"
          />
          <span className="text-xs font-normal text-black/45 dark:text-white/45">
            Don&apos;t worry, you can change this per platform.
          </span>
        </label>

        <div className="rounded-none bg-sand/50 px-4 py-3 dark:bg-white/[0.04]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-black/40 dark:text-white/40">
            Email
          </div>
          <div className="mt-1.5 text-sm font-semibold text-ink">
            {contactEmail}
          </div>
        </div>

        {/* Accent color */}
        <div className="grid gap-2">
          <span className="text-sm font-medium text-black/70 dark:text-white/75">
            Accent color
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((preset) => {
              const isSelected = accentColor === preset.hex;
              return (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.label}
                  onClick={() => setAccentColor(preset.hex)}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center border-2 transition-all",
                    isSelected
                      ? "border-foreground scale-110"
                      : "border-transparent hover:border-border"
                  )}
                >
                  <span
                    className="block h-full w-full"
                    style={{ backgroundColor: preset.hex }}
                  />
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
            <label
              className={cn(
                "relative flex h-9 w-9 cursor-pointer items-center justify-center border-2 transition-all",
                accentColor && !ACCENT_PRESETS.some((p) => p.hex === accentColor)
                  ? "border-foreground scale-110"
                  : "border-transparent hover:border-border"
              )}
            >
              <input
                type="color"
                value={accentColor || "#1a4d3e"}
                onChange={(e) => setAccentColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span
                className="block h-full w-full"
                style={{
                  background: accentColor && !ACCENT_PRESETS.some((p) => p.hex === accentColor)
                    ? accentColor
                    : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)"
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          type="submit"
          disabled={!canContinue}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90",
            !canContinue ? "cursor-not-allowed opacity-40" : ""
          )}
        >
          Continue
        </button>
      </div>
    </form>
  );
}
