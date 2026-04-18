"use client";

import { Sparkles } from "lucide-react";

import { useOptionalAssistant } from "@/components/assistant-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssistantTrigger } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AssistantSuggestionDropdown({
  suggestions,
}: {
  suggestions: { label: string; trigger: AssistantTrigger }[];
}) {
  const assistant = useOptionalAssistant();

  if (suggestions.length === 0) {
    return null;
  }

  if (suggestions.length === 1) {
    return (
      <button
        type="button"
        onClick={() =>
          assistant?.openAssistant({
            trigger: suggestions[0].trigger,
            prompt: suggestions[0].trigger.prompt,
          })
        }
        disabled={!assistant}
        className={cn(
          "inline-flex items-center gap-1.5 border border-black/10 bg-white text-xs font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20",
          "px-3 py-2"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{suggestions[0].label}</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!assistant}
          className={cn(
            "inline-flex items-center gap-1.5 border border-black/10 bg-white text-xs font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20",
            "px-3 py-2"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{suggestions.length}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="rounded-none border-black/10 p-1"
      >
        {suggestions.map((suggestion) => (
          <DropdownMenuItem
            key={suggestion.label}
            onSelect={() =>
              assistant?.openAssistant({
                trigger: suggestion.trigger,
                prompt: suggestion.trigger.prompt,
              })
            }
            className="rounded-none px-3 py-2.5 text-[12px] font-medium"
          >
            {suggestion.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
