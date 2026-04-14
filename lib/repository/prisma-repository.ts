/**
 * This file is the Prisma-backed implementation of the shared repository layer.
 * It translates database records into the app's stable record types so domain code can work against one interface.
 */
import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getCurrentWorkspaceSummary,
  getLatestSummaryByType as getLatestSummaryByTypeFromHistory,
  getWorkspaceSummaries,
  normalizeSummaryInput,
  normalizeSummaryRecord,
} from "@/lib/summaries";
import { deleteStoredBytes } from "@/lib/storage";
import type {
  AssistantContextSnapshotRecord,
  AssistantMessageRecord,
  AssistantThreadRecord,
  DealAggregate,
  DealRecord,
  DealTermsRecord,
  DocumentArtifactRecord,
  DocumentFieldEvidenceRecord,
  DocumentReviewItemRecord,
  DocumentRunRecord,
  DocumentRecord,
  DocumentSectionRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord,
  IntakeBatchGroupRecord,
  IntakeBatchRecord,
  InvoiceDeliveryRecord,
  JobRecord,
  InvoiceLineItem,
  InvoiceParty,
  InvoiceRecord,
  InvoiceReminderTouchpointRecord,
  PaymentRecord,
  RiskFlagRecord,
  SummaryRecord,
  SummaryRecordInput,
  SummaryType,
} from "@/lib/types";
import {
  toAssistantContextSnapshotRecord,
  toAssistantMessageRecord,
  toAssistantThreadRecord,
  toBatchGroupRecord,
  toBatchRecord,
} from "@/lib/repository/mappers/prisma-assistant";
import {
  toInvoiceDeliveryRecord,
  toInvoiceRecord,
  toInvoiceReminderTouchpointRecord,
  toPaymentRecord,
} from "@/lib/repository/mappers/prisma-billing";
import {
  toDealRecord,
  toDealTermsRecord,
  toRiskFlagRecord,
} from "@/lib/repository/mappers/prisma-deals";
import {
  toDocumentArtifactRecord,
  toDocumentFieldEvidenceRecord,
  toDocumentRecord,
  toDocumentReviewItemRecord,
  toDocumentRunRecord,
  toEvidenceRecord,
  toExtractionResultRecord,
  toJobRecord,
  toSectionRecord,
  toSummaryRecord,
} from "@/lib/repository/mappers/prisma-documents";
import { toIntakeSessionRecord } from "@/lib/repository/mappers/prisma-intake";
import { iso, toJsonValue, toNullableJsonValue } from "@/lib/repository/mappers/prisma-shared";

function sortNewestFirst<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    (right.updatedAt ?? right.createdAt ?? "").localeCompare(left.updatedAt ?? left.createdAt ?? "")
  );
}

export class PrismaRepository {
  async listDeals(userId: string) {
    const deals = await prisma.deal.findMany({
      where: {
        userId,
        confirmedAt: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });

    return deals.map(toDealRecord);
  }

  async getDealAggregate(userId: string, dealId: string): Promise<DealAggregate | null> {
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        userId,
      },
      include: {
        documents: { orderBy: { updatedAt: "desc" } },
        terms: true,
        paymentRecord: true,
        riskFlags: { orderBy: { createdAt: "desc" } },
        jobs: { orderBy: { updatedAt: "desc" } },
        summaries: { orderBy: { createdAt: "desc" } },
        intakeSession: true,
      },
    });

    if (!deal) {
      return null;
    }

    const documentIds = deal.documents.map((document) => document.id);
    let sections: Awaited<ReturnType<typeof prisma.documentSection.findMany>> = [];
    let documentRuns: Awaited<ReturnType<typeof prisma.documentRun.findMany>> = [];
    let documentArtifacts: Awaited<ReturnType<typeof prisma.documentArtifact.findMany>> = [];
    let documentFieldEvidence: Awaited<ReturnType<typeof prisma.documentFieldEvidence.findMany>> =
      [];
    let documentReviewItems: Awaited<ReturnType<typeof prisma.documentReviewItem.findMany>> = [];
    let extractionResults: Awaited<ReturnType<typeof prisma.extractionResult.findMany>> = [];
    let extractionEvidence: Awaited<ReturnType<typeof prisma.extractionEvidence.findMany>> = [];

    if (documentIds.length > 0) {
      [
        sections,
        documentRuns,
        documentArtifacts,
        documentFieldEvidence,
        documentReviewItems,
        extractionResults,
        extractionEvidence,
      ] = await prisma.$transaction([
        prisma.documentSection.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: [{ chunkIndex: "asc" }],
        }),
        prisma.documentRun.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.documentArtifact.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.documentFieldEvidence.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.documentReviewItem.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.extractionResult.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.extractionEvidence.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }

    const invoiceRecord = await prisma.invoiceRecord.findFirst({
      where: {
        dealId,
        userId,
      },
    });

    const documents = deal.documents.map(toDocumentRecord);
    const summaries = deal.summaries.map(toSummaryRecord);

    return {
      deal: toDealRecord(deal),
      latestDocument: documents[0] ?? null,
      documents,
      terms: deal.terms ? toDealTermsRecord(deal.terms) : null,
      conflictResults: [],
      paymentRecord: deal.paymentRecord ? toPaymentRecord(deal.paymentRecord) : null,
      invoiceRecord: invoiceRecord ? toInvoiceRecord(invoiceRecord) : null,
      riskFlags: deal.riskFlags.map(toRiskFlagRecord),
      jobs: deal.jobs.map(toJobRecord),
      documentSections: sections.map(toSectionRecord),
      documentRuns: documentRuns.map(toDocumentRunRecord),
      documentArtifacts: documentArtifacts.map(toDocumentArtifactRecord),
      documentFieldEvidence: documentFieldEvidence.map(toDocumentFieldEvidenceRecord),
      documentReviewItems: documentReviewItems.map(toDocumentReviewItemRecord),
      extractionResults: extractionResults.map(toExtractionResultRecord),
      extractionEvidence: extractionEvidence.map(toEvidenceRecord),
      summaries,
      currentSummary: getCurrentWorkspaceSummary(summaries),
      intakeSession: deal.intakeSession ? toIntakeSessionRecord(deal.intakeSession) : null,
    };
  }

  async getDocument(documentId: string) {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    return document ? toDocumentRecord(document) : null;
  }

  async deleteDocument(documentId: string) {
    await prisma.document.delete({ where: { id: documentId } }).catch(() => undefined);
  }

  async listDocuments(userId: string, dealId: string) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, userId },
      select: { id: true },
    });

    if (!deal) {
      return [];
    }

    const documents = await prisma.document.findMany({
      where: { dealId },
      orderBy: { updatedAt: "desc" },
    });

    return documents.map(toDocumentRecord);
  }

  async createDeal(
    userId: string,
    input: Pick<DealRecord, "brandName" | "campaignName">,
    options?: { confirmedAt?: string | null }
  ) {
    const deal = await prisma.deal.create({
      data: {
        userId,
        brandName: input.brandName,
        campaignName: input.campaignName,
        status: "contract_received",
        paymentStatus: "not_invoiced",
        countersignStatus: "unknown",
        summary: null,
        legalDisclaimer:
          "HelloBrand provides plain-English contract understanding and negotiation prep. It is not legal advice.",
        confirmedAt:
          options?.confirmedAt === undefined
            ? new Date()
            : options.confirmedAt
              ? new Date(options.confirmedAt)
              : null,
      },
    });

    return toDealRecord(deal);
  }

  async updateDeal(userId: string, dealId: string, patch: Partial<DealRecord>) {
    const existing = await prisma.deal.findFirst({
      where: { id: dealId, userId },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        brandName: patch.brandName,
        campaignName: patch.campaignName,
        status: patch.status,
        statusBeforeArchive: patch.statusBeforeArchive,
        paymentStatus: patch.paymentStatus === "invoiced" ? "not_invoiced" : patch.paymentStatus,
        countersignStatus: patch.countersignStatus,
        summary: patch.summary,
        legalDisclaimer: patch.legalDisclaimer,
        nextDeliverableDate: patch.nextDeliverableDate
          ? new Date(patch.nextDeliverableDate)
          : patch.nextDeliverableDate === null
            ? null
            : undefined,
        analyzedAt: patch.analyzedAt
          ? new Date(patch.analyzedAt)
          : patch.analyzedAt === null
            ? null
            : undefined,
        confirmedAt: patch.confirmedAt
          ? new Date(patch.confirmedAt)
          : patch.confirmedAt === null
            ? null
            : undefined,
      },
    });

    if (patch.paymentStatus) {
      await prisma.paymentRecord.upsert({
        where: { dealId },
        update: {
          status: patch.paymentStatus === "invoiced" ? "not_invoiced" : patch.paymentStatus,
        },
        create: {
          dealId,
          status: patch.paymentStatus === "invoiced" ? "not_invoiced" : patch.paymentStatus,
        },
      });
    }

    return toDealRecord(deal);
  }

  async deleteDeal(userId: string, dealId: string) {
    const existing = await prisma.deal.findFirst({
      where: { id: dealId, userId },
      select: {
        id: true,
        documents: {
          select: {
            storagePath: true,
          },
        },
      },
    });

    if (!existing) {
      return false;
    }

    const anonymousSessions = await prisma.anonymousAnalysisSession.findMany({
      where: { claimedDealId: dealId },
      select: {
        id: true,
        storagePath: true,
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.appNotification.deleteMany({
        where: {
          userId,
          dealId,
        },
      });

      await tx.anonymousAnalysisSession.deleteMany({
        where: {
          claimedDealId: dealId,
        },
      });

      await tx.deal.delete({
        where: { id: dealId },
      });
    });

    await Promise.all(
      [
        ...existing.documents.map((document) => document.storagePath),
        ...anonymousSessions
          .map((session) => session.storagePath)
          .filter((storagePath): storagePath is string => Boolean(storagePath)),
      ].map((storagePath) => deleteStoredBytes(storagePath))
    );

    return true;
  }

  async createDocument(document: Omit<DocumentRecord, "id" | "createdAt" | "updatedAt">) {
    const next = await prisma.document.create({
      data: {
        dealId: document.dealId,
        userId: document.userId,
        fileName: document.fileName,
        mimeType: document.mimeType,
        storagePath: document.storagePath,
        fileSizeBytes: document.fileSizeBytes,
        checksumSha256: document.checksumSha256,
        processingStatus: document.processingStatus,
        rawText: document.rawText,
        normalizedText: document.normalizedText,
        documentKind: document.documentKind,
        classificationConfidence: document.classificationConfidence,
        sourceType: document.sourceType,
        errorMessage: document.errorMessage,
        processingRunId: document.processingRunId,
        processingRunStateJson: toNullableJsonValue(document.processingRunStateJson),
        processingStartedAt: document.processingStartedAt
          ? new Date(document.processingStartedAt)
          : null,
      },
    });

    return toDocumentRecord(next);
  }

  async listInvoiceRecords(userId: string) {
    const records = await prisma.invoiceRecord.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
    });

    return records.map(toInvoiceRecord);
  }

  async getInvoiceRecord(userId: string, dealId: string) {
    const record = await prisma.invoiceRecord.findFirst({
      where: { userId, dealId },
    });

    return record ? toInvoiceRecord(record) : null;
  }

  async listInvoiceDeliveryRecords(userId: string, dealId: string) {
    const records = await prisma.invoiceDeliveryRecord.findMany({
      where: { userId, dealId },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    });

    return records.map(toInvoiceDeliveryRecord);
  }

  async upsertInvoiceRecord(
    userId: string,
    dealId: string,
    patch: Omit<InvoiceRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">
  ) {
    const record = await prisma.invoiceRecord.upsert({
      where: { dealId },
      update: {
        invoiceNumber: patch.invoiceNumber,
        status: patch.status,
        draftSavedAt: patch.draftSavedAt ? new Date(patch.draftSavedAt) : null,
        finalizedAt: patch.finalizedAt ? new Date(patch.finalizedAt) : null,
        sentAt: patch.sentAt ? new Date(patch.sentAt) : null,
        invoiceDate: patch.invoiceDate ? new Date(patch.invoiceDate) : null,
        dueDate: patch.dueDate ? new Date(patch.dueDate) : null,
        currency: patch.currency,
        subtotal: patch.subtotal,
        notes: patch.notes,
        billToJson: toJsonValue(patch.billTo),
        issuerJson: toJsonValue(patch.issuer),
        lineItemsJson: toJsonValue(patch.lineItems),
        pdfDocumentId: patch.pdfDocumentId,
        manualNumberOverride: patch.manualNumberOverride,
        lastSentThreadId: patch.lastSentThreadId,
        lastSentMessageId: patch.lastSentMessageId,
        lastSentAccountId: patch.lastSentAccountId,
        lastSentToEmail: patch.lastSentToEmail,
      },
      create: {
        dealId,
        userId,
        invoiceNumber: patch.invoiceNumber,
        status: patch.status,
        draftSavedAt: patch.draftSavedAt ? new Date(patch.draftSavedAt) : null,
        finalizedAt: patch.finalizedAt ? new Date(patch.finalizedAt) : null,
        sentAt: patch.sentAt ? new Date(patch.sentAt) : null,
        invoiceDate: patch.invoiceDate ? new Date(patch.invoiceDate) : null,
        dueDate: patch.dueDate ? new Date(patch.dueDate) : null,
        currency: patch.currency,
        subtotal: patch.subtotal,
        notes: patch.notes,
        billToJson: toJsonValue(patch.billTo),
        issuerJson: toJsonValue(patch.issuer),
        lineItemsJson: toJsonValue(patch.lineItems),
        pdfDocumentId: patch.pdfDocumentId,
        manualNumberOverride: patch.manualNumberOverride,
        lastSentThreadId: patch.lastSentThreadId,
        lastSentMessageId: patch.lastSentMessageId,
        lastSentAccountId: patch.lastSentAccountId,
        lastSentToEmail: patch.lastSentToEmail,
      },
    });

    return toInvoiceRecord(record);
  }

  async deleteInvoiceRecord(userId: string, dealId: string) {
    await prisma.invoiceRecord.deleteMany({
      where: { userId, dealId },
    });
  }

  async createInvoiceDeliveryRecord(
    userId: string,
    dealId: string,
    patch: Omit<InvoiceDeliveryRecord, "id" | "dealId" | "userId" | "createdAt">
  ) {
    const record = await prisma.invoiceDeliveryRecord.create({
      data: {
        invoiceId: patch.invoiceId,
        dealId,
        userId,
        provider: patch.provider,
        threadId: patch.threadId,
        messageId: patch.messageId,
        accountId: patch.accountId,
        toEmail: patch.toEmail,
        subject: patch.subject,
        status: patch.status,
        errorMessage: patch.errorMessage,
        sentAt: new Date(patch.sentAt),
      },
    });

    return toInvoiceDeliveryRecord(record);
  }

  async listInvoiceReminderTouchpoints(userId: string, options?: { dealId?: string }) {
    const rows = await prisma.invoiceReminderTouchpoint.findMany({
      where: {
        userId,
        ...(options?.dealId ? { dealId: options.dealId } : {}),
      },
      orderBy: [{ sendOn: "asc" }],
    });

    return rows.map(toInvoiceReminderTouchpointRecord);
  }

  async upsertInvoiceReminderTouchpoints(
    userId: string,
    dealId: string,
    touchpoints: Array<
      Omit<InvoiceReminderTouchpointRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">
    >
  ) {
    const saved = await prisma.$transaction(
      touchpoints.map((touchpoint) =>
        prisma.invoiceReminderTouchpoint.upsert({
          where: {
            dealId_offsetDays: {
              dealId,
              offsetDays: touchpoint.offsetDays,
            },
          },
          update: {
            anchorDate: new Date(touchpoint.anchorDate),
            sendOn: new Date(touchpoint.sendOn),
            status: touchpoint.status,
            notificationId: touchpoint.notificationId,
          },
          create: {
            dealId,
            userId,
            anchorDate: new Date(touchpoint.anchorDate),
            offsetDays: touchpoint.offsetDays,
            sendOn: new Date(touchpoint.sendOn),
            status: touchpoint.status,
            notificationId: touchpoint.notificationId,
          },
        })
      )
    );

    return saved.map(toInvoiceReminderTouchpointRecord);
  }

  async updateInvoiceReminderTouchpoint(
    id: string,
    patch: Partial<
      Omit<InvoiceReminderTouchpointRecord, "id" | "dealId" | "userId" | "createdAt" | "updatedAt">
    >
  ) {
    const row = await prisma.invoiceReminderTouchpoint.update({
      where: { id },
      data: {
        anchorDate: patch.anchorDate ? new Date(patch.anchorDate) : undefined,
        offsetDays: patch.offsetDays,
        sendOn: patch.sendOn ? new Date(patch.sendOn) : undefined,
        status: patch.status,
        notificationId: patch.notificationId,
      },
    });

    return toInvoiceReminderTouchpointRecord(row);
  }

  async updateDocument(documentId: string, patch: Partial<DocumentRecord>) {
    try {
      const next = await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: patch.processingStatus,
          fileSizeBytes: patch.fileSizeBytes,
          checksumSha256: patch.checksumSha256,
          rawText: patch.rawText,
          normalizedText: patch.normalizedText,
          documentKind: patch.documentKind,
          classificationConfidence: patch.classificationConfidence,
          errorMessage: patch.errorMessage,
          processingRunId: patch.processingRunId,
          processingRunStateJson:
            patch.processingRunStateJson === undefined
              ? undefined
              : toNullableJsonValue(patch.processingRunStateJson),
          processingStartedAt:
            patch.processingStartedAt === undefined
              ? undefined
              : patch.processingStartedAt
                ? new Date(patch.processingStartedAt)
                : null,
        },
      });

      return toDocumentRecord(next);
    } catch {
      return null;
    }
  }

  async replaceDocumentSections(
    documentId: string,
    sections: Omit<DocumentSectionRecord, "id" | "documentId" | "createdAt">[]
  ) {
    await prisma.documentSection.deleteMany({ where: { documentId } });
    if (sections.length > 0) {
      await prisma.documentSection.createMany({
        data: sections.map((section) => ({
          documentId,
          title: section.title,
          content: section.content,
          chunkIndex: section.chunkIndex,
          pageRange: section.pageRange,
        })),
      });
    }

    const saved = await prisma.documentSection.findMany({
      where: { documentId },
      orderBy: { chunkIndex: "asc" },
    });

    return saved.map(toSectionRecord);
  }

  async listDocumentSections(documentId: string) {
    const sections = await prisma.documentSection.findMany({
      where: { documentId },
      orderBy: { chunkIndex: "asc" },
    });

    return sections.map(toSectionRecord);
  }

  async createDocumentRun(run: Omit<DocumentRunRecord, "createdAt" | "updatedAt">) {
    const saved = await prisma.documentRun.create({
      data: {
        id: run.id,
        documentId: run.documentId,
        status: run.status,
        stepStateJson: toJsonValue(run.stepStateJson),
        startedAt: run.startedAt ? new Date(run.startedAt) : null,
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
        failedAt: run.failedAt ? new Date(run.failedAt) : null,
        failureMessage: run.failureMessage,
      },
    });

    return toDocumentRunRecord(saved);
  }

  async updateDocumentRun(
    runId: string,
    patch: Partial<Omit<DocumentRunRecord, "id" | "documentId" | "createdAt" | "updatedAt">>
  ) {
    try {
      const saved = await prisma.documentRun.update({
        where: { id: runId },
        data: {
          status: patch.status,
          stepStateJson:
            patch.stepStateJson === undefined ? undefined : toJsonValue(patch.stepStateJson),
          startedAt:
            patch.startedAt === undefined
              ? undefined
              : patch.startedAt
                ? new Date(patch.startedAt)
                : null,
          completedAt:
            patch.completedAt === undefined
              ? undefined
              : patch.completedAt
                ? new Date(patch.completedAt)
                : null,
          failedAt:
            patch.failedAt === undefined
              ? undefined
              : patch.failedAt
                ? new Date(patch.failedAt)
                : null,
          failureMessage: patch.failureMessage === undefined ? undefined : patch.failureMessage,
        },
      });

      return toDocumentRunRecord(saved);
    } catch {
      return null;
    }
  }

  async getDocumentRun(runId: string) {
    const run = await prisma.documentRun.findUnique({ where: { id: runId } });
    return run ? toDocumentRunRecord(run) : null;
  }

  async listDocumentRuns(documentId: string) {
    const runs = await prisma.documentRun.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });

    return runs.map(toDocumentRunRecord);
  }

  async createDocumentArtifact(artifact: Omit<DocumentArtifactRecord, "id" | "createdAt">) {
    const saved = await prisma.documentArtifact.create({
      data: {
        documentId: artifact.documentId,
        runId: artifact.runId,
        step: artifact.step,
        kind: artifact.kind,
        processor: artifact.processor,
        payload: toNullableJsonValue(artifact.payload),
      },
    });

    return toDocumentArtifactRecord(saved);
  }

  async listDocumentArtifacts(documentId: string, options?: { runId?: string }) {
    const artifacts = await prisma.documentArtifact.findMany({
      where: {
        documentId,
        runId: options?.runId,
      },
      orderBy: { createdAt: "desc" },
    });

    return artifacts.map(toDocumentArtifactRecord);
  }

  async replaceDocumentFieldEvidence(
    documentId: string,
    runId: string,
    evidence: Omit<DocumentFieldEvidenceRecord, "id" | "documentId" | "runId" | "createdAt">[]
  ) {
    await prisma.documentFieldEvidence.deleteMany({
      where: { documentId, runId },
    });

    if (evidence.length > 0) {
      await prisma.documentFieldEvidence.createMany({
        data: evidence.map((entry) => ({
          documentId,
          runId,
          fieldPath: entry.fieldPath,
          snippet: entry.snippet,
          sourceType: entry.sourceType,
          sectionId: entry.sectionId,
          artifactId: entry.artifactId,
          confidence: entry.confidence,
        })),
      });
    }

    const saved = await prisma.documentFieldEvidence.findMany({
      where: { documentId, runId },
      orderBy: { createdAt: "desc" },
    });

    return saved.map(toDocumentFieldEvidenceRecord);
  }

  async listDocumentFieldEvidence(
    documentId: string,
    options?: { runId?: string; fieldPath?: string }
  ) {
    const evidence = await prisma.documentFieldEvidence.findMany({
      where: {
        documentId,
        runId: options?.runId,
        fieldPath: options?.fieldPath,
      },
      orderBy: { createdAt: "desc" },
    });

    return evidence.map(toDocumentFieldEvidenceRecord);
  }

  async replaceDocumentReviewItems(
    documentId: string,
    runId: string,
    items: Omit<
      DocumentReviewItemRecord,
      "id" | "documentId" | "runId" | "createdAt" | "updatedAt"
    >[]
  ) {
    await prisma.documentReviewItem.deleteMany({
      where: { documentId, runId },
    });

    if (items.length > 0) {
      await prisma.documentReviewItem.createMany({
        data: items.map((entry) => ({
          documentId,
          runId,
          fieldPath: entry.fieldPath,
          status: entry.status,
          reason: entry.reason,
          title: entry.title,
          detail: entry.detail,
          confidence: entry.confidence,
          suggestedValue: toNullableJsonValue(entry.suggestedValue),
          currentValue: toNullableJsonValue(entry.currentValue),
          sectionId: entry.sectionId,
          artifactId: entry.artifactId,
        })),
      });
    }

    const saved = await prisma.documentReviewItem.findMany({
      where: { documentId, runId },
      orderBy: { createdAt: "desc" },
    });

    return saved.map(toDocumentReviewItemRecord);
  }

  async listDocumentReviewItems(
    documentId: string,
    options?: { runId?: string; status?: DocumentReviewItemRecord["status"] }
  ) {
    const items = await prisma.documentReviewItem.findMany({
      where: {
        documentId,
        runId: options?.runId,
        status: options?.status,
      },
      orderBy: { createdAt: "desc" },
    });

    return items.map(toDocumentReviewItemRecord);
  }

  async upsertExtractionResult(
    documentId: string,
    result: Omit<ExtractionResultRecord, "id" | "documentId" | "createdAt">
  ) {
    const saved = await prisma.extractionResult.upsert({
      where: { documentId },
      update: {
        schemaVersion: result.schemaVersion,
        model: result.model,
        data: toJsonValue(result.data),
        confidence: result.confidence,
        conflicts: toJsonValue(result.conflicts),
      },
      create: {
        documentId,
        schemaVersion: result.schemaVersion,
        model: result.model,
        data: toJsonValue(result.data),
        confidence: result.confidence,
        conflicts: toJsonValue(result.conflicts),
      },
    });

    return toExtractionResultRecord(saved);
  }

  async getExtractionResult(documentId: string) {
    const result = await prisma.extractionResult.findUnique({
      where: { documentId },
    });

    return result ? toExtractionResultRecord(result) : null;
  }

  async replaceExtractionEvidence(
    documentId: string,
    evidence: Omit<ExtractionEvidenceRecord, "id" | "documentId" | "createdAt">[]
  ) {
    await prisma.extractionEvidence.deleteMany({ where: { documentId } });
    if (evidence.length > 0) {
      await prisma.extractionEvidence.createMany({
        data: evidence.map((entry) => ({
          documentId,
          fieldPath: entry.fieldPath,
          snippet: entry.snippet,
          sectionId: entry.sectionId,
          confidence: entry.confidence,
        })),
      });
    }

    const saved = await prisma.extractionEvidence.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });

    return saved.map(toEvidenceRecord);
  }

  async listExtractionEvidence(documentId: string) {
    const evidence = await prisma.extractionEvidence.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });

    return evidence.map(toEvidenceRecord);
  }

  async saveSummary(dealId: string, documentId: string | null, summary: SummaryRecordInput) {
    const normalized = normalizeSummaryInput(summary);
    const saved = await prisma.$transaction(async (tx) => {
      if (normalized.isCurrent) {
        await tx.summary.updateMany({
          where: {
            dealId,
            summaryType: { not: null },
          },
          data: {
            isCurrent: false,
          },
        });
      }

      return tx.summary.create({
        data: {
          dealId,
          documentId,
          body: normalized.body,
          version: normalized.version,
          summaryType: normalized.summaryType ?? undefined,
          source: normalized.source ?? undefined,
          parentSummaryId: normalized.parentSummaryId ?? null,
          isCurrent: normalized.isCurrent ?? false,
        },
      });
    });

    return toSummaryRecord(saved);
  }

  async listSummaryHistory(dealId: string) {
    const summaries = await prisma.summary.findMany({
      where: {
        dealId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return getWorkspaceSummaries(summaries.map(toSummaryRecord));
  }

  async getLatestSummaryByType(dealId: string, summaryType: SummaryType) {
    const history = await this.listSummaryHistory(dealId);
    return getLatestSummaryByTypeFromHistory(history, summaryType);
  }

  async restoreSummary(dealId: string, summaryId: string) {
    const restored = await prisma.$transaction(async (tx) => {
      const existing = await tx.summary.findFirst({
        where: {
          id: summaryId,
          dealId,
          summaryType: { not: null },
        },
      });

      if (!existing) {
        return null;
      }

      await tx.summary.updateMany({
        where: {
          dealId,
          summaryType: { not: null },
        },
        data: {
          isCurrent: false,
        },
      });

      return tx.summary.update({
        where: {
          id: summaryId,
        },
        data: {
          isCurrent: true,
        },
      });
    });

    return restored ? toSummaryRecord(restored) : null;
  }

  async createJob(job: Omit<JobRecord, "id" | "createdAt" | "updatedAt">) {
    const saved = await prisma.job.create({
      data: {
        dealId: job.dealId,
        documentId: job.documentId,
        type: job.type,
        status: job.status,
        attemptCount: job.attemptCount,
        failureReason: job.failureReason,
      },
    });

    return toJobRecord(saved);
  }

  async updateJob(jobId: string, patch: Partial<JobRecord>) {
    try {
      const saved = await prisma.job.update({
        where: { id: jobId },
        data: {
          type: patch.type,
          status: patch.status,
          attemptCount: patch.attemptCount,
          failureReason: patch.failureReason,
        },
      });

      return toJobRecord(saved);
    } catch {
      return null;
    }
  }

  async upsertTerms(
    dealId: string,
    patch: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">
  ) {
    const jsonPatch = {
      deliverables: toJsonValue(patch.deliverables),
      usageChannels: toJsonValue(patch.usageChannels),
      competitorCategories: toJsonValue(patch.competitorCategories),
      restrictedCategories: toJsonValue(patch.restrictedCategories),
      campaignDateWindow: toNullableJsonValue(patch.campaignDateWindow),
      disclosureObligations: toJsonValue(patch.disclosureObligations),
      manuallyEditedFields: toJsonValue(patch.manuallyEditedFields),
      briefData: toNullableJsonValue(patch.briefData),
      pendingExtraction: toNullableJsonValue(patch.pendingExtraction),
    };

    const saved = await prisma.dealTerms.upsert({
      where: { dealId },
      update: {
        ...patch,
        ...jsonPatch,
      },
      create: {
        dealId,
        ...patch,
        ...jsonPatch,
      },
    });

    return toDealTermsRecord(saved);
  }

  async savePendingExtraction(dealId: string, data: unknown) {
    await prisma.dealTerms.update({
      where: { dealId },
      data: { pendingExtraction: toNullableJsonValue(data) },
    });
  }

  async replaceRiskFlagsForDocument(
    dealId: string,
    documentId: string,
    flags: Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">[]
  ) {
    await prisma.riskFlag.deleteMany({
      where: {
        dealId,
        sourceDocumentId: documentId,
      },
    });

    if (flags.length > 0) {
      await prisma.riskFlag.createMany({
        data: flags.map((flag) => ({
          dealId,
          category: flag.category,
          title: flag.title,
          detail: flag.detail,
          severity: flag.severity,
          suggestedAction: flag.suggestedAction,
          evidence: flag.evidence,
          sourceDocumentId: flag.sourceDocumentId,
        })),
      });
    }

    const saved = await prisma.riskFlag.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
    });

    return saved.map(toRiskFlagRecord);
  }

  async listRiskFlagsForDocument(dealId: string, documentId: string) {
    const flags = await prisma.riskFlag.findMany({
      where: {
        dealId,
        sourceDocumentId: documentId,
      },
      orderBy: { createdAt: "desc" },
    });

    return flags.map(toRiskFlagRecord);
  }

  async listAssistantThreads(
    userId: string,
    options?: { scope?: AssistantThreadRecord["scope"]; dealId?: string | null }
  ) {
    const threads = await prisma.assistantThread.findMany({
      where: {
        userId,
        scope: options?.scope,
        dealId: options?.dealId === undefined ? undefined : options.dealId,
      },
      orderBy: { updatedAt: "desc" },
    });

    return threads.map(toAssistantThreadRecord);
  }

  async getAssistantThread(userId: string, threadId: string) {
    const thread = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
    });

    return thread ? toAssistantThreadRecord(thread) : null;
  }

  async createAssistantThread(
    userId: string,
    input: Pick<AssistantThreadRecord, "scope" | "dealId" | "title" | "summary">
  ) {
    const thread = await prisma.assistantThread.create({
      data: {
        userId,
        dealId: input.dealId ?? null,
        scope: input.scope,
        title: input.title,
        summary: input.summary ?? null,
      },
    });

    return toAssistantThreadRecord(thread);
  }

  async updateAssistantThread(
    userId: string,
    threadId: string,
    patch: Partial<Pick<AssistantThreadRecord, "title" | "summary">>
  ) {
    const existing = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const thread = await prisma.assistantThread.update({
      where: { id: threadId },
      data: {
        title: patch.title,
        summary: patch.summary,
      },
    });

    return toAssistantThreadRecord(thread);
  }

  async deleteAssistantThread(userId: string, threadId: string) {
    const existing = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    await prisma.assistantThread.delete({
      where: { id: threadId },
    });

    return true;
  }

  async listAssistantMessages(userId: string, threadId: string) {
    const thread = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });

    if (!thread) {
      return [];
    }

    const messages = await prisma.assistantMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });

    return messages.map(toAssistantMessageRecord);
  }

  async saveAssistantMessage(
    userId: string,
    threadId: string,
    input: Pick<AssistantMessageRecord, "role" | "content" | "parts"> & { id?: string }
  ) {
    const thread = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    });

    if (!thread) {
      return null;
    }

    const message = await prisma.assistantMessage.upsert({
      where: { id: input.id ?? "__create__" },
      update: {
        role: input.role,
        content: input.content,
        parts: toJsonValue(input.parts),
      },
      create: {
        id: input.id,
        threadId,
        role: input.role,
        content: input.content,
        parts: toJsonValue(input.parts),
      },
    });

    if (input.role === "assistant" && input.content.trim().length > 0) {
      await prisma.assistantThread.update({
        where: { id: threadId },
        data: {
          summary: input.content.slice(0, 280),
        },
      });
    }

    return toAssistantMessageRecord(message);
  }

  async getAssistantContextSnapshot(userId: string, key: string) {
    const snapshot = await prisma.assistantContextSnapshot.findFirst({
      where: { userId, key },
    });

    return snapshot ? toAssistantContextSnapshotRecord(snapshot) : null;
  }

  async saveAssistantContextSnapshot(
    userId: string,
    input: Pick<
      AssistantContextSnapshotRecord,
      "dealId" | "scope" | "key" | "version" | "summary" | "payload"
    >
  ) {
    const snapshot = await prisma.assistantContextSnapshot.upsert({
      where: {
        userId_key: {
          userId,
          key: input.key,
        },
      },
      update: {
        dealId: input.dealId ?? null,
        scope: input.scope,
        version: input.version,
        summary: input.summary,
        payload: toJsonValue(input.payload),
      },
      create: {
        userId,
        dealId: input.dealId ?? null,
        scope: input.scope,
        key: input.key,
        version: input.version,
        summary: input.summary,
        payload: toJsonValue(input.payload),
      },
    });

    return toAssistantContextSnapshotRecord(snapshot);
  }

  async createBatch(
    userId: string,
    groups: Array<{ label: string; confidence: number; documentIds: string[] }>
  ): Promise<IntakeBatchRecord> {
    const batch = await prisma.intakeBatch.create({
      data: {
        userId,
        status: "review",
        groups: {
          create: groups.map((group) => ({
            label: group.label,
            confidence: group.confidence,
            documentIds: group.documentIds,
            status: "pending",
          })),
        },
      },
      include: { groups: true },
    });

    return toBatchRecord(batch, batch.groups);
  }

  async getBatch(userId: string, batchId: string): Promise<IntakeBatchRecord | null> {
    const batch = await prisma.intakeBatch.findFirst({
      where: { id: batchId, userId },
      include: { groups: { orderBy: { createdAt: "asc" } } },
    });

    if (!batch) return null;
    return toBatchRecord(batch, batch.groups);
  }

  async updateBatchGroup(
    groupId: string,
    patch: Partial<
      Pick<IntakeBatchGroupRecord, "label" | "status" | "intakeSessionId" | "documentIds">
    >
  ) {
    const saved = await prisma.intakeBatchGroup.update({
      where: { id: groupId },
      data: {
        label: patch.label,
        status: patch.status,
        intakeSessionId: patch.intakeSessionId,
        documentIds: patch.documentIds,
      },
    });

    return toBatchGroupRecord(saved);
  }

  async updateBatchStatus(batchId: string, status: string) {
    await prisma.intakeBatch.update({
      where: { id: batchId },
      data: { status },
    });
  }
}
