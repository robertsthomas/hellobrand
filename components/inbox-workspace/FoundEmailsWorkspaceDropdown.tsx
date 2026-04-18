"use client";

import { Check, ChevronDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type WorkspaceOption = {
  value: string;
  label: string;
};

export function InboxWorkspaceDropdown({
  value,
  onChange,
  options,
  createValue,
  placeholder = "Select an option",
  className,
  contentClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: WorkspaceOption[];
  createValue?: string;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const triggerLabel = selectedOption?.label ?? placeholder;
  const showCreateIcon = Boolean(createValue && value === createValue);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={triggerLabel}
          className={cn(
            "inline-flex h-8 min-w-[11.5rem] max-w-[13.75rem] items-center justify-between border border-border bg-white px-3 text-left text-[11px] text-foreground outline-none transition hover:border-black/20 focus:border-primary",
            "rounded-none",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {showCreateIcon ? <Plus className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className={cn(
          "w-[13.75rem] rounded-none border-black/10 bg-white p-1 shadow-lg",
          contentClassName
        )}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const isCreateOption = Boolean(createValue && option.value === createValue);

          return (
            <div key={option.value}>
              {index === 1 ? <DropdownMenuSeparator className="mx-0 my-1" /> : null}
              <DropdownMenuItem
                onSelect={() => onChange(option.value)}
                title={option.label}
                className="rounded-none px-3 py-2 text-[11px] font-medium text-foreground"
              >
                {isCreateOption ? <Plus className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                <span className="min-w-0 flex-1 truncate" title={option.label}>
                  {option.label}
                </span>
                {isSelected ? <Check className="h-3.5 w-3.5 text-foreground" /> : null}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
