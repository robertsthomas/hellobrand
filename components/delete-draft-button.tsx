"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

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

  return (
    <button
      type="submit"
      aria-busy={pending || undefined}
      className={className}
      disabled={props.disabled || pending}
      {...props}
      onClick={(event) => {
        if (pending) {
          return;
        }

        const confirmed = window.confirm(
          "Delete this intake draft? This will remove the draft and its in-progress uploaded source material."
        );

        if (!confirmed) {
          event.preventDefault();
        }

        if (confirmed && typeof window !== "undefined") {
          const submittedSessionId = event.currentTarget.form
            ? new FormData(event.currentTarget.form).get("sessionId")
            : null;

          if (typeof submittedSessionId === "string" && submittedSessionId.length > 0) {
            window.dispatchEvent(
              new CustomEvent(INTAKE_DRAFT_DELETE_START_EVENT, {
                detail: { sessionId: submittedSessionId },
              })
            );
          }
        }

        props.onClick?.(event);
      }}
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
  );
}
