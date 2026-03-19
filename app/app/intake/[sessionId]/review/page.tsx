import { redirect } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Suspense, type ReactNode } from "react";

import { ConflictWarnings } from "@/components/conflict-warnings";
import { IntakeGeneratedFieldsEditor } from "@/components/intake-generated-fields-editor";
import { SubmitButton } from "@/components/submit-button";
import { CreatorProfileSetupDialog } from "@/components/creator-profile-setup-dialog";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { WorkspaceCreationOverlay } from "@/components/workspace-creation-overlay";
import {
  confirmIntakeSessionAction,
  deleteIntakeDraftAction
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

function deriveHandleFromEmail(email: string | null | undefined) {
  const normalized = presentText(email);
  if (!normalized || !normalized.includes("@")) {
    return null;
  }

  return normalized.split("@")[0] ?? null;
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
    <section className=" border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
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

function intakeConflictMessagesByField(conflicts: Array<{ type: string; title: string }>) {
  const messages: Record<string, string[]> = {};

  function push(field: string, message: string) {
    messages[field] = [...(messages[field] ?? []), message];
  }

  for (const conflict of conflicts) {
    if (conflict.type === "category_conflict") {
      push("brandCategory", conflict.title);
      push("competitorCategories", conflict.title);
      continue;
    }

    if (conflict.type === "competitor_restriction") {
      push("restrictedCategories", conflict.title);
      push("competitorCategories", conflict.title);
      push("brandCategory", conflict.title);
      continue;
    }

    if (conflict.type === "exclusivity_overlap") {
      push("restrictedCategories", conflict.title);
      push("brandCategory", conflict.title);
      push("campaignDateWindow", conflict.title);
      continue;
    }

    if (conflict.type === "schedule_collision") {
      push("campaignDateWindow", conflict.title);
      push("timelineItems", conflict.title);
      push("deliverables", conflict.title);
    }
  }

  return messages;
}

export default function IntakeSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-primary" /></div>}>
      <IntakeReviewContent params={params} />
    </Suspense>
  );
}

async function IntakeReviewContent({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const viewer = await requireViewer();
  const { sessionId } = await params;
  let sessionData: Awaited<ReturnType<typeof getIntakeSessionForViewer>>;

  try {
    sessionData = await getIntakeSessionForViewer(viewer, sessionId);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Intake session not found."
    ) {
      redirect("/app");
    }

    throw error;
  }

  const { session, aggregate, profileDefaults } = sessionData;

  if (session.status === "completed" && aggregate) {
    redirect(`/app/deals/${aggregate.deal.id}`);
  }

  const showConfirmation =
    session.status === "ready_for_confirmation" || session.status === "failed";
  if (!showConfirmation) {
    redirect(`/app/intake/${session.id}`);
  }

  const analysisRunning = false;
  const normalized = buildNormalizedIntakeRecord(aggregate);
  const deliverables = normalized?.deliverables ?? [];
  const timelineItems = normalized?.timelineItems ?? [];
  const evidenceGroups = normalized?.evidenceGroups ?? [];
  const analyticsHighlights = normalized?.analytics?.highlights ?? [];
  const conflictResults = aggregate?.conflictResults ?? [];
  const conflictMessagesByField = intakeConflictMessagesByField(conflictResults);
  const riskFlags = aggregate?.riskFlags ?? [];
  const derivedHandle = deriveHandleFromEmail(profileDefaults?.contactEmail ?? viewer.email);
  const creatorDefault =
    presentText(profileDefaults?.creatorLegalName) ??
    presentText(profileDefaults?.displayName) ??
    presentText(viewer.displayName) ??
    derivedHandle ??
    "Creator";
  const businessDefault =
    presentText(profileDefaults?.businessName) ??
    presentText(profileDefaults?.creatorLegalName) ??
    presentText(profileDefaults?.displayName) ??
    presentText(viewer.displayName) ??
    derivedHandle ??
    "Creator";
  const contactDefault = presentText(profileDefaults?.contactEmail) ?? viewer.email;
  const profileConfigured = Boolean(
    presentText(profileDefaults?.creatorLegalName) ||
      presentText(profileDefaults?.businessName)
  );
  const initialProfileName =
    presentText(profileDefaults?.creatorLegalName) ??
    presentText(profileDefaults?.displayName) ??
    presentText(viewer.displayName) ??
    "";
  const initialProfileHandle =
    presentText(profileDefaults?.businessName) ?? derivedHandle ?? "";
  const inputClassName =
    "w-full rounded-2xl border border-black/10 bg-sand/40 px-4 py-3 text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/20 dark:border-white/12 dark:bg-white/[0.04]";
  const textareaClassName =
    "min-h-32 w-full rounded-[20px] border border-black/10 bg-sand/40 px-4 py-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/20 dark:border-white/12 dark:bg-white/[0.04]";

  const contactType =
    normalized?.primaryContact?.organizationType ??
    (normalized?.agencyName ? "agency" : "brand");
  const summaryCards = [
    {
      label: "Brand",
      value: normalized?.brandName ?? (analysisRunning ? "Analyzing..." : "Not found"),
      loading: analysisRunning && !normalized?.brandName
    },
    {
      label: "Primary contact",
      value:
        normalized?.primaryContact?.name ??
        normalized?.primaryContact?.email ??
        (analysisRunning ? "Analyzing..." : "Not found"),
      loading:
        analysisRunning &&
        !normalized?.primaryContact?.name &&
        !normalized?.primaryContact?.email
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-ink">
              Intake review
            </h1>
            <p className="text-[17px] leading-8 text-black/60 dark:text-white/65">
              Your extracted deal details are ready to review before the workspace goes live.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-black/65 dark:bg-white/10 dark:text-white/70">
              {humanizeToken(session.status)}
            </div>
            <form action={deleteIntakeDraftAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="redirectTo" value="/app" />
              <DeleteDraftButton
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60"
              >
                <Trash2 className="h-4 w-4" />
                Delete draft
              </DeleteDraftButton>
            </form>
          </div>
        </section>
        {session.errorMessage ? (
          <section className=" border border-clay/20 bg-clay/8 p-5 text-sm text-clay shadow-panel dark:border-clay/25">
            {session.errorMessage}
          </section>
        ) : null}
        {conflictResults.length > 0 ? (
          <ConflictWarnings
            conflicts={conflictResults}
            title="Potential conflicts before confirmation"
            description="Review the highlighted fields below before creating the workspace. You can edit any generated value and continue."
          />
        ) : null}
        {session.errorMessage ? (
          <details className=" border border-black/5 bg-black/[0.02] p-4 text-xs text-black/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60">
            <summary className="cursor-pointer font-medium text-black/70 dark:text-white/70">
              Debug details
            </summary>
            <div className="mt-3 space-y-1 font-mono">
              <div>sessionStatus: {session.status}</div>
              <div>dealId: {session.dealId}</div>
              <div>documents: {(aggregate?.documents ?? []).length}</div>
              {(aggregate?.documents ?? []).map((document) => (
                <div key={document.id}>
                  {document.fileName} | {document.processingStatus} | {document.errorMessage ?? "ok"}
                </div>
              ))}
              <div>normalizedDeliverables: {deliverables.length}</div>
              <div>normalizedTimelineItems: {timelineItems.length}</div>
              <div>normalizedEvidenceGroups: {evidenceGroups.length}</div>
              <div>normalizedAnalyticsHighlights: {analyticsHighlights.length}</div>
              <div>conflicts: {conflictResults.length}</div>
            </div>
          </details>
        ) : null}

        <section className=" border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
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
                <WorkspaceCreationOverlay />
                <input type="hidden" name="sessionId" value={session.id} />
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
                        pendingLabel:
                          "Checking whether an agency or management company appears...",
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
                        defaultValue={normalized?.primaryContact?.name ?? ""}
                        placeholder="Primary contact name"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                      {supportText({
                        analysisRunning,
                        hasValue: Boolean(normalized?.primaryContact?.name),
                        pendingLabel: "Scanning signatures and agreement party sections...",
                        emptyLabel: "Add the main external contact if it is not extracted."
                      })}
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                      Contact title
                      <input
                        className={inputClassName}
                        name="primaryContactTitle"
                        defaultValue={normalized?.primaryContact?.title ?? ""}
                        placeholder="Campaign manager, partnerships lead, agent..."
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                      {supportText({
                        analysisRunning,
                        hasValue: Boolean(normalized?.primaryContact?.title),
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
                        defaultValue={normalized?.primaryContact?.email ?? ""}
                        placeholder="name@company.com"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                      {supportText({
                        analysisRunning,
                        hasValue: Boolean(normalized?.primaryContact?.email),
                        pendingLabel: "Extracting contact emails...",
                        emptyLabel: "Optional."
                      })}
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75 md:col-span-2">
                      Contact phone
                      <input
                        className={inputClassName}
                        name="primaryContactPhone"
                        defaultValue={normalized?.primaryContact?.phone ?? ""}
                        placeholder="Phone number"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                      {supportText({
                        analysisRunning,
                        hasValue: Boolean(normalized?.primaryContact?.phone),
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
                        placeholder="A plain-English summary will appear here."
                      />
                      <span className="text-xs font-normal text-black/50 dark:text-white/50">
                        Edit this if the generated summary needs correction before the
                        workspace is created.
                      </span>
                    </label>

                    <div className="grid gap-5 md:grid-cols-[1.1fr_0.7fr_0.6fr]">
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
                          emptyLabel:
                            "Enter the best known total if extraction misses it."
                        })}
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                        Currency
                        <input
                          className={inputClassName}
                          name="currency"
                          defaultValue={normalized?.currency ?? aggregate?.terms?.currency ?? "USD"}
                          placeholder="USD"
                        />
                      </label>

                      <div className="rounded-2xl bg-sand/55 px-4 py-4 dark:bg-white/[0.04]">
                        <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                          Deliverable count
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-ink">
                          {normalized?.deliverableCount ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Deliverables and timeline"
                  description="All generated terms stay editable here, including category, restrictions, deliverables, timeline, and disclosure obligations."
                >
                  <IntakeGeneratedFieldsEditor
                    inputClassName={inputClassName}
                    textareaClassName={textareaClassName}
                    initialBrandCategory={normalized?.brandCategory ?? null}
                    initialCompetitorCategories={normalized?.competitorCategories ?? []}
                    initialRestrictedCategories={normalized?.restrictedCategories ?? []}
                    initialCampaignDateWindow={normalized?.campaignDateWindow ?? null}
                    initialDisclosureObligations={normalized?.disclosureObligations ?? []}
                    initialDeliverables={deliverables}
                    initialTimelineItems={timelineItems}
                    initialAnalytics={normalized?.analytics ?? null}
                    conflictMessagesByField={conflictMessagesByField}
                  />
                </SectionCard>

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
                        {evidenceGroups.length > 0 ? (
                          evidenceGroups.map((group) => (
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

                  </div>
                </SectionCard>

                <div className="sticky bottom-5 z-20 flex justify-end">
                  <div className="flex items-center gap-3 border border-black/8 bg-white/92 px-3 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#11161c]/92">
                    <span className="hidden text-sm text-black/55 dark:text-white/55 md:inline">
                      Review complete?
                    </span>
                    <SubmitButton
                      pendingLabel="Creating workspace..."
                      className="bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!showConfirmation}
                    >
                      Create deal workspace
                    </SubmitButton>
                  </div>
                </div>
              </form>
        </section>

        <section className=" border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Profile defaults</h2>
              <p className="mt-2 text-sm text-black/60 dark:text-white/65">
                These creator details backfill the intake when extracted values are still
                missing.
              </p>
            </div>

            {profileConfigured ? (
              <CreatorProfileSetupDialog
                configured={profileConfigured}
                email={contactDefault}
                initialName={initialProfileName}
                initialHandle={initialProfileHandle}
              />
            ) : null}
          </div>

          {profileConfigured ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-sand/55 p-4 dark:bg-white/[0.04]">
                <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                  Creator
                </div>
                <div className="mt-2 text-sm font-semibold text-ink">{creatorDefault}</div>
              </div>
              <div className="rounded-2xl bg-sand/55 p-4 dark:bg-white/[0.04]">
                <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                  Business
                </div>
                <div className="mt-2 text-sm font-semibold text-ink">{businessDefault}</div>
              </div>
              <div className="rounded-2xl bg-sand/55 p-4 dark:bg-white/[0.04]">
                <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                  Contact
                </div>
                <div className="mt-2 text-sm font-semibold text-ink">{contactDefault}</div>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex min-h-40 items-center justify-center rounded-2xl bg-sand/45 p-6 text-center dark:bg-white/[0.04]">
              <div className="flex max-w-md flex-col items-center gap-3">
                <p className="text-sm text-black/60 dark:text-white/65">
                  Set up your creator profile so future intakes can start with your
                  name, handle, and contact defaults.
                </p>
                <CreatorProfileSetupDialog
                  configured={profileConfigured}
                  email={contactDefault}
                  initialName={initialProfileName}
                  initialHandle={initialProfileHandle}
                />
              </div>
            </div>
          )}
        </section>

        <section className=" border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <h2 className="text-xl font-semibold text-ink">Risk watchouts</h2>
              <div className="mt-4 grid gap-3">
                {riskFlags.slice(0, 4).map((flag) => (
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
                {riskFlags.length === 0 ? (
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
