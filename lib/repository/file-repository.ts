import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { createSeedStore } from "@/lib/repository/seed";
import type {
  AppStore,
  DealAggregate,
  DealRecord,
  DealTermsRecord,
  DocumentRecord,
  DocumentSectionRecord,
  DraftIntent,
  EmailDraftRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord,
  JobRecord,
  RiskFlagRecord,
  SummaryRecord
} from "@/lib/types";

const runtimeDir = path.join(process.cwd(), ".runtime");
const dataFile = path.join(runtimeDir, "app-store.json");

function normalizeStore(store: Partial<AppStore>): AppStore {
  return {
    users: store.users ?? [],
    deals: (store.deals ?? []).map((deal) => ({
      ...deal,
      confirmedAt: deal.confirmedAt ?? deal.createdAt ?? null,
      status:
        deal.status === "ready"
          ? "negotiating"
          : deal.status === "processing"
            ? "contract_received"
            : deal.status === "needs_attention"
              ? "negotiating"
              : deal.status === "draft"
                ? "contract_received"
                : deal.status,
      paymentStatus:
        deal.paymentStatus === "not_invoiced"
          ? "not_invoiced"
          : deal.paymentStatus === "invoiced"
            ? "invoiced"
            : deal.paymentStatus === "late"
              ? "late"
              : deal.paymentStatus === "awaiting_payment"
                ? "awaiting_payment"
                : "not_invoiced",
      legalDisclaimer:
        deal.legalDisclaimer ||
        "HelloBrand provides plain-English contract understanding and negotiation prep. It is not legal advice."
    })),
    documents: (store.documents ?? []).map((document) => ({
      ...document,
      rawText: document.rawText ?? null,
      normalizedText: document.normalizedText ?? null,
      documentKind: document.documentKind ?? document.type ?? "unknown",
      classificationConfidence: document.classificationConfidence ?? null,
      sourceType: document.sourceType ?? "file",
      errorMessage: document.errorMessage ?? document.failureReason ?? null
    })),
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
      revisionRounds: terms.revisionRounds ?? null,
      terminationAllowed: terms.terminationAllowed ?? null,
      terminationNotice: terms.terminationNotice ?? null,
      terminationConditions: terms.terminationConditions ?? null,
      deliverables: (terms.deliverables ?? []).map((deliverable) => ({
        ...deliverable,
        status: deliverable.status ?? "pending",
        description: deliverable.description ?? null
      }))
    })),
    riskFlags: (store.riskFlags ?? []).map((flag) => ({
      ...flag,
      suggestedAction: flag.suggestedAction ?? null,
      evidence: flag.evidence ?? [],
      sourceDocumentId: flag.sourceDocumentId ?? null
    })),
    emailDrafts: store.emailDrafts ?? [],
    jobs: (store.jobs ?? []).map((job) => ({
      ...job,
      type: job.type ?? "generate_summary"
    })),
    documentSections: store.documentSections ?? [],
    extractionResults: store.extractionResults ?? [],
    extractionEvidence: store.extractionEvidence ?? [],
    summaries: store.summaries ?? []
  };
}

async function ensureStore() {
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

async function saveStore(store: AppStore) {
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function sortNewestFirst<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    (right.updatedAt ?? right.createdAt ?? "").localeCompare(
      left.updatedAt ?? left.createdAt ?? ""
    )
  );
}

function isPrimarySummaryVersion(version: string) {
  return !version.startsWith("intake-normalized:");
}

function buildAggregate(store: AppStore, deal: DealRecord): DealAggregate {
  const documents = sortNewestFirst(
    store.documents.filter((document) => document.dealId === deal.id)
  );
  const latestDocument = documents[0] ?? null;
  const summaries = sortNewestFirst(
    store.summaries.filter((summary) => summary.dealId === deal.id)
  );
  const primarySummaries = summaries.filter((summary) =>
    isPrimarySummaryVersion(summary.version)
  );

  return {
    deal,
    latestDocument,
    documents,
    terms: store.dealTerms.find((record) => record.dealId === deal.id) ?? null,
    paymentRecord: null,
    riskFlags: sortNewestFirst(
      store.riskFlags.filter((flag) => flag.dealId === deal.id)
    ),
    emailDrafts: sortNewestFirst(
      store.emailDrafts.filter((draft) => draft.dealId === deal.id)
    ),
    jobs: sortNewestFirst(store.jobs.filter((job) => job.dealId === deal.id)),
    documentSections: store.documentSections.filter((section) =>
      documents.some((document) => document.id === section.documentId)
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
    currentSummary: primarySummaries[0] ?? null
  };
}

export class FileRepository {
  async listDeals(userId: string) {
    const store = await ensureStore();

    return sortNewestFirst(store.deals.filter((deal) => deal.userId === userId));
  }

  async getDealAggregate(userId: string, dealId: string) {
    const store = await ensureStore();
    const deal = store.deals.find(
      (entry) => entry.id === dealId && entry.userId === userId
    );

    if (!deal) {
      return null;
    }

    return buildAggregate(store, deal);
  }

  async getDocument(documentId: string) {
    const store = await ensureStore();
    return store.documents.find((entry) => entry.id === documentId) ?? null;
  }

  async listDocuments(userId: string, dealId: string) {
    const store = await ensureStore();
    const deal = store.deals.find((entry) => entry.id === dealId && entry.userId === userId);

    if (!deal) {
      return [];
    }

    return sortNewestFirst(store.documents.filter((entry) => entry.dealId === dealId));
  }

  async createDeal(
    userId: string,
    input: Pick<DealRecord, "brandName" | "campaignName">,
    options?: { confirmedAt?: string | null }
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const deal: DealRecord = {
      id: randomUUID(),
      userId,
      brandName: input.brandName,
      campaignName: input.campaignName,
      status: "contract_received",
      paymentStatus: "not_invoiced",
      countersignStatus: "unknown",
      summary: null,
      legalDisclaimer:
        "HelloBrand provides plain-English contract understanding and negotiation prep. It is not legal advice.",
      nextDeliverableDate: null,
      createdAt: now,
      updatedAt: now,
      analyzedAt: null,
      confirmedAt: options?.confirmedAt ?? now
    };

    store.deals.unshift(deal);
    await saveStore(store);
    return deal;
  }

  async updateDeal(userId: string, dealId: string, patch: Partial<DealRecord>) {
    const store = await ensureStore();
    const index = store.deals.findIndex(
      (entry) => entry.id === dealId && entry.userId === userId
    );

    if (index === -1) {
      return null;
    }

    const next = {
      ...store.deals[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    store.deals[index] = next;
    await saveStore(store);
    return next;
  }

  async deleteDeal(userId: string, dealId: string) {
    const store = await ensureStore();
    const deal = store.deals.find((entry) => entry.id === dealId && entry.userId === userId);

    if (!deal) {
      return false;
    }

    const documentIds = store.documents
      .filter((entry) => entry.dealId === dealId)
      .map((entry) => entry.id);

    store.deals = store.deals.filter((entry) => entry.id !== dealId);
    store.documents = store.documents.filter((entry) => entry.dealId !== dealId);
    store.dealTerms = store.dealTerms.filter((entry) => entry.dealId !== dealId);
    store.riskFlags = store.riskFlags.filter((entry) => entry.dealId !== dealId);
    store.emailDrafts = store.emailDrafts.filter((entry) => entry.dealId !== dealId);
    store.jobs = store.jobs.filter((entry) => entry.dealId !== dealId);
    store.summaries = store.summaries.filter((entry) => entry.dealId !== dealId);
    store.documentSections = store.documentSections.filter(
      (entry) => !documentIds.includes(entry.documentId)
    );
    store.extractionResults = store.extractionResults.filter(
      (entry) => !documentIds.includes(entry.documentId)
    );
    store.extractionEvidence = store.extractionEvidence.filter(
      (entry) => !documentIds.includes(entry.documentId)
    );

    await saveStore(store);
    return true;
  }

  async createDocument(
    document: Omit<DocumentRecord, "id" | "createdAt" | "updatedAt">
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const next: DocumentRecord = {
      ...document,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };

    store.documents.unshift(next);
    await saveStore(store);
    return next;
  }

  async updateDocument(documentId: string, patch: Partial<DocumentRecord>) {
    const store = await ensureStore();
    const index = store.documents.findIndex((entry) => entry.id === documentId);

    if (index === -1) {
      return null;
    }

    store.documents[index] = {
      ...store.documents[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await saveStore(store);
    return store.documents[index];
  }

  async replaceDocumentSections(
    documentId: string,
    sections: Omit<DocumentSectionRecord, "id" | "documentId" | "createdAt">[]
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    store.documentSections = store.documentSections.filter(
      (section) => section.documentId !== documentId
    );
    store.documentSections.push(
      ...sections.map((section) => ({
        ...section,
        id: randomUUID(),
        documentId,
        createdAt: now
      }))
    );
    await saveStore(store);
    return store.documentSections.filter((section) => section.documentId === documentId);
  }

  async upsertExtractionResult(
    documentId: string,
    result: Omit<ExtractionResultRecord, "id" | "documentId" | "createdAt">
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const index = store.extractionResults.findIndex(
      (entry) => entry.documentId === documentId
    );

    const next: ExtractionResultRecord = {
      ...result,
      id: index === -1 ? randomUUID() : store.extractionResults[index].id,
      documentId,
      createdAt: index === -1 ? now : store.extractionResults[index].createdAt
    };

    if (index === -1) {
      store.extractionResults.unshift(next);
    } else {
      store.extractionResults[index] = next;
    }

    await saveStore(store);
    return next;
  }

  async replaceExtractionEvidence(
    documentId: string,
    evidence: Omit<
      ExtractionEvidenceRecord,
      "id" | "documentId" | "createdAt"
    >[]
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    store.extractionEvidence = store.extractionEvidence.filter(
      (entry) => entry.documentId !== documentId
    );
    store.extractionEvidence.push(
      ...evidence.map((entry) => ({
        ...entry,
        id: randomUUID(),
        documentId,
        createdAt: now
      }))
    );
    await saveStore(store);
    return store.extractionEvidence.filter((entry) => entry.documentId === documentId);
  }

  async saveSummary(
    dealId: string,
    documentId: string | null,
    summary: Omit<SummaryRecord, "id" | "dealId" | "documentId" | "createdAt">
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const next: SummaryRecord = {
      ...summary,
      id: randomUUID(),
      dealId,
      documentId,
      createdAt: now
    };

    store.summaries.unshift(next);
    await saveStore(store);
    return next;
  }

  async createJob(job: Omit<JobRecord, "id" | "createdAt" | "updatedAt">) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const next: JobRecord = {
      ...job,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };

    store.jobs.unshift(next);
    await saveStore(store);
    return next;
  }

  async updateJob(jobId: string, patch: Partial<JobRecord>) {
    const store = await ensureStore();
    const index = store.jobs.findIndex((entry) => entry.id === jobId);

    if (index === -1) {
      return null;
    }

    store.jobs[index] = {
      ...store.jobs[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await saveStore(store);
    return store.jobs[index];
  }

  async upsertTerms(
    dealId: string,
    patch: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const index = store.dealTerms.findIndex((entry) => entry.dealId === dealId);

    const next: DealTermsRecord = {
      ...patch,
      id: index === -1 ? randomUUID() : store.dealTerms[index].id,
      dealId,
      createdAt: index === -1 ? now : store.dealTerms[index].createdAt,
      updatedAt: now
    };

    if (index === -1) {
      store.dealTerms.push(next);
    } else {
      store.dealTerms[index] = next;
    }

    await saveStore(store);
    return next;
  }

  async replaceRiskFlagsForDocument(
    dealId: string,
    documentId: string,
    flags: Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">[]
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    store.riskFlags = store.riskFlags.filter(
      (flag) => !(flag.dealId === dealId && flag.sourceDocumentId === documentId)
    );
    store.riskFlags.push(
      ...flags.map((flag) => ({
        ...flag,
        id: randomUUID(),
        dealId,
        createdAt: now
      }))
    );
    await saveStore(store);
    return store.riskFlags.filter((flag) => flag.dealId === dealId);
  }

  async saveEmailDraft(
    dealId: string,
    intent: DraftIntent,
    payload: Pick<EmailDraftRecord, "subject" | "body">
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const existingIndex = store.emailDrafts.findIndex(
      (entry) => entry.dealId === dealId && entry.intent === intent
    );

    const next: EmailDraftRecord = {
      id: existingIndex === -1 ? randomUUID() : store.emailDrafts[existingIndex].id,
      dealId,
      intent,
      subject: payload.subject,
      body: payload.body,
      createdAt:
        existingIndex === -1 ? now : store.emailDrafts[existingIndex].createdAt,
      updatedAt: now
    };

    if (existingIndex === -1) {
      store.emailDrafts.unshift(next);
    } else {
      store.emailDrafts[existingIndex] = next;
    }

    await saveStore(store);
    return next;
  }
}
