import { saveDealNotesAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { sanitizePlainTextInput } from "@/lib/utils";

export function DealNotesPanel({
  dealId,
  notes
}: {
  dealId: string;
  notes: string | null;
}) {
  const sanitizedNotes = sanitizePlainTextInput(notes);

  return (
    <form
      action={saveDealNotesAction}
      className="grid gap-6 border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]"
    >
      <div>
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Notes</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/65">
          Keep your creator-side context here, like negotiation reminders or
          delivery prep notes.
        </p>
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <textarea
        className="min-h-40 border border-black/10 bg-white px-4 py-4 text-sm text-foreground outline-none transition focus:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:focus:border-white/20"
        name="notes"
        defaultValue={sanitizedNotes}
        placeholder="Add creator-side notes, open questions, negotiated updates, or payment reminders."
      />

      <SubmitButton
        pendingLabel="Saving notes..."
        showSpinner
        className="inline-flex w-fit border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/20"
      >
        Save notes
      </SubmitButton>
    </form>
  );
}
