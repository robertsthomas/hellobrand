"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { deleteWorkspaceConfirmedAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

const INITIAL_STATE = { error: null as string | null };

export function DeleteWorkspaceConfirmationForm({
  dealId,
  dealName,
  redirectTo
}: {
  dealId: string;
  dealName: string;
  redirectTo: string;
}) {
  const [confirmationText, setConfirmationText] = useState("");
  const [state, formAction] = useActionState(
    deleteWorkspaceConfirmedAction,
    INITIAL_STATE
  );
  const normalizedConfirmation = useMemo(
    () => confirmationText.trim().toLowerCase(),
    [confirmationText]
  );
  const canDelete = normalizedConfirmation === "delete";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div className="space-y-2">
        <label
          htmlFor="confirmationText"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]"
        >
          Type delete to confirm
        </label>
        <input
          id="confirmationText"
          name="confirmationText"
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.currentTarget.value)}
          autoComplete="off"
          spellCheck={false}
          className="h-12 w-full border border-black/10 bg-white px-4 text-base text-foreground outline-none transition focus:border-destructive/40 focus:ring-2 focus:ring-destructive/10 dark:border-white/10 dark:bg-white/[0.03]"
          placeholder={`Type delete to permanently remove ${dealName}`}
        />
        <p className="text-sm text-muted-foreground">
          This permanently deletes the workspace and its related records. This cannot be undone.
        </p>
        {state.error ? (
          <p className="text-sm font-medium text-destructive">{state.error}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pendingLabel="Deleting partnership..."
          showSpinner
          disabled={!canDelete}
          className="inline-flex h-11 items-center justify-center bg-destructive px-5 text-sm font-semibold text-white transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete partnership
        </SubmitButton>
        <Link
          href={redirectTo}
          className="inline-flex h-11 items-center justify-center border border-black/10 px-5 text-sm font-semibold text-foreground transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
