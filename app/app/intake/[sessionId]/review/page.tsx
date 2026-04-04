import { redirect } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import { Suspense } from "react";

import { FormInput, FormSelect, FormTextarea } from "@/components/generic/form";
import { IntakeFieldGuideDialog } from "@/components/intake-field-guide-dialog";
import { IntakeGeneratedFieldsEditor } from "@/components/intake-generated-fields-editor";
import {
  IntakeField,
  IntakeHelperSpacer,
  IntakeHelperText,
  IntakeInlineEvidence,
  IntakeSectionCard,
} from "@/components/intake";
import { IntakeSummaryCards } from "@/components/patterns/intake";
import { IntakeReviewLiveStatus } from "@/components/intake-review-live-status";
import { PostHogSubmitButton } from "@/components/posthog-submit-button";
import { CreatorProfileSetupDialog } from "@/components/creator-profile-setup-dialog";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { WorkspaceCreationOverlay } from "@/components/workspace-creation-overlay";
import {
  confirmIntakeSessionAction,
  deleteIntakeDraftAction
} from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { CURRENCY_OPTIONS } from "@/lib/deal-terms-constants";
import { cleanDisplayText } from "@/lib/display-text";
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

function dedupeAttentionIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export default function IntakeSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-primary" /></div>}>
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

  const { session, aggregate, processing, profileDefaults } = sessionData;

  if (session.status === "completed" && aggregate) {
    redirect(`/app/p/${aggregate.deal.id}`);
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
  const contactType =
    normalized?.primaryContact?.organizationType ??
    (normalized?.agencyName ? "agency" : "brand");
  const displayLabels = getDisplayDealLabels({
    brandName: normalized?.brandName,
    campaignName: normalized?.contractTitle
  });
  const summaryCards = [
    {
      label: "Brand",
      value: displayLabels.brandName ?? (analysisRunning ? "Analyzing..." : "Not detected yet"),
      loading: analysisRunning && !normalized?.brandName
    },
    {
      label: "Primary contact",
      value:
        cleanDisplayText(normalized?.primaryContact?.name) ??
        cleanDisplayText(normalized?.primaryContact?.email) ??
        (analysisRunning ? "Analyzing..." : "Not detected yet"),
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

  const attentionItems = dedupeAttentionIds([
    ...conflictResults.map((conflict) => ({
      id: `conflict-${conflict.type}-${conflict.title}`
    })),
    ...riskFlags.slice(0, 4).map((flag) => ({
      id: `${flag.title.trim().toLowerCase()}::${(flag.detail ?? "").trim().toLowerCase()}`
    }))
  ].map((item) => item.id));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Confirm workspace
              </h1>
              <IntakeFieldGuideDialog />
            </div>
            <p className="text-[15px] leading-7 text-black/60 dark:text-white/65 sm:text-[17px] sm:leading-8">
              Review the extracted details, fix anything that looks off, then create the workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-black/5 px-4 py-2 text-sm font-semibold text-black/65 dark:bg-white/10 dark:text-white/70">
              {humanizeToken(session.status)}
            </div>
            <form action={deleteIntakeDraftAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="redirectTo" value="/app" />
              <DeleteDraftButton
                className="inline-flex items-center gap-2 border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60"
              >
                <Trash2 className="h-4 w-4" />
                Delete draft
              </DeleteDraftButton>
            </form>
          </div>
        </section>

        {session.errorMessage ? (
          <section className="border border-clay/20 bg-clay/8 p-5 text-sm text-clay shadow-panel dark:border-clay/25">
            {session.errorMessage}
          </section>
        ) : null}

        <IntakeReviewLiveStatus
          sessionId={session.id}
          initialStatus={session.status}
          initialProcessing={processing}
          conflictResults={conflictResults}
          initialRiskFlags={riskFlags}
        />

        {session.errorMessage ? (
          <details className="border border-black/5 bg-black/[0.02] p-4 text-xs text-black/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60">
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

        {/* Summary cards */}
        <IntakeSummaryCards cards={summaryCards} />

        {/* Main form */}
        <section className="space-y-6">
              <form action={confirmIntakeSessionAction} className="space-y-6">
                <WorkspaceCreationOverlay />
                <input type="hidden" name="sessionId" value={session.id} />
                <IntakeSectionCard
                  title="Partnership"
                  description="Confirm who the partnership is for and whether an agency is involved."
                >
                  <div className="grid gap-5">
                    <IntakeField
                      label="Brand name"
                      footer={
                        <IntakeHelperText
                          analysisRunning={analysisRunning}
                          hasValue={Boolean(normalized?.brandName)}
                          pendingLabel="Looking for the brand in the uploaded sources..."
                          emptyLabel="Leave empty only if the brand is still unclear."
                        />
                      }
                    >
                      <FormInput
                        name="brandName"
                        defaultValue={normalized?.brandName ?? ""}
                        placeholder="Brand name"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                        required
                      />
                    </IntakeField>

                    <IntakeField
                      label="Agency name"
                      footer={
                        <IntakeHelperText
                          analysisRunning={analysisRunning}
                          hasValue={Boolean(normalized?.agencyName)}
                          pendingLabel="Checking whether an agency or management company appears..."
                          emptyLabel="Optional. Leave blank if this is a direct brand partnership."
                        />
                      }
                    >
                      <FormInput
                        name="agencyName"
                        defaultValue={normalized?.agencyName ?? ""}
                        placeholder="Agency or management company"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                    </IntakeField>
                  </div>
                  <IntakeInlineEvidence groups={evidenceGroups} ids={["partnership"]} />
                </IntakeSectionCard>

                <IntakeSectionCard
                  title="Primary contact"
                  description="Keep one main external point of contact for this partnership."
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <IntakeField
                      label="Contact type"
                      footer={
                        <span className="text-xs font-normal text-black/50 dark:text-white/50">
                          Use the agency when a management company or intermediary is driving
                          the partnership.
                        </span>
                      }
                    >
                      <FormSelect
                        name="primaryContactOrganizationType"
                        defaultValue={contactType}
                        disabled={analysisRunning}
                      >
                        <option value="brand">Brand contact</option>
                        <option value="agency">Agency contact</option>
                      </FormSelect>
                    </IntakeField>

                    <IntakeField
                      label="Contact name"
                      footer={
                        <IntakeHelperText
                          analysisRunning={analysisRunning}
                          hasValue={Boolean(normalized?.primaryContact?.name)}
                          pendingLabel="Scanning signatures and agreement party sections..."
                          emptyLabel="Add the main external contact if it is not extracted."
                        />
                      }
                    >
                      <FormInput
                        fixedHeight
                        name="primaryContactName"
                        defaultValue={normalized?.primaryContact?.name ?? ""}
                        placeholder="Primary contact name"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                    </IntakeField>

                    <IntakeField label="Contact title" footer={<IntakeHelperSpacer />}>
                      <FormInput
                        fixedHeight
                        name="primaryContactTitle"
                        defaultValue={normalized?.primaryContact?.title ?? ""}
                        placeholder="Campaign manager, partnerships lead, agent..."
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                    </IntakeField>

                    <IntakeField label="Contact email" footer={<IntakeHelperSpacer />}>
                      <FormInput
                        fixedHeight
                        name="primaryContactEmail"
                        type="email"
                        defaultValue={normalized?.primaryContact?.email ?? ""}
                        placeholder="name@company.com"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                    </IntakeField>

                    <IntakeField label="Contact phone" className="md:col-span-2">
                      <FormInput
                        fixedHeight
                        name="primaryContactPhone"
                        defaultValue={normalized?.primaryContact?.phone ?? ""}
                        placeholder="Phone number"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                      />
                    </IntakeField>
                  </div>
                  <IntakeInlineEvidence groups={evidenceGroups} ids={["primary-contact"]} />
                </IntakeSectionCard>

                <IntakeSectionCard
                  title="Contract snapshot"
                  description="The key details for this partnership before the workspace opens."
                >
                  <div className="grid gap-5">
                    <IntakeField
                      label="Contract title"
                      footer={
                        <IntakeHelperText
                          analysisRunning={analysisRunning}
                          hasValue={Boolean(normalized?.contractTitle)}
                          pendingLabel="Generating a clean title from the source files..."
                          emptyLabel="Use a creator-friendly title for the partnership."
                        />
                      }
                    >
                      <FormInput
                        name="contractTitle"
                        defaultValue={normalized?.contractTitle ?? ""}
                        placeholder="Partnership or contract title"
                        readOnly={analysisRunning}
                        aria-disabled={analysisRunning}
                        required
                      />
                    </IntakeField>

                    <div className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,0.58fr)] md:items-start">
                      <IntakeField
                        label="Primary payment amount"
                        className="content-start"
                        footer={
                          <IntakeHelperText
                            analysisRunning={analysisRunning}
                            hasValue={typeof normalized?.paymentAmount === "number"}
                            pendingLabel="Reviewing compensation language..."
                            emptyLabel="Enter the best known total if extraction misses it."
                          />
                        }
                      >
                        <FormInput
                          name="paymentAmount"
                          type="number"
                          step="0.01"
                          defaultValue={normalized?.paymentAmount ?? ""}
                          placeholder="Payment amount"
                          readOnly={analysisRunning}
                          aria-disabled={analysisRunning}
                        />
                      </IntakeField>

                      <IntakeField
                        label="Currency"
                        className="content-start"
                        footer={
                          <span className="text-xs font-normal text-black/50 dark:text-white/50">
                            Use the payout currency for the primary payment.
                          </span>
                        }
                      >
                        <FormSelect
                          name="currency"
                          defaultValue={normalized?.currency ?? aggregate?.terms?.currency ?? "USD"}
                          disabled={analysisRunning}
                          aria-disabled={analysisRunning}
                        >
                          {CURRENCY_OPTIONS.map((currency) => (
                            <option key={currency} value={currency}>
                              {currency}
                            </option>
                          ))}
                        </FormSelect>
                      </IntakeField>

                      <div className="grid content-start gap-2">
                        <div className="text-sm font-medium text-black/70 dark:text-white/75">
                          Deliverable count
                        </div>
                        <div className="flex h-[50px] items-center border border-black/10 bg-sand/55 px-4 text-2xl font-semibold text-ink dark:border-white/12 dark:bg-white/[0.04]">
                          {normalized?.deliverableCount ?? 0}
                        </div>
                        <span className="text-xs font-normal text-black/50 dark:text-white/50">
                          Generated from the current deliverables list.
                        </span>
                      </div>
                    </div>
                  </div>
                  <IntakeInlineEvidence groups={evidenceGroups} ids={["contract-snapshot"]} />
                </IntakeSectionCard>

                <IntakeSectionCard
                  title="Deliverables and timeline"
                  description="Expand to review categories, restrictions, deliverables, timeline, and disclosures."
                >
                  <IntakeGeneratedFieldsEditor
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
                  <IntakeInlineEvidence groups={evidenceGroups} ids={["rights-and-disclosure", "timeline", "analytics"]} />
                </IntakeSectionCard>

                <IntakeSectionCard
                  title="Notes"
                  description="Anything the AI missed, open questions, or manual corrections."
                >
                  <IntakeField
                    label={<span className="sr-only">Notes</span>}
                    footer={
                      <span className="text-xs font-normal text-black/50 dark:text-white/50">
                        Carries into the partnership workspace after confirmation.
                      </span>
                    }
                  >
                    <FormTextarea
                      name="notes"
                      defaultValue={normalized?.notes ?? ""}
                      placeholder="Capture missing details, negotiation notes, or manual corrections."
                      readOnly={analysisRunning}
                      aria-disabled={analysisRunning}
                    />
                  </IntakeField>
                </IntakeSectionCard>

                <div className="sticky bottom-4 z-20">
                  <div className="flex w-full items-center justify-between gap-3 border border-black/8 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#11161c]/92">
                    <span className="text-sm text-black/55 dark:text-white/55">
                      {attentionItems.length > 0
                        ? `${attentionItems.length} item${attentionItems.length === 1 ? "" : "s"} to review`
                        : "Ready to confirm"}
                    </span>
                    <PostHogSubmitButton
                      eventName="intake_confirmation_submitted"
                      payload={{ source: "intake_review" }}
                      pendingLabel="Generating workspace..."
                      className="bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!showConfirmation}
                    >
                      Create workspace
                    </PostHogSubmitButton>
                  </div>
                </div>
              </form>
        </section>

        {/* Below-CTA: profile defaults + risk watchouts (collapsed) */}
        <div className="border-t border-black/8 pt-6 dark:border-white/10">
          <details className="group -mx-4 border-y border-black/5 bg-white/85 px-4 py-6 dark:border-white/10 dark:bg-white/[0.06] sm:mx-0 sm:border sm:p-6 sm:shadow-panel">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 shrink-0 text-black/40 transition-transform group-open:rotate-90 dark:text-white/40" />
                  <h2 className="text-lg font-semibold text-ink">Profile defaults</h2>
                </div>
                <span className="text-xs text-black/45 dark:text-white/45">
                  {profileConfigured ? "Configured" : "Not set up"}
                </span>
              </div>
            </summary>
            <div className="mt-4">
              <p className="text-sm text-black/60 dark:text-white/65">
                These creator details backfill the intake when extracted values are still
                missing.
              </p>

              {profileConfigured ? (
                <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="grid flex-1 gap-3 sm:grid-cols-3">
                    <div className="bg-sand/55 p-4 dark:bg-white/[0.04]">
                      <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                        Creator
                      </div>
                      <div className="mt-2 text-sm font-semibold text-ink">{creatorDefault}</div>
                    </div>
                    <div className="bg-sand/55 p-4 dark:bg-white/[0.04]">
                      <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                        Business
                      </div>
                      <div className="mt-2 text-sm font-semibold text-ink">{businessDefault}</div>
                    </div>
                    <div className="bg-sand/55 p-4 dark:bg-white/[0.04]">
                      <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                        Contact
                      </div>
                      <div className="mt-2 text-sm font-semibold text-ink">{contactDefault}</div>
                    </div>
                  </div>
                  <CreatorProfileSetupDialog
                    configured={profileConfigured}
                    email={contactDefault}
                    initialName={initialProfileName}
                    initialHandle={initialProfileHandle}
                  />
                </div>
              ) : (
                <div className="mt-4 flex min-h-32 items-center justify-center bg-sand/45 p-6 text-center dark:bg-white/[0.04]">
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
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
