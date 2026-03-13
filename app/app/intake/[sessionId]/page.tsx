import Link from "next/link";
import { redirect } from "next/navigation";

import { IntakeAutoRefresh } from "@/components/intake-auto-refresh";
import { SubmitButton } from "@/components/submit-button";
import {
  confirmIntakeSessionAction,
  retryIntakeSessionAction
} from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { getIntakeSessionForViewer } from "@/lib/intake";
import { formatCurrency, humanizeToken } from "@/lib/utils";

function evidenceForField(
  fieldPath: string,
  entries: Array<{
    fieldPath: string;
    snippet: string;
  }>
) {
  return entries.find((entry) => entry.fieldPath === fieldPath) ?? null;
}

export const dynamic = "force-dynamic";

export default async function IntakeSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const viewer = await requireViewer();
  const { sessionId } = await params;
  const { session, aggregate, profileDefaults } = await getIntakeSessionForViewer(
    viewer,
    sessionId
  );

  if (session.status === "completed" && aggregate) {
    redirect(`/app/deals/${aggregate.deal.id}`);
  }

  const terms = aggregate?.terms;
  const paymentAmount = terms?.paymentAmount ?? aggregate?.paymentRecord?.amount ?? null;
  const evidence = aggregate?.extractionEvidence.slice(0, 6) ?? [];
  const brandEvidence = evidenceForField("brandName", aggregate?.extractionEvidence ?? []);
  const campaignEvidence = evidenceForField(
    "campaignName",
    aggregate?.extractionEvidence ?? []
  );
  const agencyEvidence = evidenceForField("agencyName", aggregate?.extractionEvidence ?? []);
  const paymentEvidence = evidenceForField(
    "paymentAmount",
    aggregate?.extractionEvidence ?? []
  );
  const noteSeed = [
    terms?.notes?.trim() || null,
    aggregate?.currentSummary?.body?.trim() || null
  ].find(Boolean);
  const showConfirmation =
    session.status === "ready_for_confirmation" || session.status === "failed";
  const analysisRunning = ["uploading", "processing"].includes(session.status);
  const fieldLocked = analysisRunning;
  const fieldClassName =
    "rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]";

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold text-ink">Intake review</h1>
            <p className="mt-4 text-black/60 dark:text-white/65">
              HelloBrand is analyzing your upload first, then converting the
              extracted fields into a confirmed deal workspace.
            </p>
          </div>
          <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-black/65 dark:bg-white/10 dark:text-white/70">
            {humanizeToken(session.status)}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-ink">Processing state</h2>
                  <p className="mt-2 text-sm text-black/60 dark:text-white/65">
                    Status updates are based on your uploaded documents.
                  </p>
                  <div className="mt-2">
                    <IntakeAutoRefresh status={session.status} />
                  </div>
                </div>
                <Link
                  href={`/app/intake/${session.id}`}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink dark:border-white/12 dark:text-white"
                >
                  Refresh
                </Link>
              </div>

              <div className="mt-6 grid gap-3">
                {(aggregate?.documents ?? []).map((document) => (
                  <div
                    key={document.id}
                    className="rounded-[1.25rem] bg-sand/50 px-4 py-4 dark:bg-white/[0.04]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ink">
                          {document.fileName}
                        </div>
                        <div className="mt-1 text-xs text-black/50 dark:text-white/50">
                          {humanizeToken(document.documentKind)} •{" "}
                          {humanizeToken(document.processingStatus)}
                        </div>
                      </div>
                      {document.errorMessage ? (
                        <div className="max-w-sm text-right text-xs text-clay">
                          {document.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {session.status === "failed" ? (
                <form action={retryIntakeSessionAction} className="mt-5">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <SubmitButton
                    pendingLabel="Retrying analysis..."
                    className="rounded-full bg-clay px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Retry analysis
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            <div className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <h2 className="text-2xl font-semibold text-ink">Extracted preview</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                    Brand
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink">
                    {terms?.brandName ?? aggregate?.deal.brandName ?? "Not found yet"}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                    Campaign
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink">
                    {terms?.campaignName ?? aggregate?.deal.campaignName ?? "Not found yet"}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                    Payment
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink">
                    {formatCurrency(paymentAmount, terms?.currency ?? "USD")}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                    Deliverables
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink">
                    {terms?.deliverables.length ?? 0}
                  </div>
                </div>
              </div>

              {aggregate?.currentSummary ? (
                <div className="mt-5 rounded-[1.25rem] bg-[#f6f0eb] p-4 text-sm text-black/70 dark:bg-white/[0.04] dark:text-white/70">
                  {aggregate.currentSummary.body}
                </div>
              ) : null}

              {evidence.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  {evidence.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[1.25rem] border border-black/5 px-4 py-3 text-sm dark:border-white/10"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                        {entry.fieldPath}
                      </div>
                      <p className="mt-2 text-black/70 dark:text-white/70">
                        {entry.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <h2 className="text-2xl font-semibold text-ink">Confirm this deal</h2>
              <p className="mt-2 text-sm text-black/60 dark:text-white/65">
                {analysisRunning
                  ? "Fields below update automatically while analysis runs. Editing unlocks once HelloBrand has enough data to confirm."
                  : showConfirmation
                    ? "Review the extracted values, make corrections, and create the live deal workspace."
                    : "Confirmation unlocks when all uploaded documents are ready. If a document fails, you can still correct the fields manually and continue."}
              </p>

              <form action={confirmIntakeSessionAction} className="mt-6 grid gap-4">
                <input type="hidden" name="sessionId" value={session.id} />
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Brand name
                  <input
                    className={fieldClassName}
                    name="brandName"
                    defaultValue={terms?.brandName ?? aggregate?.deal.brandName ?? ""}
                    placeholder="Analyzing brand details..."
                    readOnly={fieldLocked}
                    aria-disabled={fieldLocked}
                    required
                  />
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    {brandEvidence
                      ? `Source: ${brandEvidence.snippet}`
                      : "No direct source line found yet."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Campaign name
                  <input
                    className={fieldClassName}
                    name="campaignName"
                    defaultValue={terms?.campaignName ?? aggregate?.deal.campaignName ?? ""}
                    placeholder="Analyzing campaign details..."
                    readOnly={fieldLocked}
                    aria-disabled={fieldLocked}
                    required
                  />
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    {campaignEvidence
                      ? `Source: ${campaignEvidence.snippet}`
                      : "No direct source line found yet."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Agency name
                  <input
                    className={fieldClassName}
                    name="agencyName"
                    defaultValue={terms?.agencyName ?? ""}
                    placeholder="Analyzing agency details..."
                    readOnly={fieldLocked}
                    aria-disabled={fieldLocked}
                  />
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    {agencyEvidence
                      ? `Source: ${agencyEvidence.snippet}`
                      : "Optional. Leave blank if no agency is involved."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Primary payment amount
                  <input
                    className={fieldClassName}
                    name="paymentAmount"
                    type="number"
                    step="0.01"
                    defaultValue={paymentAmount ?? ""}
                    placeholder="Analyzing payment..."
                    readOnly={fieldLocked}
                    aria-disabled={fieldLocked}
                  />
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    {paymentEvidence
                      ? `Source: ${paymentEvidence.snippet}`
                      : "If payment was not extracted cleanly, enter it manually."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Notes
                  <textarea
                    className="min-h-28 rounded-[1.5rem] border border-black/10 bg-sand/40 px-4 py-4 dark:border-white/12 dark:bg-white/[0.04]"
                    name="notes"
                    defaultValue={noteSeed ?? ""}
                    placeholder="Notes will stay editable after analysis finishes."
                    readOnly={fieldLocked}
                    aria-disabled={fieldLocked}
                  />
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    Carry forward anything you already know about open questions,
                    negotiated changes, or missing context.
                  </span>
                </label>
                {analysisRunning ? (
                  <div className="rounded-[1.25rem] border border-black/5 bg-sand/40 px-4 py-3 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
                    Analysis is still running. This screen auto-refreshes and the
                    extracted fields above will populate as each document step completes.
                  </div>
                ) : null}
                <SubmitButton
                  pendingLabel="Creating workspace..."
                  className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!showConfirmation}
                >
                  Create deal workspace
                </SubmitButton>
              </form>
            </div>

            <div className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <h2 className="text-2xl font-semibold text-ink">Profile defaults</h2>
              <p className="mt-2 text-sm text-black/60 dark:text-white/65">
                These creator details are available to downstream drafts and
                intake confirmations when extracted values are missing.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
                  <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                    Creator
                  </div>
                  <div className="mt-2 text-sm font-semibold text-ink">
                    {profileDefaults?.creatorLegalName ??
                      profileDefaults?.displayName ??
                      viewer.displayName}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
                  <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                    Business
                  </div>
                  <div className="mt-2 text-sm font-semibold text-ink">
                    {profileDefaults?.businessName ?? "Not set"}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
                  <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                    Contact
                  </div>
                  <div className="mt-2 text-sm font-semibold text-ink">
                    {profileDefaults?.contactEmail ?? viewer.email}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <h2 className="text-2xl font-semibold text-ink">Risk watchouts</h2>
              <div className="mt-4 grid gap-3">
                {(aggregate?.riskFlags ?? []).slice(0, 4).map((flag) => (
                  <div
                    key={flag.id}
                    className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]"
                  >
                    <div className="text-sm font-semibold text-ink">{flag.title}</div>
                    <p className="mt-2 text-sm text-black/60 dark:text-white/65">
                      {flag.detail}
                    </p>
                  </div>
                ))}
                {aggregate?.riskFlags.length === 0 ? (
                  <div className="rounded-[1.25rem] bg-sand/50 p-4 text-sm text-black/60 dark:bg-white/[0.04] dark:text-white/65">
                    No watchouts have been extracted yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
