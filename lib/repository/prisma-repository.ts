import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { normalizeDealCategory } from "@/lib/conflict-intelligence";
import { prisma } from "@/lib/prisma";
import type {
  AssistantContextSnapshotRecord,
  AssistantMessageRecord,
  AssistantThreadRecord,
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
  PaymentRecord,
  RiskFlagRecord,
  SummaryRecord
} from "@/lib/types";

function iso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJsonValue(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value == null ? Prisma.JsonNull : toJsonValue(value);
}

function toDealRecord(deal: {
  id: string;
  userId: string;
  brandName: string;
  campaignName: string;
  status: string;
  paymentStatus: string;
  countersignStatus: string;
  summary: string | null;
  legalDisclaimer: string;
  nextDeliverableDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  analyzedAt: Date | null;
  confirmedAt: Date | null;
}): DealRecord {
  return {
    ...deal,
    nextDeliverableDate: iso(deal.nextDeliverableDate),
    createdAt: iso(deal.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(deal.updatedAt) ?? new Date().toISOString(),
    analyzedAt: iso(deal.analyzedAt),
    confirmedAt: iso(deal.confirmedAt)
  } as DealRecord;
}

function toDocumentRecord(document: {
  id: string;
  dealId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  processingStatus: string;
  rawText: string | null;
  normalizedText: string | null;
  documentKind: string;
  classificationConfidence: number | null;
  sourceType: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentRecord {
  return {
    ...document,
    processingStatus: document.processingStatus as DocumentRecord["processingStatus"],
    sourceType: document.sourceType as DocumentRecord["sourceType"],
    documentKind: document.documentKind as DocumentRecord["documentKind"],
    createdAt: iso(document.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(document.updatedAt) ?? new Date().toISOString()
  };
}

function toDealTermsRecord(terms: {
  id: string;
  dealId: string;
  brandName: string | null;
  agencyName: string | null;
  creatorName: string | null;
  campaignName: string | null;
  paymentAmount: number | null;
  currency: string | null;
  paymentTerms: string | null;
  paymentStructure: string | null;
  netTermsDays: number | null;
  paymentTrigger: string | null;
  deliverables: unknown;
  usageRights: string | null;
  usageRightsOrganicAllowed: boolean | null;
  usageRightsPaidAllowed: boolean | null;
  whitelistingAllowed: boolean | null;
  usageDuration: string | null;
  usageTerritory: string | null;
  usageChannels: unknown;
  exclusivity: string | null;
  exclusivityApplies: boolean | null;
  exclusivityCategory: string | null;
  exclusivityDuration: string | null;
  exclusivityRestrictions: string | null;
  brandCategory: string | null;
  competitorCategories: unknown;
  restrictedCategories: unknown;
  campaignDateWindow: unknown;
  disclosureObligations: unknown;
  revisions: string | null;
  revisionRounds: number | null;
  termination: string | null;
  terminationAllowed: boolean | null;
  terminationNotice: string | null;
  terminationConditions: string | null;
  governingLaw: string | null;
  notes: string | null;
  manuallyEditedFields: unknown;
  briefData: unknown;
  pendingExtraction: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DealTermsRecord {
  return {
    ...terms,
    deliverables: Array.isArray(terms.deliverables)
      ? (terms.deliverables as DealTermsRecord["deliverables"])
      : [],
    usageChannels: toStringArray(terms.usageChannels),
    brandCategory: normalizeDealCategory(terms.brandCategory),
    competitorCategories: toStringArray(terms.competitorCategories),
    restrictedCategories: toStringArray(terms.restrictedCategories),
    campaignDateWindow:
      terms.campaignDateWindow && typeof terms.campaignDateWindow === "object"
        ? (terms.campaignDateWindow as DealTermsRecord["campaignDateWindow"])
        : null,
    disclosureObligations: Array.isArray(terms.disclosureObligations)
      ? (terms.disclosureObligations as DealTermsRecord["disclosureObligations"])
      : [],
    manuallyEditedFields: toStringArray(terms.manuallyEditedFields),
    briefData:
      terms.briefData && typeof terms.briefData === "object"
        ? (terms.briefData as DealTermsRecord["briefData"])
        : null,
    pendingExtraction:
      terms.pendingExtraction && typeof terms.pendingExtraction === "object"
        ? (terms.pendingExtraction as DealTermsRecord["pendingExtraction"])
        : null,
    createdAt: iso(terms.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(terms.updatedAt) ?? new Date().toISOString()
  };
}

function toRiskFlagRecord(flag: {
  id: string;
  dealId: string;
  category: string;
  title: string;
  detail: string;
  severity: string;
  suggestedAction: string | null;
  evidence: unknown;
  sourceDocumentId: string | null;
  sourceType?: string | null;
  sourceMessageId?: string | null;
  createdAt: Date;
}): RiskFlagRecord {
  return {
    ...flag,
    category: flag.category as RiskFlagRecord["category"],
    severity: flag.severity as RiskFlagRecord["severity"],
    evidence: toStringArray(flag.evidence),
    sourceType: (flag.sourceType as RiskFlagRecord["sourceType"]) ?? null,
    sourceMessageId: flag.sourceMessageId ?? null,
    createdAt: iso(flag.createdAt) ?? new Date().toISOString()
  };
}

function toEmailDraftRecord(draft: {
  id: string;
  dealId: string;
  intent: string;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}): EmailDraftRecord {
  return {
    ...draft,
    intent: draft.intent as DraftIntent,
    createdAt: iso(draft.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(draft.updatedAt) ?? new Date().toISOString()
  };
}

function toJobRecord(job: {
  id: string;
  dealId: string;
  documentId: string;
  type: string;
  status: string;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  failureReason: string | null;
}): JobRecord {
  return {
    ...job,
    type: job.type as JobRecord["type"],
    status: job.status as JobRecord["status"],
    createdAt: iso(job.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(job.updatedAt) ?? new Date().toISOString()
  };
}

function toSectionRecord(section: {
  id: string;
  documentId: string;
  title: string;
  content: string;
  chunkIndex: number;
  pageRange: string | null;
  createdAt: Date;
}): DocumentSectionRecord {
  return {
    ...section,
    createdAt: iso(section.createdAt) ?? new Date().toISOString()
  };
}

function toExtractionResultRecord(result: {
  id: string;
  documentId: string;
  schemaVersion: string;
  model: string;
  data: unknown;
  confidence: number | null;
  conflicts: unknown;
  createdAt: Date;
}): ExtractionResultRecord {
  return {
    ...result,
    data: result.data as ExtractionResultRecord["data"],
    conflicts: toStringArray(result.conflicts),
    createdAt: iso(result.createdAt) ?? new Date().toISOString()
  };
}

function toEvidenceRecord(entry: {
  id: string;
  documentId: string;
  fieldPath: string;
  snippet: string;
  sectionId: string | null;
  confidence: number | null;
  createdAt: Date;
}): ExtractionEvidenceRecord {
  return {
    ...entry,
    createdAt: iso(entry.createdAt) ?? new Date().toISOString()
  };
}

function toSummaryRecord(summary: {
  id: string;
  dealId: string;
  documentId: string | null;
  body: string;
  version: string;
  createdAt: Date;
}): SummaryRecord {
  return {
    ...summary,
    createdAt: iso(summary.createdAt) ?? new Date().toISOString()
  };
}

function toAssistantThreadRecord(thread: {
  id: string;
  userId: string;
  dealId: string | null;
  scope: string;
  title: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AssistantThreadRecord {
  return {
    id: thread.id,
    userId: thread.userId,
    dealId: thread.dealId,
    scope: thread.scope as AssistantThreadRecord["scope"],
    title: thread.title,
    summary: thread.summary,
    createdAt: iso(thread.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(thread.updatedAt) ?? new Date().toISOString()
  };
}

function toAssistantMessageRecord(message: {
  id: string;
  threadId: string;
  role: string;
  content: string;
  parts: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AssistantMessageRecord {
  return {
    id: message.id,
    threadId: message.threadId,
    role: message.role as AssistantMessageRecord["role"],
    content: message.content,
    parts: Array.isArray(message.parts) ? message.parts : [],
    createdAt: iso(message.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(message.updatedAt) ?? new Date().toISOString()
  };
}

function toAssistantContextSnapshotRecord(snapshot: {
  id: string;
  userId: string;
  dealId: string | null;
  scope: string;
  key: string;
  version: string;
  summary: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AssistantContextSnapshotRecord {
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    dealId: snapshot.dealId,
    scope: snapshot.scope as AssistantContextSnapshotRecord["scope"],
    key: snapshot.key,
    version: snapshot.version,
    summary: snapshot.summary,
    payload:
      snapshot.payload && typeof snapshot.payload === "object"
        ? (snapshot.payload as Record<string, unknown>)
        : {},
    createdAt: iso(snapshot.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(snapshot.updatedAt) ?? new Date().toISOString()
  };
}

function toBatchGroupRecord(group: {
  id: string;
  batchId: string;
  intakeSessionId: string | null;
  label: string;
  confidence: number | null;
  documentIds: unknown;
  status: string;
  createdAt: Date;
}): IntakeBatchGroupRecord {
  return {
    id: group.id,
    batchId: group.batchId,
    intakeSessionId: group.intakeSessionId,
    label: group.label,
    confidence: group.confidence,
    documentIds: toStringArray(group.documentIds),
    status: group.status as IntakeBatchGroupRecord["status"],
    createdAt: iso(group.createdAt) ?? new Date().toISOString()
  };
}

function toBatchRecord(
  batch: {
    id: string;
    userId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  groups: Array<{
    id: string;
    batchId: string;
    intakeSessionId: string | null;
    label: string;
    confidence: number | null;
    documentIds: unknown;
    status: string;
    createdAt: Date;
  }>
): IntakeBatchRecord {
  return {
    id: batch.id,
    userId: batch.userId,
    status: batch.status as IntakeBatchRecord["status"],
    createdAt: iso(batch.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(batch.updatedAt) ?? new Date().toISOString(),
    groups: groups.map(toBatchGroupRecord)
  };
}

function isPrimarySummaryVersion(version: string) {
  return !version.startsWith("intake-normalized:");
}

function sortNewestFirst<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    (right.updatedAt ?? right.createdAt ?? "").localeCompare(
      left.updatedAt ?? left.createdAt ?? ""
    )
  );
}

export class PrismaRepository {
  async listDeals(userId: string) {
    const deals = await prisma.deal.findMany({
      where: {
        userId,
        confirmedAt: { not: null }
      },
      orderBy: { updatedAt: "desc" }
    });

    return deals.map(toDealRecord);
  }

  async getDealAggregate(userId: string, dealId: string): Promise<DealAggregate | null> {
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        userId
      },
      include: {
        documents: { orderBy: { updatedAt: "desc" } },
        terms: true,
        paymentRecord: true,
        riskFlags: { orderBy: { createdAt: "desc" } },
        emailDrafts: { orderBy: { updatedAt: "desc" } },
        jobs: { orderBy: { updatedAt: "desc" } },
        summaries: { orderBy: { createdAt: "desc" } },
        intakeSession: true
      }
    });

    if (!deal) {
      return null;
    }

    const documentIds = deal.documents.map((document) => document.id);
    const [sections, extractionResults, extractionEvidence] =
      documentIds.length > 0
        ? await prisma.$transaction([
            prisma.documentSection.findMany({
              where: { documentId: { in: documentIds } },
              orderBy: [{ chunkIndex: "asc" }]
            }),
            prisma.extractionResult.findMany({
              where: { documentId: { in: documentIds } },
              orderBy: { createdAt: "desc" }
            }),
            prisma.extractionEvidence.findMany({
              where: { documentId: { in: documentIds } },
              orderBy: { createdAt: "desc" }
            })
          ])
        : [[], [], []];

    const documents = deal.documents.map(toDocumentRecord);
    const summaries = deal.summaries.map(toSummaryRecord);
    const primarySummaries = summaries.filter((summary) =>
      isPrimarySummaryVersion(summary.version)
    );

    return {
      deal: toDealRecord(deal),
      latestDocument: documents[0] ?? null,
      documents,
      terms: deal.terms ? toDealTermsRecord(deal.terms) : null,
      conflictResults: [],
      paymentRecord: deal.paymentRecord
        ? {
            ...deal.paymentRecord,
            status: deal.paymentRecord.status as PaymentRecord["status"],
            invoiceDate: iso(deal.paymentRecord.invoiceDate),
            dueDate: iso(deal.paymentRecord.dueDate),
            paidDate: iso(deal.paymentRecord.paidDate),
            createdAt: iso(deal.paymentRecord.createdAt) ?? new Date().toISOString(),
            updatedAt: iso(deal.paymentRecord.updatedAt) ?? new Date().toISOString()
          }
        : null,
      riskFlags: deal.riskFlags.map(toRiskFlagRecord),
      emailDrafts: deal.emailDrafts.map(toEmailDraftRecord),
      jobs: deal.jobs.map(toJobRecord),
      documentSections: sections.map(toSectionRecord),
      extractionResults: extractionResults.map(toExtractionResultRecord),
      extractionEvidence: extractionEvidence.map(toEvidenceRecord),
      summaries,
      currentSummary: primarySummaries[0] ?? null,
      intakeSession: deal.intakeSession
        ? {
            id: deal.intakeSession.id,
            userId: deal.intakeSession.userId,
            dealId: deal.intakeSession.dealId,
            status: deal.intakeSession.status as import("@/lib/types").IntakeSessionStatus,
            errorMessage: deal.intakeSession.errorMessage,
            inputSource: (deal.intakeSession.inputSource ?? null) as import("@/lib/types").IntakeSessionRecord["inputSource"],
            draftBrandName: deal.intakeSession.draftBrandName,
            draftCampaignName: deal.intakeSession.draftCampaignName,
            draftNotes: deal.intakeSession.draftNotes,
            draftPastedText: deal.intakeSession.draftPastedText,
            draftPastedTextTitle: deal.intakeSession.draftPastedTextTitle,
            duplicateCheckStatus: (deal.intakeSession.duplicateCheckStatus ?? null) as import("@/lib/types").IntakeSessionRecord["duplicateCheckStatus"],
            duplicateMatchJson: deal.intakeSession.duplicateMatchJson ?? null,
            createdAt: iso(deal.intakeSession.createdAt) ?? new Date().toISOString(),
            updatedAt: iso(deal.intakeSession.updatedAt) ?? new Date().toISOString(),
            completedAt: iso(deal.intakeSession.completedAt),
            expiresAt: iso(deal.intakeSession.expiresAt)
          }
        : null
    };
  }

  async getDocument(documentId: string) {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    return document ? toDocumentRecord(document) : null;
  }

  async listDocuments(userId: string, dealId: string) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, userId },
      select: { id: true }
    });

    if (!deal) {
      return [];
    }

    const documents = await prisma.document.findMany({
      where: { dealId },
      orderBy: { updatedAt: "desc" }
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
              : null
      }
    });

    return toDealRecord(deal);
  }

  async updateDeal(userId: string, dealId: string, patch: Partial<DealRecord>) {
    const existing = await prisma.deal.findFirst({
      where: { id: dealId, userId },
      select: { id: true }
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
        paymentStatus: patch.paymentStatus,
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
            : undefined
      }
    });

    if (patch.paymentStatus) {
      await prisma.paymentRecord.upsert({
        where: { dealId },
        update: { status: patch.paymentStatus },
        create: { dealId, status: patch.paymentStatus }
      });
    }

    return toDealRecord(deal);
  }

  async deleteDeal(userId: string, dealId: string) {
    const existing = await prisma.deal.findFirst({
      where: { id: dealId, userId },
      select: { id: true }
    });

    if (!existing) {
      return false;
    }

    await prisma.deal.delete({
      where: { id: dealId }
    });

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
        processingStatus: document.processingStatus,
        rawText: document.rawText,
        normalizedText: document.normalizedText,
        documentKind: document.documentKind,
        classificationConfidence: document.classificationConfidence,
        sourceType: document.sourceType,
        errorMessage: document.errorMessage
      }
    });

    return toDocumentRecord(next);
  }

  async updateDocument(documentId: string, patch: Partial<DocumentRecord>) {
    try {
      const next = await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: patch.processingStatus,
          rawText: patch.rawText,
          normalizedText: patch.normalizedText,
          documentKind: patch.documentKind,
          classificationConfidence: patch.classificationConfidence,
          errorMessage: patch.errorMessage
        }
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
          pageRange: section.pageRange
        }))
      });
    }

    const saved = await prisma.documentSection.findMany({
      where: { documentId },
      orderBy: { chunkIndex: "asc" }
    });

    return saved.map(toSectionRecord);
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
        conflicts: toJsonValue(result.conflicts)
      },
      create: {
        documentId,
        schemaVersion: result.schemaVersion,
        model: result.model,
        data: toJsonValue(result.data),
        confidence: result.confidence,
        conflicts: toJsonValue(result.conflicts)
      }
    });

    return toExtractionResultRecord(saved);
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
          confidence: entry.confidence
        }))
      });
    }

    const saved = await prisma.extractionEvidence.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" }
    });

    return saved.map(toEvidenceRecord);
  }

  async saveSummary(
    dealId: string,
    documentId: string | null,
    summary: Omit<SummaryRecord, "id" | "dealId" | "documentId" | "createdAt">
  ) {
    const saved = await prisma.summary.create({
      data: {
        dealId,
        documentId,
        body: summary.body,
        version: summary.version
      }
    });

    return toSummaryRecord(saved);
  }

  async createJob(job: Omit<JobRecord, "id" | "createdAt" | "updatedAt">) {
    const saved = await prisma.job.create({
      data: {
        dealId: job.dealId,
        documentId: job.documentId,
        type: job.type,
        status: job.status,
        attemptCount: job.attemptCount,
        failureReason: job.failureReason
      }
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
          failureReason: patch.failureReason
        }
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
      pendingExtraction: toNullableJsonValue(patch.pendingExtraction)
    };

    const saved = await prisma.dealTerms.upsert({
      where: { dealId },
      update: {
        ...patch,
        ...jsonPatch
      },
      create: {
        dealId,
        ...patch,
        ...jsonPatch
      }
    });

    return toDealTermsRecord(saved);
  }

  async savePendingExtraction(dealId: string, data: unknown) {
    await prisma.dealTerms.update({
      where: { dealId },
      data: { pendingExtraction: toNullableJsonValue(data) }
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
        sourceDocumentId: documentId
      }
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
          sourceDocumentId: flag.sourceDocumentId
        }))
      });
    }

    const saved = await prisma.riskFlag.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" }
    });

    return saved.map(toRiskFlagRecord);
  }

  async saveEmailDraft(
    dealId: string,
    intent: DraftIntent,
    payload: Pick<EmailDraftRecord, "subject" | "body">
  ) {
    const saved = await prisma.emailDraft.upsert({
      where: {
        dealId_intent: {
          dealId,
          intent
        }
      },
      update: {
        subject: payload.subject,
        body: payload.body
      },
      create: {
        dealId,
        intent,
        subject: payload.subject,
        body: payload.body
      }
    });

    return toEmailDraftRecord(saved);
  }

  async listAssistantThreads(
    userId: string,
    options?: { scope?: AssistantThreadRecord["scope"]; dealId?: string | null }
  ) {
    const threads = await prisma.assistantThread.findMany({
      where: {
        userId,
        scope: options?.scope,
        dealId: options?.dealId === undefined ? undefined : options.dealId
      },
      orderBy: { updatedAt: "desc" }
    });

    return threads.map(toAssistantThreadRecord);
  }

  async getAssistantThread(userId: string, threadId: string) {
    const thread = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId }
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
        summary: input.summary ?? null
      }
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
      select: { id: true }
    });

    if (!existing) {
      return null;
    }

    const thread = await prisma.assistantThread.update({
      where: { id: threadId },
      data: {
        title: patch.title,
        summary: patch.summary
      }
    });

    return toAssistantThreadRecord(thread);
  }

  async deleteAssistantThread(userId: string, threadId: string) {
    const existing = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true }
    });

    if (!existing) {
      return false;
    }

    await prisma.assistantThread.delete({
      where: { id: threadId }
    });

    return true;
  }

  async listAssistantMessages(userId: string, threadId: string) {
    const thread = await prisma.assistantThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true }
    });

    if (!thread) {
      return [];
    }

    const messages = await prisma.assistantMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" }
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
      select: { id: true }
    });

    if (!thread) {
      return null;
    }

    const message = await prisma.assistantMessage.upsert({
      where: { id: input.id ?? "__create__" },
      update: {
        role: input.role,
        content: input.content,
        parts: toJsonValue(input.parts)
      },
      create: {
        id: input.id,
        threadId,
        role: input.role,
        content: input.content,
        parts: toJsonValue(input.parts)
      }
    });

    if (input.role === "assistant" && input.content.trim().length > 0) {
      await prisma.assistantThread.update({
        where: { id: threadId },
        data: {
          summary: input.content.slice(0, 280)
        }
      });
    }

    return toAssistantMessageRecord(message);
  }

  async getAssistantContextSnapshot(userId: string, key: string) {
    const snapshot = await prisma.assistantContextSnapshot.findFirst({
      where: { userId, key }
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
          key: input.key
        }
      },
      update: {
        dealId: input.dealId ?? null,
        scope: input.scope,
        version: input.version,
        summary: input.summary,
        payload: toJsonValue(input.payload)
      },
      create: {
        userId,
        dealId: input.dealId ?? null,
        scope: input.scope,
        key: input.key,
        version: input.version,
        summary: input.summary,
        payload: toJsonValue(input.payload)
      }
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
            status: "pending"
          }))
        }
      },
      include: { groups: true }
    });

    return toBatchRecord(batch, batch.groups);
  }

  async getBatch(userId: string, batchId: string): Promise<IntakeBatchRecord | null> {
    const batch = await prisma.intakeBatch.findFirst({
      where: { id: batchId, userId },
      include: { groups: { orderBy: { createdAt: "asc" } } }
    });

    if (!batch) return null;
    return toBatchRecord(batch, batch.groups);
  }

  async updateBatchGroup(
    groupId: string,
    patch: Partial<Pick<IntakeBatchGroupRecord, "label" | "status" | "intakeSessionId" | "documentIds">>
  ) {
    const saved = await prisma.intakeBatchGroup.update({
      where: { id: groupId },
      data: {
        label: patch.label,
        status: patch.status,
        intakeSessionId: patch.intakeSessionId,
        documentIds: patch.documentIds
      }
    });

    return toBatchGroupRecord(saved);
  }

  async updateBatchStatus(batchId: string, status: string) {
    await prisma.intakeBatch.update({
      where: { id: batchId },
      data: { status }
    });
  }
}
