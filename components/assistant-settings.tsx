"use client";

import type { AssistantTone } from "@/lib/types";

const toneOptions: { value: AssistantTone; label: string; description: string }[] = [
  {
    value: "professional",
    label: "Professional",
    description: "Polished, practical, and business-ready.",
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm and approachable without losing clarity.",
  },
  {
    value: "direct",
    label: "Direct",
    description: "Concise, sharp, and easy to scan.",
  },
  {
    value: "warm",
    label: "Warm",
    description: "Human and supportive while staying grounded.",
  },
];

type AssistantSettingsProps = {
  open: boolean;
  tone: AssistantTone;
  onToneChange: (tone: AssistantTone) => void;
  onClose: () => void;
};

export function AssistantSettings({ open, tone, onToneChange, onClose }: AssistantSettingsProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-[260px] border border-black/10 bg-[#f7f5f1] p-3 shadow-[0_18px_50px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#121419]">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Assistant settings</h3>
        <p className="text-[11px] leading-4.5 text-muted-foreground">
          Change how the assistant writes
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tone</p>
        <div className="space-y-1.5">
          {toneOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onToneChange(option.value);
                onClose();
              }}
              className={`w-full border px-3 py-3 text-left transition ${
                tone === option.value
                  ? "border-ocean bg-ocean/8"
                  : "border-black/10 bg-white hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
              }`}
            >
              <p className="text-[13px] font-semibold text-foreground">{option.label}</p>
              <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
