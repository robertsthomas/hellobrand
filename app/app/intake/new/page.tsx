import { startIntakeAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export default function NewIntakePage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
            Documents
          </p>
          <h1 className="text-4xl font-semibold text-ink">Upload documents</h1>
          <p className="text-[17px] leading-8 text-black/60 dark:text-white/65">
            Upload a contract, paste an email thread, or do both. HelloBrand
            analyzes the source material first, then lets you confirm the deal
            details before the workspace goes live.
          </p>
        </section>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
          <form
            action={startIntakeAction}
            className="border-t border-black/10 pt-8 dark:border-white/10"
          >
            <div className="grid gap-8">
              <section className="grid gap-3 border-t border-black/8 pt-8 dark:border-white/8">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-ink">Documents</h2>
                  <p className="text-sm text-black/55 dark:text-white/60">
                    Add the contract first. You can also include briefs, decks,
                    invoices, or pasted email context. Once uploaded, HelloBrand
                    opens the analysis screen and starts filling in the deal data.
                  </p>
                </div>
                <label className="grid gap-3">
                  <span className="text-sm font-medium text-black/70 dark:text-white/75">
                    Upload files
                  </span>
                  <div className="rounded-xl border border-dashed border-black/15 bg-white px-4 py-5 dark:border-white/12 dark:bg-white/[0.03]">
                    <input
                      className="block w-full text-sm text-black/65 file:mr-4 file:rounded-lg file:border-0 file:bg-ocean file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white dark:text-white/70 dark:file:bg-sand dark:file:text-[#18201d]"
                      type="file"
                      name="documents"
                      multiple
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    />
                    <p className="mt-3 text-xs text-black/45 dark:text-white/45">
                      Supports PDF, DOCX, and TXT. Use pasted text below for email
                      clarifications or copied terms.
                    </p>
                  </div>
                </label>
              </section>

              <section className="grid gap-5 border-t border-black/8 pt-8 dark:border-white/8 lg:grid-cols-[minmax(0,1fr)_240px]">
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Paste agreement text or email clarifications
                  <textarea
                    className="min-h-44 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/12 dark:bg-white/[0.04]"
                    name="pastedText"
                    placeholder="Paste a plain-text agreement, deliverables brief, or email clarification here."
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Pasted text title
                  <input
                    className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/12 dark:bg-white/[0.04]"
                    name="pastedTextTitle"
                    placeholder="march-brand-email.txt"
                  />
                </label>
              </section>

              <section className="grid gap-5 border-t border-black/8 pt-8 dark:border-white/8">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-ink">Optional context</h2>
                  <p className="text-sm text-black/55 dark:text-white/60">
                    These help if you already know them, but the analysis screen
                    will keep filling them from the uploaded documents.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Brand name
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 text-base dark:border-white/12 dark:bg-white/[0.04]"
                      name="brandName"
                      placeholder="Glossier"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Campaign name
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 text-base dark:border-white/12 dark:bg-white/[0.04]"
                      name="campaignName"
                      placeholder="Spring recovery drop"
                    />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Notes
                  <textarea
                    className="min-h-28 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/12 dark:bg-white/[0.04]"
                    name="notes"
                    placeholder="Anything you already know about rate, deliverables, or open questions."
                  />
                </label>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/8 pt-8 dark:border-white/8">
                <p className="max-w-2xl text-sm leading-6 text-black/55 dark:text-white/60">
                  After upload, you’ll move straight into a live review screen
                  where extracted fields populate while analysis runs.
                </p>
                <SubmitButton
                  pendingLabel="Uploading..."
                  className="rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Upload and analyze
                </SubmitButton>
              </div>
            </div>
          </form>

          <aside className="xl:pt-8">
            <div className="rounded-2xl border border-black/6 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-lg font-semibold text-ink">What happens next</h2>
              <ol className="mt-4 space-y-4 text-sm leading-6 text-black/60 dark:text-white/65">
                <li>
                  <span className="font-medium text-ink">1.</span> HelloBrand
                  uploads the documents, opens your intake review screen, and
                  begins extraction immediately.
                </li>
                <li>
                  <span className="font-medium text-ink">2.</span> You review the
                  suggested brand, campaign, payment, and notes as they populate
                  from the source documents.
                </li>
                <li>
                  <span className="font-medium text-ink">3.</span> The confirmed
                  deal appears in your dashboard with risks, deliverables, and
                  draft emails.
                </li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
