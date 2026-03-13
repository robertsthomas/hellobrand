import { saveTermsAction } from "@/app/actions";

export function DealNotesPanel({
  dealId,
  notes
}: {
  dealId: string;
  notes: string | null;
}) {
  return (
    <form
      action={saveTermsAction}
      className="grid gap-4 rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-panel"
    >
      <div>
        <h2 className="font-serif text-3xl text-ocean">Notes</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/65">
          Keep your creator-side context here, like negotiation reminders or
          delivery prep notes.
        </p>
      </div>

      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="deliverablesJson" value="[]" />
      <input type="hidden" name="usageChannelsJson" value="[]" />

      <textarea
        className="min-h-40 rounded-[1.5rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-4 text-sm"
        name="notes"
        defaultValue={notes ?? ""}
        placeholder="Add creator-side notes, open questions, negotiated updates, or payment reminders."
      />

      <button className="inline-flex w-fit rounded-full border border-black/10 dark:border-white/12 bg-white dark:bg-white/10 dark:text-white px-5 py-3 text-sm font-semibold text-ink">
        Save notes
      </button>
    </form>
  );
}
