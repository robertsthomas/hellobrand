import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { getRuntimeDir, getRuntimePath } from "@/lib/runtime-path";
import { createSeedStore } from "@/lib/repository/seed";
import type {
  AssistantContextSnapshotRecord,
  AssistantMessageRecord,
  AssistantThreadRecord,
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
  IntakeBatchGroupRecord,
  IntakeBatchRecord,
  JobRecord,
  RiskFlagRecord,
  SummaryRecord
} from "@/lib/types";

const runtimeDir = getRuntimeDir();
const dataFile = getRuntimePath("app-store.json");

function normalizeStore(store: Partial<AppStore>): AppStore {
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
        errorMessage: document.errorMessage ?? legacyDocument.failureReason ?? null
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
    conflictResults: [],
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
    const deletedThreadIds = store.assistantThreads
      .filter((entry) => entry.dealId === dealId)
      .map((entry) => entry.id);
    store.assistantThreads = store.assistantThreads.filter((entry) => entry.dealId !== dealId);
    store.assistantMessages = store.assistantMessages.filter(
      (entry) => !deletedThreadIds.includes(entry.threadId)
    );
    store.assistantContextSnapshots = store.assistantContextSnapshots.filter(
      (entry) => entry.dealId !== dealId
    );
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

  async savePendingExtraction(dealId: string, data: unknown) {
    const store = await ensureStore();
    const index = store.dealTerms.findIndex((entry) => entry.dealId === dealId);
    if (index === -1) return;
    store.dealTerms[index] = {
      ...store.dealTerms[index],
      pendingExtraction: (data as DealTermsRecord["pendingExtraction"]) ?? null,
      updatedAt: new Date().toISOString()
    };
    await saveStore(store);
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

  async listAssistantThreads(
    userId: string,
    options?: { scope?: AssistantThreadRecord["scope"]; dealId?: string | null }
  ) {
    const store = await ensureStore();
    return sortNewestFirst(
      store.assistantThreads.filter((thread) => {
        if (thread.userId !== userId) {
          return false;
        }

        if (options?.scope && thread.scope !== options.scope) {
          return false;
        }

        if (options?.dealId !== undefined && thread.dealId !== (options.dealId ?? null)) {
          return false;
        }

        return true;
      })
    );
  }

  async getAssistantThread(userId: string, threadId: string) {
    const store = await ensureStore();
    return (
      store.assistantThreads.find(
        (thread) => thread.id === threadId && thread.userId === userId
      ) ?? null
    );
  }

  async createAssistantThread(
    userId: string,
    input: Pick<AssistantThreadRecord, "scope" | "dealId" | "title" | "summary">
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const thread: AssistantThreadRecord = {
      id: randomUUID(),
      userId,
      dealId: input.dealId ?? null,
      scope: input.scope,
      title: input.title,
      summary: input.summary ?? null,
      createdAt: now,
      updatedAt: now
    };

    store.assistantThreads.unshift(thread);
    await saveStore(store);
    return thread;
  }

  async updateAssistantThread(
    userId: string,
    threadId: string,
    patch: Partial<Pick<AssistantThreadRecord, "title" | "summary">>
  ) {
    const store = await ensureStore();
    const index = store.assistantThreads.findIndex(
      (thread) => thread.id === threadId && thread.userId === userId
    );

    if (index === -1) {
      return null;
    }

    store.assistantThreads[index] = {
      ...store.assistantThreads[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await saveStore(store);
    return store.assistantThreads[index];
  }

  async deleteAssistantThread(userId: string, threadId: string) {
    const store = await ensureStore();
    const existing = store.assistantThreads.find(
      (thread) => thread.id === threadId && thread.userId === userId
    );

    if (!existing) {
      return false;
    }

    store.assistantThreads = store.assistantThreads.filter((thread) => thread.id !== threadId);
    store.assistantMessages = store.assistantMessages.filter((message) => message.threadId !== threadId);
    await saveStore(store);
    return true;
  }

  async listAssistantMessages(userId: string, threadId: string) {
    const store = await ensureStore();
    const thread = store.assistantThreads.find(
      (entry) => entry.id === threadId && entry.userId === userId
    );

    if (!thread) {
      return [];
    }

    return [...store.assistantMessages]
      .filter((message) => message.threadId === threadId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async saveAssistantMessage(
    userId: string,
    threadId: string,
    input: Pick<AssistantMessageRecord, "role" | "content" | "parts"> & { id?: string }
  ) {
    const store = await ensureStore();
    const threadIndex = store.assistantThreads.findIndex(
      (thread) => thread.id === threadId && thread.userId === userId
    );

    if (threadIndex === -1) {
      return null;
    }

    const now = new Date().toISOString();
    const existingIndex = input.id
      ? store.assistantMessages.findIndex((message) => message.id === input.id)
      : -1;

    const next: AssistantMessageRecord = {
      id: input.id ?? randomUUID(),
      threadId,
      role: input.role,
      content: input.content,
      parts: input.parts,
      createdAt:
        existingIndex === -1 ? now : store.assistantMessages[existingIndex].createdAt,
      updatedAt: now
    };

    if (existingIndex === -1) {
      store.assistantMessages.push(next);
    } else {
      store.assistantMessages[existingIndex] = next;
    }

    store.assistantThreads[threadIndex] = {
      ...store.assistantThreads[threadIndex],
      updatedAt: now,
      summary:
        input.role === "assistant" && input.content.trim().length > 0
          ? input.content.slice(0, 280)
          : store.assistantThreads[threadIndex].summary
    };

    await saveStore(store);
    return next;
  }

  async getAssistantContextSnapshot(userId: string, key: string) {
    const store = await ensureStore();
    return (
      store.assistantContextSnapshots.find(
        (snapshot) => snapshot.userId === userId && snapshot.key === key
      ) ?? null
    );
  }

  async saveAssistantContextSnapshot(
    userId: string,
    input: Pick<
      AssistantContextSnapshotRecord,
      "dealId" | "scope" | "key" | "version" | "summary" | "payload"
    >
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const existingIndex = store.assistantContextSnapshots.findIndex(
      (snapshot) => snapshot.userId === userId && snapshot.key === input.key
    );

    const next: AssistantContextSnapshotRecord = {
      id:
        existingIndex === -1
          ? randomUUID()
          : store.assistantContextSnapshots[existingIndex].id,
      userId,
      dealId: input.dealId ?? null,
      scope: input.scope,
      key: input.key,
      version: input.version,
      summary: input.summary,
      payload: input.payload,
      createdAt:
        existingIndex === -1
          ? now
          : store.assistantContextSnapshots[existingIndex].createdAt,
      updatedAt: now
    };

    if (existingIndex === -1) {
      store.assistantContextSnapshots.unshift(next);
    } else {
      store.assistantContextSnapshots[existingIndex] = next;
    }

    await saveStore(store);
    return next;
  }

  async createBatch(
    userId: string,
    groups: Array<{ label: string; confidence: number; documentIds: string[] }>
  ): Promise<IntakeBatchRecord> {
    const now = new Date().toISOString();
    const batch: IntakeBatchRecord = {
      id: randomUUID(),
      userId,
      status: "review",
      createdAt: now,
      updatedAt: now,
      groups: groups.map((group) => ({
        id: randomUUID(),
        batchId: "",
        intakeSessionId: null,
        label: group.label,
        confidence: group.confidence,
        documentIds: group.documentIds,
        status: "pending" as const,
        createdAt: now
      }))
    };
    for (const g of batch.groups) {
      g.batchId = batch.id;
    }
    return batch;
  }

  async getBatch(_userId: string, _batchId: string): Promise<IntakeBatchRecord | null> {
    return null;
  }

  async updateBatchGroup(
    _groupId: string,
    _patch: Partial<Pick<IntakeBatchGroupRecord, "label" | "status" | "intakeSessionId" | "documentIds">>
  ): Promise<IntakeBatchGroupRecord> {
    throw new Error("Batch operations require a database.");
  }

  async updateBatchStatus(_batchId: string, _status: string) {
    // no-op in file mode
  }
}
