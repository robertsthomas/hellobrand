import { randomUUID } from "node:crypto";

import { normalizeDealCategory } from "@/lib/conflict-intelligence";
import { prisma } from "@/lib/prisma";
import type {
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
  createdAt: Date;
}): RiskFlagRecord {
  return {
    ...flag,
    category: flag.category as RiskFlagRecord["category"],
    severity: flag.severity as RiskFlagRecord["severity"],
    evidence: toStringArray(flag.evidence),
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
        summaries: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!deal) {
      return null;
    }

    const documentIds = deal.documents.map((document) => document.id);
    const [sections, extractionResults, extractionEvidence] = await Promise.all([
      prisma.documentSection.findMany({
        where: { documentId: { in: documentIds.length ? documentIds : ["__none__"] } },
        orderBy: [{ chunkIndex: "asc" }]
      }),
      prisma.extractionResult.findMany({
        where: { documentId: { in: documentIds.length ? documentIds : ["__none__"] } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.extractionEvidence.findMany({
        where: { documentId: { in: documentIds.length ? documentIds : ["__none__"] } },
        orderBy: { createdAt: "desc" }
      })
    ]);

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
      currentSummary: primarySummaries[0] ?? null
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
        data: result.data,
        confidence: result.confidence,
        conflicts: result.conflicts
      },
      create: {
        documentId,
        schemaVersion: result.schemaVersion,
        model: result.model,
        data: result.data,
        confidence: result.confidence,
        conflicts: result.conflicts
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
    const saved = await prisma.dealTerms.upsert({
      where: { dealId },
      update: {
        ...patch,
        deliverables: patch.deliverables,
        usageChannels: patch.usageChannels,
        competitorCategories: patch.competitorCategories,
        restrictedCategories: patch.restrictedCategories,
        campaignDateWindow: patch.campaignDateWindow,
        disclosureObligations: patch.disclosureObligations
      },
      create: {
        dealId,
        ...patch,
        deliverables: patch.deliverables,
        usageChannels: patch.usageChannels,
        competitorCategories: patch.competitorCategories,
        restrictedCategories: patch.restrictedCategories,
        campaignDateWindow: patch.campaignDateWindow,
        disclosureObligations: patch.disclosureObligations
      }
    });

    return toDealTermsRecord(saved);
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
}
