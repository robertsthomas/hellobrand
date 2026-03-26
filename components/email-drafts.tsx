import { generateDraftAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
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
    <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Emails
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
            Draft polished creator-brand replies using the latest saved terms from
            this workspace.
          </p>
        </div>
        <form action={generateDraftAction} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="dealId" value={dealId} />
          <select
            name="intent"
            className="border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/12 dark:bg-white/[0.03]"
            defaultValue="clarify-clause"
          >
            {intents.map((intent) => (
              <option key={intent.value} value={intent.value}>
                {intent.label}
              </option>
            ))}
          </select>
          <SubmitButton
            pendingLabel="Generating draft..."
            showSpinner
            className="inline-flex items-center justify-center bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generate draft
          </SubmitButton>
        </form>
      </div>
      <div className="mt-6 grid gap-4">
        {drafts.map((draft) => (
          <article
            key={draft.id}
            className="border border-black/8 p-4 dark:border-white/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-black/80 dark:text-white/85">{draft.subject}</h3>
              <span className="border border-black/8 px-3 py-1 text-xs font-semibold capitalize text-black/60 dark:border-white/10 dark:text-white/65">
                {draft.intent.replace(/-/g, " ")}
              </span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-black/70 dark:text-white/75">
              {draft.body}
            </pre>
          </article>
        ))}
        {drafts.length === 0 ? (
          <p className="border border-dashed border-black/10 px-4 py-4 text-sm text-black/60 dark:border-white/12 dark:text-white/65">
            No drafts yet. Generate one based on the current workspace terms.
          </p>
        ) : null}
      </div>
    </section>
  );
}
