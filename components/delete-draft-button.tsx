"use client";

import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const INTAKE_DRAFT_DELETE_START_EVENT = "intake-draft-delete-start";

export function DeleteDraftButton({
  label = "Delete draft",
  pendingLabel = "Deleting draft...",
  className,
  children,
  ...props
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function dispatchDeleteStart(form: HTMLFormElement) {
    if (typeof window === "undefined") {
      return;
    }

    const submittedSessionId = new FormData(form).get("sessionId");
    if (typeof submittedSessionId === "string" && submittedSessionId.length > 0) {
      window.dispatchEvent(
        new CustomEvent(INTAKE_DRAFT_DELETE_START_EVENT, {
          detail: { sessionId: submittedSessionId },
        })
      );
    }
  }

  function handleTriggerClick(event: MouseEvent<HTMLButtonElement>) {
    props.onClick?.(event);
    if (event.defaultPrevented || pending) {
      return;
    }

    setOpen(true);
  }

  function handleConfirm() {
    const form = triggerRef.current?.form;
    if (!form || pending) {
      return;
    }

    dispatchDeleteStart(form);
    setOpen(false);
    form.requestSubmit();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          ref={triggerRef}
          aria-busy={pending || undefined}
          className={className}
          disabled={props.disabled || pending}
          {...props}
          onClick={handleTriggerClick}
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              {pendingLabel}
            </span>
          ) : (
            (children ?? label)
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-none border border-black/10 bg-white p-0 shadow-lg [&>button]:rounded-none dark:border-white/10 dark:bg-card">
        <DialogHeader className="border-b border-black/8 px-6 py-5 text-left dark:border-white/10">
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Delete draft
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            Delete this intake draft and its in-progress uploaded source material. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t border-black/8 px-6 py-4 sm:justify-between dark:border-white/10">
          <button
            type="button"
            className="inline-flex items-center justify-center border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:text-black dark:border-white/10 dark:text-white/60 dark:hover:text-white"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Keep draft
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center bg-[#244034] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d342b] disabled:opacity-60"
            onClick={handleConfirm}
            disabled={pending}
          >
            Delete draft
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
