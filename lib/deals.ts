import {
  analyzeCreatorRisks,
  buildCreatorSummary,
  classifyDocumentHeuristically,
  extractStructuredTerms,
  mergeExtractionResults,
  splitIntoSections
} from "@/lib/analysis/fallback";
import { getViewerById } from "@/lib/auth";
import {
  analyzeRisksWithLlm,
  extractSectionWithLlm,
  generateSummaryWithLlm,
  hasLlmKey
} from "@/lib/analysis/llm";
import { extractDocumentText, normalizeDocumentText } from "@/lib/documents/extract";
import { generateEmailDraft } from "@/lib/email/generate";
import { inngest } from "@/lib/inngest/client";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { syncPaymentRecordForDeal } from "@/lib/payments";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { readStoredBytes, storeUploadedBytes } from "@/lib/storage";
import type {
  DealAggregate,
  DealRecord,
  DealTermsRecord,
  DocumentKind,
  DocumentRecord,
  DraftIntent,
  ExtractionPipelineResult,
  JobType,
  Viewer
} from "@/lib/types";

function createEmptyTerms(
  deal: Pick<DealRecord, "brandName" | "campaignName">
): Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt"> {
  return {
    brandName: deal.brandName,
    agencyName: null,
    creatorName: null,
    campaignName: deal.campaignName,
    paymentAmount: null,
    currency: null,
    paymentTerms: null,
    paymentStructure: null,
    netTermsDays: null,
    paymentTrigger: null,
    deliverables: [],
    usageRights: null,
    usageRightsOrganicAllowed: null,
    usageRightsPaidAllowed: null,
    whitelistingAllowed: null,
    usageDuration: null,
    usageTerritory: null,
    usageChannels: [],
    exclusivity: null,
    exclusivityApplies: null,
    exclusivityCategory: null,
    exclusivityDuration: null,
    exclusivityRestrictions: null,
    revisions: null,
    revisionRounds: null,
    termination: null,
    terminationAllowed: null,
    terminationNotice: null,
    terminationConditions: null,
    governingLaw: null,
    notes: null
  };
}

function mergeDeliverables(
  existing: NonNullable<DealTermsRecord["deliverables"]>,
  incoming: NonNullable<DealTermsRecord["deliverables"]>
) {
  const map = new Map<string, (typeof existing)[number]>();

  for (const item of existing) {
    map.set(`${item.title}:${item.dueDate ?? "none"}`, item);
  }

  for (const item of incoming) {
    map.set(`${item.title}:${item.dueDate ?? "none"}`, item);
  }

  return Array.from(map.values()).sort((left, right) =>
    (left.dueDate ?? "").localeCompare(right.dueDate ?? "")
  );
}

function mergeTerms(
  base: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">,
  patch: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">
) {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => {
        if (key === "deliverables" || key === "usageChannels") {
          return false;
        }

        if (typeof value === "string") {
          return value.trim().length > 0;
        }

        return value !== null && value !== undefined;
      })
    ),
    deliverables: mergeDeliverables(base.deliverables, patch.deliverables),
    usageChannels: Array.from(new Set([...base.usageChannels, ...patch.usageChannels]))
  };
}

function earliestDeliverableDate(terms: Pick<DealTermsRecord, "deliverables">) {
  return (
    [...terms.deliverables]
      .filter((item) => item.dueDate)
      .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""))[0]
      ?.dueDate ?? null
  );
}

async function runStage<T>(
  dealId: string,
  documentId: string,
  type: JobType,
  work: () => Promise<T>
) {
  const repository = getRepository();
  const job = await repository.createJob({
    dealId,
    documentId,
    type,
    status: "processing",
    attemptCount: 1,
    failureReason: null
  });

  try {
    const result = await work();
    await repository.updateJob(job.id, {
      status: "ready",
      failureReason: null
    });
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document processing failed.";
    await repository.updateJob(job.id, {
      status: "failed",
      failureReason: message
    });
    throw error;
  }
}

async function processDocumentPipeline(viewer: Viewer, document: DocumentRecord) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, document.dealId);

  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  await repository.updateDocument(document.id, {
    processingStatus: "processing",
    errorMessage: null
  });

  try {
    const extractionSource = await runStage(
      document.dealId,
      document.id,
      "extract_text",
      async () => {
        if (document.sourceType === "pasted_text") {
          const rawText = document.rawText ?? "";
          const normalizedText = normalizeDocumentText(rawText);
          return { rawText, normalizedText };
        }

        const buffer = await readStoredBytes(document.storagePath);
        return extractDocumentText(buffer, document.mimeType, document.fileName);
      }
    );

    await repository.updateDocument(document.id, extractionSource);

    const classification = await runStage(
      document.dealId,
      document.id,
      "classify_document",
      async () =>
        classifyDocumentHeuristically(
          extractionSource.normalizedText,
          document.fileName
        )
    );

    await repository.updateDocument(document.id, {
      documentKind: classification.documentKind,
      classificationConfidence: classification.confidence
    });

    const sections = await runStage(
      document.dealId,
      document.id,
      "section_document",
      async () =>
        splitIntoSections(extractionSource.normalizedText, classification.documentKind)
    );

    const savedSections = await repository.replaceDocumentSections(document.id, sections);

    const partialExtractions = await runStage(
      document.dealId,
      document.id,
      "extract_fields",
      async () =>
        Promise.all(
          sections.map(async (section) => {
            const fallback = extractStructuredTerms(
              section.content,
              [section],
              classification.documentKind
            );

            if (!hasLlmKey()) {
              return fallback;
            }

            try {
              return await extractSectionWithLlm(
                section,
                classification.documentKind,
                fallback
              );
            } catch {
              return fallback;
            }
          })
        )
    );

    const extraction = await runStage(
      document.dealId,
      document.id,
      "merge_results",
      async () => mergeExtractionResults(partialExtractions as ExtractionPipelineResult[])
    );

    await repository.upsertExtractionResult(document.id, extraction);

    await repository.replaceExtractionEvidence(
      document.id,
      extraction.evidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        sectionId: savedSections.find(
          (section) => `section:${section.chunkIndex}` === entry.sectionKey
        )?.id ?? null,
        confidence: entry.confidence
      }))
    );

    const risks = await runStage(
      document.dealId,
      document.id,
      "analyze_risks",
      async () => {
        const fallbackRisks = analyzeCreatorRisks(
          extractionSource.normalizedText,
          document.id,
          extraction
        );

        if (!hasLlmKey()) {
          return fallbackRisks;
        }

        try {
          return await analyzeRisksWithLlm(
            extractionSource.normalizedText,
            classification.documentKind,
            extraction,
            fallbackRisks,
            document.id
          );
        } catch {
          return fallbackRisks;
        }
      }
    );

    await repository.replaceRiskFlagsForDocument(document.dealId, document.id, risks);

    const summary = await runStage(
      document.dealId,
      document.id,
      "generate_summary",
      async () => {
        const fallbackSummary = buildCreatorSummary(extraction, risks);

        if (!hasLlmKey()) {
          return fallbackSummary;
        }

        try {
          return await generateSummaryWithLlm(extraction, risks, fallbackSummary);
        } catch {
          return fallbackSummary;
        }
      }
    );

    await repository.saveSummary(document.dealId, document.id, summary);

    const latestAggregate =
      (await repository.getDealAggregate(viewer.id, document.dealId)) ?? aggregate;
    const nextTerms = mergeTerms(
      latestAggregate.terms ?? createEmptyTerms(latestAggregate.deal),
      extraction.data
    );
    await repository.upsertTerms(document.dealId, nextTerms);
    if (process.env.DATABASE_URL) {
      await syncPaymentRecordForDeal(document.dealId, nextTerms);
    }

    await repository.updateDocument(document.id, {
      processingStatus: "ready",
      rawText: extractionSource.rawText,
      normalizedText: extractionSource.normalizedText,
      errorMessage: null
    });

    await repository.updateDeal(viewer.id, document.dealId, {
      summary: summary.body,
      analyzedAt: new Date().toISOString(),
      nextDeliverableDate: earliestDeliverableDate(nextTerms),
      brandName: nextTerms.brandName ?? latestAggregate.deal.brandName,
      campaignName: nextTerms.campaignName ?? latestAggregate.deal.campaignName
    });

    if (process.env.DATABASE_URL) {
      await syncIntakeSessionForDealId(document.dealId);
    }

    return repository.getDealAggregate(viewer.id, document.dealId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We could not reliably process this document.";

    await repository.updateDocument(document.id, {
      processingStatus: "failed",
      errorMessage: message
    });
    if (process.env.DATABASE_URL) {
      await syncIntakeSessionForDealId(document.dealId);
    }
    throw error;
  }
}

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

export async function enqueueDocumentProcessing(documentId: string) {
  if (hasInngestEventKey()) {
    try {
      await inngest.send({
        name: "documents/process.requested",
        data: { documentId }
      });
      return { mode: "inngest" as const };
    } catch {
      return { mode: "local" as const };
    }
  }

  return { mode: "local" as const };
}

export async function processDocumentById(documentId: string) {
  const repository = getRepository();
  const document = await repository.getDocument(documentId);

  if (!document) {
    throw new Error("Document not found.");
  }

  const viewer = await getViewerById(document.userId);

  return processDocumentPipeline(viewer, document);
}

export async function listDealsForViewer(viewer: Viewer) {
  return getRepository().listDeals(viewer.id);
}

export async function listDocumentsForViewer(viewer: Viewer, dealId: string) {
  return getRepository().listDocuments(viewer.id, dealId);
}

export async function getDealForViewer(viewer: Viewer, dealId: string) {
  return getRepository().getDealAggregate(viewer.id, dealId);
}

export async function createDealForViewer(
  viewer: Viewer,
  input: Pick<DealRecord, "brandName" | "campaignName"> & { notes?: string | null }
) {
  const deal = await getRepository().createDeal(viewer.id, input);

  if (input.notes?.trim()) {
    await getRepository().upsertTerms(
      deal.id,
      mergeTerms(createEmptyTerms(deal), {
        ...createEmptyTerms(deal),
        notes: input.notes.trim()
      })
    );
  }

  return deal;
}

export async function updateDealForViewer(
  viewer: Viewer,
  dealId: string,
  patch: Partial<DealRecord>
) {
  return getRepository().updateDeal(viewer.id, dealId, patch);
}

export async function updateTermsForViewer(
  viewer: Viewer,
  dealId: string,
  patch: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const nextTerms = mergeTerms(
    aggregate.terms ?? createEmptyTerms(aggregate.deal),
    patch
  );
  const terms = await getRepository().upsertTerms(dealId, nextTerms);
  if (process.env.DATABASE_URL) {
    await syncPaymentRecordForDeal(dealId, nextTerms);
  }

  await getRepository().updateDeal(viewer.id, dealId, {
    nextDeliverableDate: earliestDeliverableDate(nextTerms),
    brandName: nextTerms.brandName ?? aggregate.deal.brandName,
    campaignName: nextTerms.campaignName ?? aggregate.deal.campaignName
  });

  return terms;
}

export async function uploadDocumentsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    files?: File[];
    pastedText?: string | null;
    pastedTextTitle?: string | null;
    documentKindHint?: DocumentKind | null;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const createdDocuments: DocumentRecord[] = [];
  const files = (input.files ?? []).filter((file) => file.size > 0);

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storeUploadedBytes({
      fileName: file.name,
      bytes,
      contentType: file.type || "application/octet-stream",
      folder: dealId
    });
    const document = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      storagePath,
      processingStatus: "pending",
      rawText: null,
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "file",
      errorMessage: null
    });

    createdDocuments.push(document);
  }

  if (input.pastedText?.trim()) {
    const title = input.pastedTextTitle?.trim() || "pasted-document.txt";
    const pastedDocument = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: title,
      mimeType: "text/plain",
      storagePath: `pasted:${title}`,
      processingStatus: "pending",
      rawText: input.pastedText.trim(),
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "pasted_text",
      errorMessage: null
    });

    createdDocuments.push(pastedDocument);
  }

  if (createdDocuments.length === 0) {
    throw new Error("Please upload at least one file or paste document text.");
  }

  for (const document of createdDocuments) {
    const queue = await enqueueDocumentProcessing(document.id);

    if (queue.mode === "local") {
      void processDocumentById(document.id).catch(async () => {
        await getRepository().getDealAggregate(viewer.id, dealId);
      });
    }
  }

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(dealId);
  }

  return getRepository().getDealAggregate(viewer.id, dealId);
}

export async function reprocessDocumentForViewer(
  viewer: Viewer,
  documentId: string
) {
  const document = await getRepository().getDocument(documentId);
  if (!document || document.userId !== viewer.id) {
    return null;
  }

  await getRepository().updateDocument(document.id, {
    processingStatus: "pending",
    errorMessage: null
  });
  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(document.dealId);
  }

  const queue = await enqueueDocumentProcessing(document.id);

  if (queue.mode === "local") {
    void processDocumentById(document.id).catch(() => undefined);
  }

  return getRepository().getDealAggregate(viewer.id, document.dealId);
}

export async function generateDraftForViewer(
  viewer: Viewer,
  dealId: string,
  intent: DraftIntent
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;
  const senderName =
    profile?.preferredSignature?.trim() ||
    profile?.displayName?.trim() ||
    viewer.displayName;
  const draft = generateEmailDraft(aggregate, intent, senderName);
  return getRepository().saveEmailDraft(dealId, intent, draft);
}

export async function ensureDraftsForDeal(
  viewer: Viewer,
  dealId: string,
  intents: DraftIntent[]
) {
  const aggregate = (await getDealForViewer(viewer, dealId)) as DealAggregate | null;
  if (!aggregate) {
    return null;
  }

  for (const intent of intents) {
    if (!aggregate.emailDrafts.some((draft) => draft.intent === intent)) {
      await generateDraftForViewer(viewer, dealId, intent);
    }
  }

  return getDealForViewer(viewer, dealId);
}
