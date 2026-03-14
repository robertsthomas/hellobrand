import Link from "next/link";
import { redirect } from "next/navigation";
import { LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { IntakeAutoRefresh } from "@/components/intake-auto-refresh";
import { IntakePendingUpload } from "@/components/intake-pending-upload";
import { SubmitButton } from "@/components/submit-button";
import {
  confirmIntakeSessionAction,
  deleteIntakeDraftAction,
  retryIntakeSessionAction
} from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { getIntakeSessionForViewer } from "@/lib/intake";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { formatCurrency, humanizeToken } from "@/lib/utils";

function presentText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function supportText({
  analysisRunning,
  hasValue,
  emptyLabel,
  pendingLabel
}: {
  analysisRunning: boolean;
  hasValue: boolean;
  emptyLabel: string;
  pendingLabel: string;
}) {
  if (analysisRunning && !hasValue) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-normal text-black/50 dark:text-white/50">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        {pendingLabel}
      </span>
    );
  }

  return (
    <span className="text-xs font-normal text-black/50 dark:text-white/50">
      {emptyLabel}
    </span>
  );
}

function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="text-sm text-black/60 dark:text-white/65">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  loading
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-sand/55 px-4 py-4 dark:bg-white/[0.04]">
      <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-ink">
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-ocean" /> : null}
        <span>{value}</span>
      </div>
    </div>
  );
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

  const analysisRunning = ["uploading", "processing"].includes(session.status);
  const showConfirmation =
    session.status === "ready_for_confirmation" || session.status === "failed";
  const normalized = buildNormalizedIntakeRecord(aggregate);
  const documents = aggregate?.documents ?? [];
  const inputClassName =
    "w-full rounded-2xl border border-black/10 bg-sand/40 px-4 py-3 text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/20 dark:border-white/12 dark:bg-white/[0.04]";
  const textareaClassName =
    "min-h-32 w-full rounded-[20px] border border-black/10 bg-sand/40 px-4 py-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/20 dark:border-white/12 dark:bg-white/[0.04]";

  const contactType =
    normalized?.primaryContact.organizationType ?? (normalized?.agencyName ? "agency" : "brand");
  const summaryCards = [
    {
      label: "Brand",
      value: normalized?.brandName ?? (analysisRunning ? "Analyzing..." : "Not found"),
      loading: analysisRunning && !normalized?.brandName
    },
    {
      label: "Primary contact",
      value:
        normalized?.primaryContact.name ??
        normalized?.primaryContact.email ??
        (analysisRunning ? "Analyzing..." : "Not found"),
      loading:
        analysisRunning &&
        !normalized?.primaryContact.name &&
        !normalized?.primaryContact.email
    },
    {
      label: "Payment",
      value:
        typeof normalized?.paymentAmount === "number"
          ? formatCurrency(normalized.paymentAmount, normalized.currency ?? "USD")
          : analysisRunning
            ? "Analyzing..."
            : "Not specified",
      loading: analysisRunning && typeof normalized?.paymentAmount !== "number"
    },
    {
      label: "Deliverables",
      value: String(normalized?.deliverableCount ?? 0),
      loading: analysisRunning && !normalized?.deliverableCount
    }
  ];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-ink">
              Intake review
            </h1>
            <p className="text-[17px] leading-8 text-black/60 dark:text-white/65">
              HelloBrand is organizing your upload into one structured intake so you
              can confirm the deal cleanly before opening the workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-black/65 dark:bg-white/10 dark:text-white/70">
              {humanizeToken(session.status)}
            </div>
            <form action={deleteIntakeDraftAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="redirectTo" value="/app" />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60"
              >
                <Trash2 className="h-4 w-4" />
                Delete draft
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-[26px] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-ink">Analysis status</h2>
              <p className="text-sm text-black/60 dark:text-white/65">
                Uploaded files are evaluated one by one, and the intake below fills in
                as fields become available.
              </p>
              <div className="space-y-1">
                <IntakePendingUpload sessionId={session.id} status={session.status} />
                <IntakeAutoRefresh status={session.status} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {analysisRunning ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-ocean/8 px-3 py-2 text-sm font-medium text-ocean">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Evaluating documents
                </div>
              ) : null}
              <Link
                href={`/app/intake/${session.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-black/20 dark:border-white/12 dark:text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {documents.length > 0 ? (
              documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl bg-sand/55 px-4 py-4 dark:bg-white/[0.04]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{document.fileName}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
                        <span>{humanizeToken(document.documentKind)}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1.5">
                          {["pending", "processing"].includes(document.processingStatus) ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {humanizeToken(document.processingStatus)}
                        </span>
                      </div>
                    </div>
                    {document.errorMessage ? (
                      <div className="max-w-sm text-right text-xs text-clay">
                        {document.errorMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-sand/55 px-4 py-4 text-sm text-black/60 dark:bg-white/[0.04] dark:text-white/65">
                Waiting for uploaded source material to appear in this intake session.
              </div>
            )}
          </div>

          {session.errorMessage ? (
            <div className="mt-4 rounded-2xl border border-clay/20 bg-clay/8 px-4 py-3 text-sm text-clay">
              {session.errorMessage}
            </div>
          ) : null}

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
        </section>

        <section className="rounded-[26px] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-ink">Confirm this deal</h2>
            <p className="text-sm text-black/60 dark:text-white/65">
              The intake always stays in the same order. Missing details can stay
              empty until you fill them in manually.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                loading={card.loading}
              />
            ))}
          </div>

          <form action={confirmIntakeSessionAction} className="mt-6 space-y-6">
            <input type="hidden" name="sessionId" value={session.id} />
            <input
              type="hidden"
              name="deliverablesJson"
              value={JSON.stringify(normalized?.deliverables ?? [])}
            />
            <input
              type="hidden"
              name="timelineItemsJson"
              value={JSON.stringify(normalized?.timelineItems ?? [])}
            />
            <input
              type="hidden"
              name="analyticsJson"
              value={JSON.stringify(normalized?.analytics ?? null)}
            />

            <SectionCard
              title="Partnership"
              description="Confirm who the deal is for and whether an agency is involved."
            >
              <div className="grid gap-5">
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Brand name
                  <input
                    className={inputClassName}
                    name="brandName"
                    defaultValue={normalized?.brandName ?? ""}
                    placeholder="Brand name"
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                    required
                  />
                  {supportText({
                    analysisRunning,
                    hasValue: Boolean(normalized?.brandName),
                    pendingLabel: "Looking for the brand in the uploaded sources...",
                    emptyLabel: "Leave empty only if the brand is still unclear."
                  })}
                </label>

                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Agency name
                  <input
                    className={inputClassName}
                    name="agencyName"
                    defaultValue={normalized?.agencyName ?? ""}
                    placeholder="Agency or management company"
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                  />
                  {supportText({
                    analysisRunning,
                    hasValue: Boolean(normalized?.agencyName),
                    pendingLabel: "Checking whether an agency or management company appears...",
                    emptyLabel: "Optional. Leave blank if this is a direct brand deal."
                  })}
                </label>
              </div>
            </SectionCard>

            <SectionCard
              title="Primary contact"
              description="Keep one main external point of contact for this intake."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Contact type
                  <select
                    className={inputClassName}
                    name="primaryContactOrganizationType"
                    defaultValue={contactType}
                    disabled={analysisRunning}
                  >
                    <option value="brand">Brand contact</option>
                    <option value="agency">Agency contact</option>
                  </select>
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    Use the agency when a management company or intermediary is driving
                    the deal.
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Contact name
                  <input
                    className={inputClassName}
                    name="primaryContactName"
                    defaultValue={normalized?.primaryContact.name ?? ""}
                    placeholder="Primary contact name"
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                  />
                  {supportText({
                    analysisRunning,
                    hasValue: Boolean(normalized?.primaryContact.name),
                    pendingLabel: "Scanning signatures and agreement party sections...",
                    emptyLabel: "Add the main external contact if it is not extracted."
                  })}
                </label>

                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Contact title
                  <input
                    className={inputClassName}
                    name="primaryContactTitle"
                    defaultValue={normalized?.primaryContact.title ?? ""}
                    placeholder="Campaign manager, partnerships lead, agent..."
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                  />
                  {supportText({
                    analysisRunning,
                    hasValue: Boolean(normalized?.primaryContact.title),
                    pendingLabel: "Looking for job titles in the source material...",
                    emptyLabel: "Optional."
                  })}
                </label>

                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Contact email
                  <input
                    className={inputClassName}
                    name="primaryContactEmail"
                    type="email"
                    defaultValue={normalized?.primaryContact.email ?? ""}
                    placeholder="name@company.com"
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                  />
                  {supportText({
                    analysisRunning,
                    hasValue: Boolean(normalized?.primaryContact.email),
                    pendingLabel: "Extracting contact emails...",
                    emptyLabel: "Optional."
                  })}
                </label>

                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75 md:col-span-2">
                  Contact phone
                  <input
                    className={inputClassName}
                    name="primaryContactPhone"
                    defaultValue={normalized?.primaryContact.phone ?? ""}
                    placeholder="Phone number"
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                  />
                  {supportText({
                    analysisRunning,
                    hasValue: Boolean(normalized?.primaryContact.phone),
                    pendingLabel: "Checking for phone numbers...",
                    emptyLabel: "Optional."
                  })}
                </label>
              </div>
            </SectionCard>

            <SectionCard
              title="Contract snapshot"
              description="This should feel like a clean, reusable summary of the deal before the workspace opens."
            >
              <div className="grid gap-5">
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Contract title
                  <input
                    className={inputClassName}
                    name="contractTitle"
                    defaultValue={normalized?.contractTitle ?? ""}
                    placeholder="Deal or contract title"
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                    required
                  />
                  {supportText({
                    analysisRunning,
                    hasValue: Boolean(normalized?.contractTitle),
                    pendingLabel: "Generating a clean title from the source files...",
                    emptyLabel: "Use a creator-friendly title for the deal."
                  })}
                </label>

                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  AI contract summary
                  <textarea
                    className={textareaClassName}
                    name="contractSummary"
                    defaultValue={normalized?.contractSummary ?? ""}
                    readOnly
                    aria-readonly="true"
                    placeholder="A plain-English summary will appear here."
                  />
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    This summary stays read-only in intake. Use notes for corrections or
                    missing context.
                  </span>
                </label>

                <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Primary payment amount
                    <input
                      className={inputClassName}
                      name="paymentAmount"
                      type="number"
                      step="0.01"
                      defaultValue={normalized?.paymentAmount ?? ""}
                      placeholder="Payment amount"
                      readOnly={analysisRunning}
                      aria-disabled={analysisRunning}
                    />
                    {supportText({
                      analysisRunning,
                      hasValue: typeof normalized?.paymentAmount === "number",
                      pendingLabel: "Reviewing compensation language...",
                      emptyLabel: "Enter the best known total if extraction misses it."
                    })}
                  </label>

                  <div className="rounded-2xl bg-sand/55 px-4 py-4 dark:bg-white/[0.04]">
                    <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                      Deliverable count
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-ink">
                      {analysisRunning && !normalized?.deliverableCount ? (
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin text-ocean" />
                          Analyzing...
                        </span>
                      ) : (
                        normalized?.deliverableCount ?? 0
                      )}
                    </div>
                    <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                      Based on the extracted deliverables list so far.
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Deliverables and timeline"
              description="HelloBrand separates deliverables from milestone dates so the deal always reads consistently."
            >
              <div className="grid gap-5">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-black/70 dark:text-white/75">
                    Deliverables
                  </div>
                  {normalized?.deliverables.length ? (
                    normalized.deliverables.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-black/5 bg-sand/45 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-ink">{item.title}</div>
                            <div className="mt-1 text-xs text-black/50 dark:text-white/50">
                              {[
                                item.channel,
                                item.quantity ? `${item.quantity} deliverable${item.quantity === 1 ? "" : "s"}` : null,
                                item.dueDate ? `Due ${item.dueDate}` : null
                              ]
                                .filter(Boolean)
                                .join(" • ") || "No extra deliverable details extracted yet."}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-sand/35 px-4 py-4 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
                      {analysisRunning
                        ? "Looking for deliverables in the contract, brief, and pasted text..."
                        : "No deliverables extracted yet. Add missing scope details in notes before confirming."}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-black/70 dark:text-white/75">
                    Timeline
                  </div>
                  {normalized?.timelineItems.length ? (
                    <div className="grid gap-3">
                      {normalized.timelineItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-black/5 bg-sand/45 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]"
                        >
                          <div className="text-sm font-semibold text-ink">{item.label}</div>
                          <div className="mt-1 text-sm text-black/65 dark:text-white/65">
                            {item.date ?? "Date not specified"}
                          </div>
                          {presentText(item.source) ? (
                            <div className="mt-2 text-xs text-black/50 dark:text-white/50">
                              Source: {item.source}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-sand/35 px-4 py-4 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
                      {analysisRunning
                        ? "Looking for outline, draft, final, and go-live timing..."
                        : "No milestone dates extracted yet. Use notes to capture any draft, review, or live-date requirements."}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {normalized?.analytics ? (
              <SectionCard
                title="Audience and analytics"
                description="Analytics stay optional and only appear when source material includes them."
              >
                <div className="grid gap-3">
                  {normalized.analytics.highlights.map((line, index) => (
                    <div
                      key={`${line}-${index}`}
                      className="rounded-2xl border border-black/5 bg-sand/45 px-4 py-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard
              title="Notes and confirmation"
              description="Use notes for anything the AI missed, open questions, negotiated changes, or manual corrections."
            >
              <div className="grid gap-5">
                <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                  Notes
                  <textarea
                    className={textareaClassName}
                    name="notes"
                    defaultValue={normalized?.notes ?? ""}
                    placeholder="Capture missing details, negotiation notes, or manual corrections."
                    readOnly={analysisRunning}
                    aria-disabled={analysisRunning}
                  />
                  <span className="text-xs font-normal text-black/50 dark:text-white/50">
                    This stays editable and will carry into the deal workspace after
                    confirmation.
                  </span>
                </label>

                <details className="rounded-2xl border border-black/5 bg-sand/35 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
                    Source evidence
                  </summary>
                  <div className="mt-4 grid gap-4">
                    {normalized?.evidenceGroups.length ? (
                      normalized.evidenceGroups.map((group) => (
                        <div
                          key={group.id}
                          className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-white/[0.03]"
                        >
                          <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                            {group.title}
                          </div>
                          <div className="mt-3 grid gap-2">
                            {group.snippets.map((snippet, index) => (
                              <div
                                key={`${group.id}-${index}`}
                                className="text-sm text-black/70 dark:text-white/70"
                              >
                                {snippet}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-black/60 dark:text-white/65">
                        {analysisRunning
                          ? "Source snippets will appear here as extraction completes."
                          : "No source evidence has been organized yet."}
                      </div>
                    )}
                  </div>
                </details>

                <SubmitButton
                  pendingLabel="Creating workspace..."
                  className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!showConfirmation}
                >
                  Create deal workspace
                </SubmitButton>
              </div>
            </SectionCard>
          </form>
        </section>

        <section className="rounded-[26px] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <h2 className="text-xl font-semibold text-ink">Profile defaults</h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/65">
            These creator details backfill the intake when extracted values are still
            missing.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-sand/55 p-4 dark:bg-white/[0.04]">
              <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                Creator
              </div>
              <div className="mt-2 text-sm font-semibold text-ink">
                {profileDefaults?.creatorLegalName ??
                  profileDefaults?.displayName ??
                  viewer.displayName}
              </div>
            </div>
            <div className="rounded-2xl bg-sand/55 p-4 dark:bg-white/[0.04]">
              <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                Business
              </div>
              <div className="mt-2 text-sm font-semibold text-ink">
                {profileDefaults?.businessName ?? "Not set"}
              </div>
            </div>
            <div className="rounded-2xl bg-sand/55 p-4 dark:bg-white/[0.04]">
              <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                Contact
              </div>
              <div className="mt-2 text-sm font-semibold text-ink">
                {profileDefaults?.contactEmail ?? viewer.email}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <h2 className="text-xl font-semibold text-ink">Risk watchouts</h2>
          <div className="mt-4 grid gap-3">
            {(aggregate?.riskFlags ?? []).slice(0, 4).map((flag) => (
              <div
                key={flag.id}
                className="rounded-2xl bg-sand/55 p-4 dark:bg-white/[0.04]"
              >
                <div className="text-sm font-semibold text-ink">{flag.title}</div>
                <p className="mt-2 text-sm text-black/60 dark:text-white/65">
                  {flag.detail}
                </p>
              </div>
            ))}
            {aggregate?.riskFlags.length === 0 ? (
              <div className="rounded-2xl bg-sand/55 p-4 text-sm text-black/60 dark:bg-white/[0.04] dark:text-white/65">
                {analysisRunning
                  ? "Still evaluating creator risk as the extraction completes."
                  : "No watchouts have been extracted yet."}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
