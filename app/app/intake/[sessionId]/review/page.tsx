/**
 * This file renders the intake review screen for a single session.
 * It connects the editable review UI to the normalized intake data and confirmation flow.
 */
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";

import { FormInput, FormSelect, FormTextarea } from "@/components/generic/form";
import {
  CreatorProfileSetupDialog,
  IntakeGeneratedFieldsEditor,
  IntakeReviewLiveStatus,
  WorkspaceCreationOverlay,
} from "@/components/intake-flow";
import {
  IntakeField,
  IntakeHelperSpacer,
  IntakeHelperText,
  IntakeInlineEvidence,
  IntakeSectionCard,
} from "@/components/intake";
import {
  IntakeReviewFooter,
  IntakeReviewHeader,
  IntakeSummaryCards,
} from "@/components/patterns/intake";
import { confirmIntakeSessionAction } from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { CURRENCY_OPTIONS } from "@/lib/deal-terms-constants";

import {
  buildIntakeReviewPageViewModel,
  loadIntakeSessionRouteData,
  shouldRedirectToDeal,
} from "../page-helpers";

export default function IntakeSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-primary" />
        </div>
      }
    >
      <IntakeReviewContent params={params} />
    </Suspense>
  );
}

// fallow-ignore-next-line complexity
async function IntakeReviewContent({ params }: { params: Promise<{ sessionId: string }> }) {
  const viewer = await requireViewer();
  const { sessionId } = await params;
  const sessionData = await loadIntakeSessionRouteData(viewer, sessionId);

  if (!sessionData) {
    redirect("/app");
  }

  const { session, aggregate, processing, profileDefaults } = sessionData;
  const dealRedirect = shouldRedirectToDeal(session, aggregate);
  if (dealRedirect) {
    redirect(dealRedirect);
  }

  const showConfirmation =
    session.status === "ready_for_confirmation" || session.status === "failed";
  if (!showConfirmation) {
    redirect(`/app/intake/${session.id}`);
  }

  const analysisRunning = false;
  const {
    analyticsHighlights,
    attentionItems,
    businessDefault,
    conflictMessagesByField,
    conflictResults,
    contactDefault,
    contactType,
    creatorDefault,
    deliverables,
    evidenceGroups,
    initialProfileHandle,
    initialProfileName,
    normalized,
    profileConfigured,
    riskFlags,
    summaryCards,
    timelineItems,
  } = buildIntakeReviewPageViewModel({
    aggregate,
    profileDefaults,
    viewer,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <IntakeReviewHeader sessionId={session.id} status={session.status} />

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
                  {document.fileName} | {document.processingStatus} |{" "}
                  {document.errorMessage ?? "ok"}
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
              <div className="grid gap-5 md:grid-cols-2 md:items-start">
                <IntakeField
                  label="Contact type"
                  footer={
                    <span className="inline-flex min-h-[40px] text-xs font-normal text-black/50 dark:text-white/50">
                      Use the agency when a management company or intermediary is driving the
                      partnership.
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
                    <span className="inline-flex min-h-[40px]">
                      <IntakeHelperText
                        analysisRunning={analysisRunning}
                        hasValue={Boolean(normalized?.primaryContact?.name)}
                        pendingLabel="Scanning signatures and agreement party sections..."
                        emptyLabel="Add the main external contact if it is not extracted."
                      />
                    </span>
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
                    <div className="flex h-[50px] items-center border border-black/10 bg-sand/55 px-4 text-base font-semibold text-ink dark:border-white/12 dark:bg-white/[0.04]">
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
              <IntakeInlineEvidence
                groups={evidenceGroups}
                ids={["rights-and-disclosure", "timeline", "analytics"]}
              />
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

            <IntakeReviewFooter
              attentionCount={attentionItems.length}
              disabled={!showConfirmation}
            />
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
                These creator details backfill the intake when extracted values are still missing.
              </p>

              {profileConfigured ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
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
                      Set up your creator profile so future intakes can start with your name,
                      handle, and contact defaults.
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
