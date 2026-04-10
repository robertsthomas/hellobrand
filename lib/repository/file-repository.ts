import { randomUUID } from "node:crypto";

import {
  buildAggregate,
  ensureStore,
  saveStore,
  sortNewestFirst
} from "@/lib/repository/file-store";
import {
  getLatestSummaryByType,
  getWorkspaceSummaries,
  normalizeSummaryInput,
  normalizeSummaryRecord
} from "@/lib/summaries";
import { deleteStoredBytes } from "@/lib/storage";
import type {
  AssistantContextSnapshotRecord,
  AssistantMessageRecord,
  AssistantThreadRecord,
  AppStore,
  DealAggregate,
  DealRecord,
  DealTermsRecord,
  DocumentArtifactRecord,
  DocumentFieldEvidenceRecord,
  DocumentReviewItemRecord,
  DocumentRunRecord,
  DocumentRecord,
  DocumentSectionRecord,
  DraftIntent,
  EmailDraftRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord,
  IntakeBatchGroupRecord,
  IntakeBatchRecord,
  InvoiceDeliveryRecord,
  InvoiceRecord,
  InvoiceReminderTouchpointRecord,
  JobRecord,
  RiskFlagRecord,
  SummaryRecord,
  SummaryRecordInput,
  SummaryType
} from "@/lib/types";

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

  async deleteDocument(documentId: string) {
    const store = await ensureStore();
    store.documents = store.documents.filter((entry) => entry.id !== documentId);
    await saveStore(store);
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
      confirmedAt: options?.confirmedAt ?? now,
      statusBeforeArchive: null
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

    const documents = store.documents.filter((entry) => entry.dealId === dealId);
    const documentIds = documents.map((entry) => entry.id);

    store.deals = store.deals.filter((entry) => entry.id !== dealId);
    store.documents = store.documents.filter((entry) => entry.dealId !== dealId);
    store.dealTerms = store.dealTerms.filter((entry) => entry.dealId !== dealId);
    store.riskFlags = store.riskFlags.filter((entry) => entry.dealId !== dealId);
    store.emailDrafts = store.emailDrafts.filter((entry) => entry.dealId !== dealId);
    store.dealEmailLinks = store.dealEmailLinks.filter((entry) => entry.dealId !== dealId);
    store.emailCandidateMatches = store.emailCandidateMatches.filter(
      (entry) => entry.dealId !== dealId
    );
    store.emailDealEvents = store.emailDealEvents.filter((entry) => entry.dealId !== dealId);
    store.emailDealTermSuggestions = store.emailDealTermSuggestions.filter(
      (entry) => entry.dealId !== dealId
    );
    store.emailActionItems = store.emailActionItems.filter((entry) => entry.dealId !== dealId);
    store.brandContacts = store.brandContacts.filter((entry) => entry.dealId !== dealId);
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
    store.invoiceRecords = store.invoiceRecords.filter((entry) => entry.dealId !== dealId);
    store.invoiceReminderTouchpoints = store.invoiceReminderTouchpoints.filter(
      (entry) => entry.dealId !== dealId
    );
    store.jobs = store.jobs.filter((entry) => entry.dealId !== dealId);
    store.summaries = store.summaries.filter((entry) => entry.dealId !== dealId);
    store.documentSections = store.documentSections.filter(
      (entry) => !documentIds.includes(entry.documentId)
    );
    const deletedRunIds = store.documentRuns
      .filter((entry) => documentIds.includes(entry.documentId))
      .map((entry) => entry.id);
    store.documentRuns = store.documentRuns.filter(
      (entry) => !documentIds.includes(entry.documentId)
    );
    store.documentArtifacts = store.documentArtifacts.filter(
      (entry) =>
        !documentIds.includes(entry.documentId) && !deletedRunIds.includes(entry.runId)
    );
    store.documentFieldEvidence = store.documentFieldEvidence.filter(
      (entry) =>
        !documentIds.includes(entry.documentId) && !deletedRunIds.includes(entry.runId)
    );
    store.documentReviewItems = store.documentReviewItems.filter(
      (entry) =>
        !documentIds.includes(entry.documentId) && !deletedRunIds.includes(entry.runId)
    );
    store.extractionResults = store.extractionResults.filter(
      (entry) => !documentIds.includes(entry.documentId)
    );
    store.extractionEvidence = store.extractionEvidence.filter(
      (entry) => !documentIds.includes(entry.documentId)
    );

    await saveStore(store);
    await Promise.all(documents.map((document) => deleteStoredBytes(document.storagePath)));
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

  async listInvoiceRecords(userId: string) {
    const store = await ensureStore();
    return sortNewestFirst(
      store.invoiceRecords.filter((record) => record.userId === userId)
    );
  }

  async getInvoiceRecord(userId: string, dealId: string) {
    const store = await ensureStore();
    return (
      store.invoiceRecords.find(
        (record) => record.userId === userId && record.dealId === dealId
      ) ?? null
    );
  }

  async deleteInvoiceRecord(userId: string, dealId: string) {
    const store = await ensureStore();
    store.invoiceRecords = store.invoiceRecords.filter(
      (record) => !(record.userId === userId && record.dealId === dealId)
    );
    await saveStore(store);
  }

  async listInvoiceDeliveryRecords(userId: string, dealId: string) {
    const store = await ensureStore();
    return sortNewestFirst(
      store.invoiceDeliveryRecords.filter(
        (record) => record.userId === userId && record.dealId === dealId
      )
    );
  }

  async upsertInvoiceRecord(
    userId: string,
    dealId: string,
    patch: Omit<InvoiceRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const index = store.invoiceRecords.findIndex((record) => record.dealId === dealId);
    const next: InvoiceRecord = {
      id: index >= 0 ? store.invoiceRecords[index]!.id : randomUUID(),
      dealId,
      userId,
      createdAt: index >= 0 ? store.invoiceRecords[index]!.createdAt : now,
      updatedAt: now,
      ...patch
    };

    if (index >= 0) {
      store.invoiceRecords[index] = next;
    } else {
      store.invoiceRecords.unshift(next);
    }

    await saveStore(store);
    return next;
  }

  async createInvoiceDeliveryRecord(
    userId: string,
    dealId: string,
    patch: Omit<InvoiceDeliveryRecord, "id" | "dealId" | "userId" | "createdAt">
  ) {
    const store = await ensureStore();
    const next: InvoiceDeliveryRecord = {
      id: randomUUID(),
      userId,
      dealId,
      createdAt: new Date().toISOString(),
      ...patch
    };

    store.invoiceDeliveryRecords.unshift(next);
    await saveStore(store);
    return next;
  }

  async listInvoiceReminderTouchpoints(userId: string, options?: { dealId?: string }) {
    const store = await ensureStore();
    return store.invoiceReminderTouchpoints
      .filter((touchpoint) => {
        if (touchpoint.userId !== userId) {
          return false;
        }

        if (options?.dealId && touchpoint.dealId !== options.dealId) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.sendOn.localeCompare(right.sendOn));
  }

  async upsertInvoiceReminderTouchpoints(
    userId: string,
    dealId: string,
    touchpoints: Array<Omit<InvoiceReminderTouchpointRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">>
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();

    for (const touchpoint of touchpoints) {
      const index = store.invoiceReminderTouchpoints.findIndex(
        (entry) => entry.dealId === dealId && entry.offsetDays === touchpoint.offsetDays
      );
      const next: InvoiceReminderTouchpointRecord = {
        id: index >= 0 ? store.invoiceReminderTouchpoints[index]!.id : randomUUID(),
        dealId,
        userId,
        createdAt: index >= 0 ? store.invoiceReminderTouchpoints[index]!.createdAt : now,
        updatedAt: now,
        ...touchpoint
      };

      if (index >= 0) {
        store.invoiceReminderTouchpoints[index] = next;
      } else {
        store.invoiceReminderTouchpoints.push(next);
      }
    }

    await saveStore(store);
    return store.invoiceReminderTouchpoints
      .filter((entry) => entry.dealId === dealId && entry.userId === userId)
      .sort((left, right) => left.sendOn.localeCompare(right.sendOn));
  }

  async updateInvoiceReminderTouchpoint(
    id: string,
    patch: Partial<
      Omit<InvoiceReminderTouchpointRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">
    >
  ) {
    const store = await ensureStore();
    const index = store.invoiceReminderTouchpoints.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return null;
    }

    const next = {
      ...store.invoiceReminderTouchpoints[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    store.invoiceReminderTouchpoints[index] = next;
    await saveStore(store);
    return next;
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

  async listDocumentSections(documentId: string) {
    const store = await ensureStore();
    return store.documentSections
      .filter((section) => section.documentId === documentId)
      .sort((left, right) => left.chunkIndex - right.chunkIndex);
  }

  async createDocumentRun(run: Omit<DocumentRunRecord, "createdAt" | "updatedAt">) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const next: DocumentRunRecord = {
      ...run,
      createdAt: now,
      updatedAt: now
    };

    store.documentRuns.unshift(next);
    await saveStore(store);
    return next;
  }

  async updateDocumentRun(
    runId: string,
    patch: Partial<Omit<DocumentRunRecord, "id" | "documentId" | "createdAt" | "updatedAt">>
  ) {
    const store = await ensureStore();
    const index = store.documentRuns.findIndex((entry) => entry.id === runId);

    if (index === -1) {
      return null;
    }

    store.documentRuns[index] = {
      ...store.documentRuns[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await saveStore(store);
    return store.documentRuns[index];
  }

  async getDocumentRun(runId: string) {
    const store = await ensureStore();
    return store.documentRuns.find((entry) => entry.id === runId) ?? null;
  }

  async listDocumentRuns(documentId: string) {
    const store = await ensureStore();
    return sortNewestFirst(store.documentRuns.filter((entry) => entry.documentId === documentId));
  }

  async createDocumentArtifact(
    artifact: Omit<DocumentArtifactRecord, "id" | "createdAt">
  ) {
    const store = await ensureStore();
    const next: DocumentArtifactRecord = {
      ...artifact,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };

    store.documentArtifacts.unshift(next);
    await saveStore(store);
    return next;
  }

  async listDocumentArtifacts(documentId: string, options?: { runId?: string }) {
    const store = await ensureStore();
    return sortNewestFirst(
      store.documentArtifacts.filter(
        (entry) => entry.documentId === documentId && (!options?.runId || entry.runId === options.runId)
      )
    );
  }

  async replaceDocumentFieldEvidence(
    documentId: string,
    runId: string,
    evidence: Omit<DocumentFieldEvidenceRecord, "id" | "documentId" | "runId" | "createdAt">[]
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    store.documentFieldEvidence = store.documentFieldEvidence.filter(
      (entry) => !(entry.documentId === documentId && entry.runId === runId)
    );
    store.documentFieldEvidence.push(
      ...evidence.map((entry) => ({
        ...entry,
        id: randomUUID(),
        documentId,
        runId,
        createdAt: now
      }))
    );
    await saveStore(store);
    return sortNewestFirst(
      store.documentFieldEvidence.filter(
        (entry) => entry.documentId === documentId && entry.runId === runId
      )
    );
  }

  async listDocumentFieldEvidence(
    documentId: string,
    options?: { runId?: string; fieldPath?: string }
  ) {
    const store = await ensureStore();
    return sortNewestFirst(
      store.documentFieldEvidence.filter(
        (entry) =>
          entry.documentId === documentId &&
          (!options?.runId || entry.runId === options.runId) &&
          (!options?.fieldPath || entry.fieldPath === options.fieldPath)
      )
    );
  }

  async replaceDocumentReviewItems(
    documentId: string,
    runId: string,
    items: Omit<DocumentReviewItemRecord, "id" | "documentId" | "runId" | "createdAt" | "updatedAt">[]
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    store.documentReviewItems = store.documentReviewItems.filter(
      (entry) => !(entry.documentId === documentId && entry.runId === runId)
    );
    store.documentReviewItems.push(
      ...items.map((entry) => ({
        ...entry,
        id: randomUUID(),
        documentId,
        runId,
        createdAt: now,
        updatedAt: now
      }))
    );
    await saveStore(store);
    return sortNewestFirst(
      store.documentReviewItems.filter(
        (entry) => entry.documentId === documentId && entry.runId === runId
      )
    );
  }

  async listDocumentReviewItems(
    documentId: string,
    options?: { runId?: string; status?: DocumentReviewItemRecord["status"] }
  ) {
    const store = await ensureStore();
    return sortNewestFirst(
      store.documentReviewItems.filter(
        (entry) =>
          entry.documentId === documentId &&
          (!options?.runId || entry.runId === options.runId) &&
          (!options?.status || entry.status === options.status)
      )
    );
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

  async getExtractionResult(documentId: string) {
    const store = await ensureStore();
    return store.extractionResults.find((entry) => entry.documentId === documentId) ?? null;
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

  async listExtractionEvidence(documentId: string) {
    const store = await ensureStore();
    return store.extractionEvidence.filter((entry) => entry.documentId === documentId);
  }

  async saveSummary(
    dealId: string,
    documentId: string | null,
    summary: SummaryRecordInput
  ) {
    const store = await ensureStore();
    const now = new Date().toISOString();
    const normalized = normalizeSummaryInput(summary);

    if (normalized.isCurrent) {
      store.summaries = store.summaries.map((entry) =>
        entry.dealId === dealId && entry.summaryType !== null
          ? { ...entry, isCurrent: false }
          : entry
      );
    }

    const next: SummaryRecord = {
      body: normalized.body,
      version: normalized.version,
      summaryType: normalized.summaryType ?? null,
      source: normalized.source ?? null,
      parentSummaryId: normalized.parentSummaryId ?? null,
      isCurrent: normalized.isCurrent ?? false,
      id: randomUUID(),
      dealId,
      documentId,
      createdAt: now
    };

    store.summaries.unshift(next);
    await saveStore(store);
    return next;
  }

  async listSummaryHistory(dealId: string) {
    const store = await ensureStore();
    return sortNewestFirst(
      getWorkspaceSummaries(store.summaries.filter((summary) => summary.dealId === dealId))
    );
  }

  async getLatestSummaryByType(dealId: string, summaryType: SummaryType) {
    const history = await this.listSummaryHistory(dealId);
    return getLatestSummaryByType(history, summaryType);
  }

  async restoreSummary(dealId: string, summaryId: string) {
    const store = await ensureStore();
    let restored: SummaryRecord | null = null;

    store.summaries = store.summaries.map((summary) => {
      if (summary.dealId !== dealId || summary.summaryType === null) {
        return summary;
      }

      if (summary.id === summaryId) {
        restored = { ...summary, isCurrent: true };
        return restored;
      }

      return {
        ...summary,
        isCurrent: false
      };
    });

    if (!restored) {
      return null;
    }

    await saveStore(store);
    return restored;
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

  async listRiskFlagsForDocument(dealId: string, documentId: string) {
    const store = await ensureStore();
    return store.riskFlags.filter(
      (flag) => flag.dealId === dealId && flag.sourceDocumentId === documentId
    );
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
