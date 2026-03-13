import { generateDraftAction } from "@/app/actions";
import type { DraftIntent, EmailDraftRecord } from "@/lib/types";

const intents: Array<{ value: DraftIntent; label: string }> = [
  { value: "clarify-clause", label: "Clarify clause" },
  { value: "request-faster-payment", label: "Ask for faster payment" },
  { value: "limit-usage-rights", label: "Limit usage rights" },
  { value: "clarify-deadline", label: "Clarify deadline" },
  { value: "payment-reminder", label: "Payment reminder" },
  { value: "request-contract-revisions", label: "Request revisions" },
  { value: "confirm-deliverables", label: "Confirm deliverables" },
  { value: "confirm-revised-brief", label: "Confirm revised brief" }
];

export function EmailDrafts({
  dealId,
  drafts
}: {
  dealId: string;
  drafts: EmailDraftRecord[];
}) {
  return (
    <section className="rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-panel">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-serif text-3xl text-ocean">Emails</h2>
          <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
            Draft polished creator-brand replies using the latest saved terms from
            this workspace.
          </p>
        </div>
        <form action={generateDraftAction} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="dealId" value={dealId} />
          <select
            name="intent"
            className="rounded-full border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3 text-sm"
            defaultValue="clarify-clause"
          >
            {intents.map((intent) => (
              <option key={intent.value} value={intent.value}>
                {intent.label}
              </option>
            ))}
          </select>
          <button className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white">
            Generate draft
          </button>
        </form>
      </div>
      <div className="mt-6 grid gap-4">
        {drafts.map((draft) => (
          <article
            key={draft.id}
            className="rounded-[1.5rem] border border-black/5 dark:border-white/10 bg-sand/50 dark:bg-white/[0.05] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-black/80 dark:text-white/85">{draft.subject}</h3>
              <span className="rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-semibold capitalize text-black/60 dark:text-white/65">
                {draft.intent.replace(/-/g, " ")}
              </span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-black/70 dark:text-white/75">
              {draft.body}
            </pre>
          </article>
        ))}
        {drafts.length === 0 ? (
          <p className="rounded-2xl bg-sand/50 dark:bg-white/[0.05] px-4 py-4 text-sm text-black/60 dark:text-white/65">
            No drafts yet. Generate one based on the current workspace terms.
          </p>
        ) : null}
      </div>
    </section>
  );
}
