/**
 * Helpers for the file-backed repository store.
 * This module normalizes the stored JSON shape and builds deal aggregates from the file store.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";

import { getRuntimeDir, getRuntimePath } from "@/lib/runtime-path";
import { createSeedStore } from "@/lib/repository/seed";
import { getCurrentWorkspaceSummary, normalizeSummaryRecord } from "@/lib/summaries";
import type { AppStore, DealAggregate, DealRecord, DocumentRecord } from "@/lib/types";

const runtimeDir = getRuntimeDir();
const dataFile = getRuntimePath("app-store.json");

export function normalizeStore(store: Partial<AppStore>): AppStore {
  return {
    users: store.users ?? [],
    deals: (store.deals ?? []).map((deal) => ({
      ...deal,
      confirmedAt: deal.confirmedAt ?? deal.createdAt ?? null,
      status: (() => {
        const legacyStatus = deal.status as string;

        if (legacyStatus === "ready" || legacyStatus === "needs_attention") {
          return "negotiating";
        }

        if (legacyStatus === "processing" || legacyStatus === "draft") {
          return "contract_received";
        }

        return deal.status;
      })(),
      paymentStatus:
        deal.paymentStatus === "not_invoiced"
          ? "not_invoiced"
          : deal.paymentStatus === "invoiced"
            ? "not_invoiced"
            : deal.paymentStatus === "late"
              ? "late"
              : deal.paymentStatus === "awaiting_payment"
                ? "awaiting_payment"
                : deal.paymentStatus === "paid"
                  ? "paid"
                  : "not_invoiced",
      legalDisclaimer: deal.legalDisclaimer || "",
    })),
    documents: (store.documents ?? []).map((document) => {
      const legacyDocument = document as DocumentRecord & {
        type?: string;
        failureReason?: string | null;
      };

      return {
        ...document,
        rawText: document.rawText ?? null,
        normalizedText: document.normalizedText ?? null,
        documentKind: document.documentKind ?? legacyDocument.type ?? "unknown",
        classificationConfidence: document.classificationConfidence ?? null,
        sourceType: document.sourceType ?? "file",
        errorMessage: document.errorMessage ?? legacyDocument.failureReason ?? null,
        processingRunId: document.processingRunId ?? null,
        processingRunStateJson: document.processingRunStateJson ?? null,
        processingStartedAt: document.processingStartedAt ?? null,
      };
    }),
    dealTerms: (store.dealTerms ?? []).map((terms) => ({
      ...terms,
      brandName: terms.brandName ?? null,
      agencyName: terms.agencyName ?? null,
      creatorName: terms.creatorName ?? null,
      campaignName: terms.campaignName ?? null,
      paymentStructure: terms.paymentStructure ?? null,
      netTermsDays: terms.netTermsDays ?? null,
      paymentTrigger: terms.paymentTrigger ?? null,
      usageRightsOrganicAllowed: terms.usageRightsOrganicAllowed ?? null,
      usageRightsPaidAllowed: terms.usageRightsPaidAllowed ?? null,
      whitelistingAllowed: terms.whitelistingAllowed ?? null,
      usageDuration: terms.usageDuration ?? null,
      usageTerritory: terms.usageTerritory ?? null,
      usageChannels: terms.usageChannels ?? [],
      exclusivityApplies: terms.exclusivityApplies ?? null,
      exclusivityCategory: terms.exclusivityCategory ?? null,
      exclusivityDuration: terms.exclusivityDuration ?? null,
      exclusivityRestrictions: terms.exclusivityRestrictions ?? null,
      brandCategory: terms.brandCategory ?? null,
      competitorCategories: terms.competitorCategories ?? [],
      restrictedCategories: terms.restrictedCategories ?? [],
      campaignDateWindow: terms.campaignDateWindow ?? null,
      disclosureObligations: terms.disclosureObligations ?? [],
      revisionRounds: terms.revisionRounds ?? null,
      terminationAllowed: terms.terminationAllowed ?? null,
      terminationNotice: terms.terminationNotice ?? null,
      terminationConditions: terms.terminationConditions ?? null,
      manuallyEditedFields: terms.manuallyEditedFields ?? [],
      briefData: terms.briefData ?? null,
      pendingExtraction: terms.pendingExtraction ?? null,
      deliverables: (terms.deliverables ?? []).map((deliverable) => ({
        ...deliverable,
        status: deliverable.status ?? "pending",
        description: deliverable.description ?? null,
      })),
    })),
    riskFlags: (store.riskFlags ?? []).map((flag) => ({
      ...flag,
      suggestedAction: flag.suggestedAction ?? null,
      evidence: flag.evidence ?? [],
      sourceDocumentId: flag.sourceDocumentId ?? null,
    })),
    emailAccounts: store.emailAccounts ?? [],
    emailThreads: store.emailThreads ?? [],
    emailMessages: store.emailMessages ?? [],
    emailSyncStates: store.emailSyncStates ?? [],
    dealEmailLinks: store.dealEmailLinks ?? [],
    emailCandidateMatches: store.emailCandidateMatches ?? [],
    emailDealEvents: store.emailDealEvents ?? [],
    emailDealTermSuggestions: store.emailDealTermSuggestions ?? [],
    emailActionItems: store.emailActionItems ?? [],
    brandContacts: store.brandContacts ?? [],
    assistantThreads: store.assistantThreads ?? [],
    assistantMessages: store.assistantMessages ?? [],
    assistantContextSnapshots: store.assistantContextSnapshots ?? [],
    invoiceRecords: (store.invoiceRecords ?? []).map((record) => ({
      ...record,
      status:
        record.status === "sent" || record.status === "voided"
          ? record.status
          : record.status === "finalized"
            ? "finalized"
            : "draft",
      sentAt: record.sentAt ?? null,
      lastSentThreadId: record.lastSentThreadId ?? null,
      lastSentMessageId: record.lastSentMessageId ?? null,
      lastSentAccountId: record.lastSentAccountId ?? null,
      lastSentToEmail: record.lastSentToEmail ?? null,
    })),
    invoiceDeliveryRecords: store.invoiceDeliveryRecords ?? [],
    invoiceReminderTouchpoints: store.invoiceReminderTouchpoints ?? [],
    jobs: (store.jobs ?? []).map((job) => ({
      ...job,
      type: job.type ?? "generate_summary",
    })),
    documentSections: store.documentSections ?? [],
    documentRuns: store.documentRuns ?? [],
    documentArtifacts: store.documentArtifacts ?? [],
    documentFieldEvidence: store.documentFieldEvidence ?? [],
    documentReviewItems: store.documentReviewItems ?? [],
    extractionResults: store.extractionResults ?? [],
    extractionEvidence: store.extractionEvidence ?? [],
    summaries: (store.summaries ?? []).map((summary) => normalizeSummaryRecord(summary)),
  };
}

export async function ensureStore() {
  await mkdir(runtimeDir, { recursive: true });

  try {
    const payload = await readFile(dataFile, "utf8");
    const normalized = normalizeStore(JSON.parse(payload) as Partial<AppStore>);
    await writeFile(dataFile, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    const seed = createSeedStore();
    await writeFile(dataFile, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

export async function saveStore(store: AppStore) {
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

export function sortNewestFirst<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    (right.updatedAt ?? right.createdAt ?? "").localeCompare(left.updatedAt ?? left.createdAt ?? "")
  );
}

export function buildAggregate(store: AppStore, deal: DealRecord): DealAggregate {
  const documents = sortNewestFirst(
    store.documents.filter((document) => document.dealId === deal.id)
  );
  const latestDocument = documents[0] ?? null;
  const summaries = sortNewestFirst(
    store.summaries.filter((summary) => summary.dealId === deal.id)
  );

  return {
    deal,
    latestDocument,
    documents,
    terms: store.dealTerms.find((record) => record.dealId === deal.id) ?? null,
    conflictResults: [],
    paymentRecord: null,
    invoiceRecord: store.invoiceRecords.find((record) => record.dealId === deal.id) ?? null,
    riskFlags: sortNewestFirst(store.riskFlags.filter((flag) => flag.dealId === deal.id)),
    jobs: sortNewestFirst(store.jobs.filter((job) => job.dealId === deal.id)),
    documentSections: store.documentSections.filter((section) =>
      documents.some((document) => document.id === section.documentId)
    ),
    documentRuns: sortNewestFirst(
      store.documentRuns.filter((run) =>
        documents.some((document) => document.id === run.documentId)
      )
    ),
    documentArtifacts: sortNewestFirst(
      store.documentArtifacts.filter((artifact) =>
        documents.some((document) => document.id === artifact.documentId)
      )
    ),
    documentFieldEvidence: sortNewestFirst(
      store.documentFieldEvidence.filter((entry) =>
        documents.some((document) => document.id === entry.documentId)
      )
    ),
    documentReviewItems: sortNewestFirst(
      store.documentReviewItems.filter((entry) =>
        documents.some((document) => document.id === entry.documentId)
      )
    ),
    extractionResults: sortNewestFirst(
      store.extractionResults.filter((result) =>
        documents.some((document) => document.id === result.documentId)
      )
    ),
    extractionEvidence: sortNewestFirst(
      store.extractionEvidence.filter((evidence) =>
        documents.some((document) => document.id === evidence.documentId)
      )
    ),
    summaries,
    currentSummary: getCurrentWorkspaceSummary(summaries),
    intakeSession: null,
  };
}
