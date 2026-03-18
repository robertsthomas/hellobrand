"use client";

import { Settings, Minus, X } from "lucide-react";

import { AssistantSettings } from "@/components/assistant-settings";
import type { AssistantTone } from "@/lib/types";

type AssistantHeaderProps = {
  title: string;
  pageTitle: string;
  busy: boolean;
  settingsOpen: boolean;
  tone: AssistantTone;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onToneChange: (tone: AssistantTone) => void;
  onMinimize: () => void;
  onEndSession: () => void;
};

export function AssistantHeader({
  title,
  pageTitle,
  busy,
  settingsOpen,
  tone,
  onOpenSettings,
  onCloseSettings,
  onToneChange,
  onMinimize,
  onEndSession
}: AssistantHeaderProps) {
  const actionButtonClassName =
    "text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/8 px-4 py-4 dark:border-white/10">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">HelloBrand AI</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{pageTitle}</p>
      </div>
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={settingsOpen ? onCloseSettings : onOpenSettings}
          disabled={busy}
          className={actionButtonClassName}
          aria-label="Assistant settings"
          title="Assistant settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMinimize}
          disabled={busy}
          className={actionButtonClassName}
          aria-label="Minimize assistant"
          title="Minimize assistant"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onEndSession}
          disabled={busy}
          className={actionButtonClassName}
          aria-label="End chat session"
          title="End chat session"
        >
          <X className="h-4 w-4" />
        </button>
        <AssistantSettings
          open={settingsOpen}
          tone={tone}
          onToneChange={onToneChange}
          onClose={onCloseSettings}
        />
      </div>
    </div>
  );
}
