"use client";

import { Sparkles } from "lucide-react";

import { useAssistant } from "@/components/assistant-provider";
import type { AssistantTrigger } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AssistantTriggerButton({
  trigger,
  label = "Ask assistant",
  className,
  variant = "inline"
}: {
  trigger: AssistantTrigger;
  label?: string;
  className?: string;
  variant?: "inline" | "icon";
}) {
  const { openAssistant } = useAssistant();

  return (
    <button
      type="button"
      onClick={() => openAssistant({ trigger, prompt: trigger.prompt })}
      className={cn(
        "inline-flex items-center gap-2 border border-black/10 bg-white text-xs font-semibold text-foreground transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20",
        variant === "inline" ? "px-3 py-2" : "h-8 w-8 justify-center",
        className
      )}
      aria-label={label}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {variant === "inline" ? <span>{label}</span> : null}
    </button>
  );
}
