"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, FilePenLine, Scissors, Search } from "lucide-react";

type AssistantMessageActionsProps = {
  text: string;
  disabled?: boolean;
  onShorten: (text: string) => void | Promise<void>;
  onShowEvidence: (text: string) => void | Promise<void>;
  onDraftEmail: (text: string) => void | Promise<void>;
};

function ActionButton({
  title,
  onClick,
  disabled,
  children
}: {
  title: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => void onClick()}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-white/8"
    >
      {children}
    </button>
  );
}

export function AssistantMessageActions({
  text,
  disabled,
  onShorten,
  onShowEvidence,
  onDraftEmail
}: AssistantMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="mt-3 flex items-center gap-1 border-t border-black/8 pt-2 dark:border-white/10">
      <ActionButton
        title={copied ? "Copied" : "Copy response"}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
        disabled={disabled}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </ActionButton>
      <ActionButton title="Shorten response" onClick={() => onShorten(text)} disabled={disabled}>
        <Scissors className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        title="Show evidence"
        onClick={() => onShowEvidence(text)}
        disabled={disabled}
      >
        <Search className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        title="Draft email from this"
        onClick={() => onDraftEmail(text)}
        disabled={disabled}
      >
        <FilePenLine className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}
