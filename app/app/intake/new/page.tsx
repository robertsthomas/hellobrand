import { startIntakeAction } from "@/app/actions";

export default function NewIntakePage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Start a new intake</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Upload a contract, paste an email thread, or do both. HelloBrand
            will analyze the documents first, then let you confirm the deal
            details before the workspace goes live.
          </p>
        </section>

        <form
          action={startIntakeAction}
          className="grid gap-6 rounded-[2rem] border border-black/5 bg-white/85 p-8 shadow-panel dark:border-white/10 dark:bg-white/[0.06]"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Brand name
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
                name="brandName"
                placeholder="Glossier"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Campaign name
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/50 px-4 py-4 dark:border-white/12 dark:bg-white/[0.05]"
                name="campaignName"
                placeholder="Spring recovery drop"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Upload files
            <input
              className="block w-full rounded-[1.5rem] border border-dashed border-black/20 bg-sand/40 px-4 py-4 text-sm dark:border-white/15 dark:bg-white/[0.04]"
              type="file"
              name="documents"
              multiple
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Paste agreement text or email clarifications
              <textarea
                className="min-h-40 rounded-[1.5rem] border border-black/10 bg-sand/40 px-4 py-4 text-sm dark:border-white/12 dark:bg-white/[0.04]"
                name="pastedText"
                placeholder="Paste a plain-text agreement, deliverables brief, or email clarification here."
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Pasted text title
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-4 text-sm dark:border-white/12 dark:bg-white/[0.04]"
                name="pastedTextTitle"
                placeholder="march-brand-email.txt"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Intake notes
            <textarea
              className="min-h-28 rounded-[1.5rem] border border-black/10 bg-sand/40 px-4 py-4 text-sm dark:border-white/12 dark:bg-white/[0.04]"
              name="notes"
              placeholder="Anything you already know about rate, deliverables, or open questions."
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-2xl text-sm text-black/55 dark:text-white/60">
              The intake stays editable. You will confirm brand name, campaign
              name, payment, and notes before the deal appears in your dashboard.
            </p>
            <button className="rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white">
              Analyze documents
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
