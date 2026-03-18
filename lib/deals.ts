import {
  analyzeCreatorRisks,
  buildCreatorSummary,
  classifyDocumentHeuristically,
  extractBriefData,
  extractStructuredTerms,
  mergeExtractionResults,
  splitIntoSections
} from "@/lib/analysis/fallback";
import { getViewerById } from "@/lib/auth";
import {
  buildConflictIntelligencePatch,
  buildConflictResults,
  dealCategoryLabel,
  mergeConflictIntelligence
} from "@/lib/conflict-intelligence";
import {
  analyzeRisksWithLlm,
  extractBriefWithLlm,
  extractSectionWithLlm,
  getLlmRoute,
  generateSummaryWithLlm,
  hasLlmKey
} from "@/lib/analysis/llm";
import { extractDocumentText, normalizeDocumentText } from "@/lib/documents/extract";
import { generateEmailDraft } from "@/lib/email/generate";
import { inngest } from "@/lib/inngest/client";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { syncPaymentRecordForDeal } from "@/lib/payments";
import { enrichBrandCategoryWithPeopleDataLabs } from "@/lib/people-data-labs";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { readStoredBytes, storeUploadedBytes } from "@/lib/storage";
import {
  buildAppliedTerms,
  coalesceExtractions,
  hasMeaningfulChanges
} from "@/lib/pending-changes";
import type {
  BriefData,
  DealAggregate,
  DealRecord,
  DealTermsRecord,
  DocumentKind,
  DocumentRecord,
  DraftIntent,
  ExtractionPipelineResult,
  JobType,
  PendingExtractionData,
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
    brandCategory: null,
    competitorCategories: [],
    restrictedCategories: [],
    campaignDateWindow: null,
    disclosureObligations: [],
    revisions: null,
    revisionRounds: null,
    termination: null,
    terminationAllowed: null,
    terminationNotice: null,
    terminationConditions: null,
    governingLaw: null,
    notes: null,
    manuallyEditedFields: [],
    briefData: null,
    pendingExtraction: null
  };
}

function detectChangedFields(
  base: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">,
  patch: Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>
): string[] {
  const changed: string[] = [];
  const skip = new Set(["deliverables", "usageChannels", "competitorCategories", "restrictedCategories", "disclosureObligations", "campaignDateWindow", "manuallyEditedFields"]);

  for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
    if (skip.has(key)) continue;
    const baseVal = base[key];
    const patchVal = patch[key];
    if (patchVal === null || patchVal === undefined) continue;
    if (typeof patchVal === "string" && patchVal.trim().length === 0) continue;
    if (baseVal !== patchVal) {
      changed.push(key);
    }
  }

  return changed;
}

function mergeDeliverables(
  existing: NonNullable<DealTermsRecord["deliverables"]>,
  incoming: NonNullable<DealTermsRecord["deliverables"]>
) {
  const map = new Map<string, (typeof existing)[number]>();
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];

  for (const item of safeExisting) {
    map.set(`${item.title}:${item.dueDate ?? "none"}`, item);
  }

  for (const item of safeIncoming) {
    map.set(`${item.title}:${item.dueDate ?? "none"}`, item);
  }

  return Array.from(map.values()).sort((left, right) =>
    (left.dueDate ?? "").localeCompare(right.dueDate ?? "")
  );
}

function mergeBriefData(
  base: BriefData | null,
  patch: BriefData | null
): BriefData | null {
  if (!base) return patch;
  if (!patch) return base;

  return {
    campaignOverview: patch.campaignOverview ?? base.campaignOverview,
    messagingPoints: patch.messagingPoints.length > 0 ? patch.messagingPoints : base.messagingPoints,
    talkingPoints: patch.talkingPoints.length > 0 ? patch.talkingPoints : base.talkingPoints,
    creativeConceptOverview: patch.creativeConceptOverview ?? base.creativeConceptOverview,
    brandGuidelines: patch.brandGuidelines ?? base.brandGuidelines,
    approvalRequirements: patch.approvalRequirements ?? base.approvalRequirements,
    targetAudience: patch.targetAudience ?? base.targetAudience,
    toneAndStyle: patch.toneAndStyle ?? base.toneAndStyle,
    doNotMention: patch.doNotMention.length > 0 ? patch.doNotMention : base.doNotMention,
    sourceDocumentIds: Array.from(new Set([...base.sourceDocumentIds, ...patch.sourceDocumentIds]))
  };
}

export function mergeTerms(
  base: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">,
  patch: Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>,
  options?: { manuallyEditedFields?: string[] }
) {
  const manuallyEdited = options?.manuallyEditedFields ?? base.manuallyEditedFields ?? [];
  const baseUsageChannels = Array.isArray(base.usageChannels) ? base.usageChannels : [];
  const patchUsageChannels = Array.isArray(patch.usageChannels) ? patch.usageChannels : [];

  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => {
        if (manuallyEdited.includes(key)) {
          return false;
        }

        if (
          key === "deliverables" ||
          key === "usageChannels" ||
          key === "competitorCategories" ||
          key === "restrictedCategories" ||
          key === "disclosureObligations" ||
          key === "campaignDateWindow" ||
          key === "manuallyEditedFields" ||
          key === "briefData"
        ) {
          return false;
        }

        if (typeof value === "string") {
          return value.trim().length > 0;
        }

        return value !== null && value !== undefined;
      })
    ),
    deliverables: mergeDeliverables(base.deliverables, patch.deliverables ?? []),
    usageChannels: Array.from(new Set([...baseUsageChannels, ...patchUsageChannels])),
    manuallyEditedFields: manuallyEdited,
    briefData: mergeBriefData(base.briefData ?? null, patch.briefData ?? null),
    ...mergeConflictIntelligence(base, patch)
  };
}

function inferPastedTextFileName(text: string) {
  const lower = text.toLowerCase();
  const subjectLine = text
    .match(/^subject:\s*(.+)$/im)?.[1]
    ?.replace(/^(re|fwd?):\s*/gi, "")
    ?.trim();
  const campaignLine = text.match(/^(?:campaign|project)\s*:\s*(.+)$/im)?.[1]?.trim();

  const normalizedTitle = (subjectLine || campaignLine || "")
    .replace(/[^\w\s&+.'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedTitle) {
    return `${normalizedTitle}.txt`;
  }

  if (
    /(^|\n)\s*(from|to|subject|cc):|\b(sent from my iphone|thanks,|best,|regards,)\b/.test(
      lower
    )
  ) {
    return "pasted-email-thread.txt";
  }

  if (
    /deliverables|posting schedule|content requirements|assets?|stories|reels|tiktok|youtube/.test(
      lower
    )
  ) {
    return "pasted-deliverables-notes.txt";
  }

  if (/invoice|payment due|net ?\d+|balance due/.test(lower)) {
    return "pasted-invoice.txt";
  }

  if (
    /agreement|contract|usage rights|exclusivity|term and termination|governing law|indemnif/.test(
      lower
    )
  ) {
    return "pasted-contract.txt";
  }

  if (/campaign brief|brief overview|key messaging|content pillars/.test(lower)) {
    return "pasted-campaign-brief.txt";
  }

  return "pasted-context.txt";
}

function earliestDeliverableDate(terms: Pick<DealTermsRecord, "deliverables">) {
  return (
    [...terms.deliverables]
      .filter((item) => item.dueDate)
      .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""))[0]
      ?.dueDate ?? null
  );
}

function shouldLogDocumentPipeline() {
  return (
    process.env.DEBUG_DOCUMENT_PIPELINE === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

function logDocumentPipeline(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (!shouldLogDocumentPipeline()) {
    return;
  }

  const logger = level === "error" ? console.error : console.info;
  logger(`[document-pipeline] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
}

function llmSectionLimits() {
  const model = getLlmRoute("extract_section").primary.toLowerCase();
  const usingFreeModel =
    model.includes("openrouter/free") || model.includes(":free") || model.includes("/free");

  return usingFreeModel
    ? { maxSections: 6, concurrency: 2, usingFreeModel: true }
    : { maxSections: 12, concurrency: 4, usingFreeModel: false };
}

function scoreSectionForLlm(
  section: { title: string; content: string; chunkIndex: number },
  documentKind: DocumentKind
) {
  const title = section.title.toLowerCase();
  const content = section.content.toLowerCase();
  let score = Math.min(section.content.length, 4000) / 100;

  if (title === "general") {
    score -= 15;
  }

  if (section.content.length < 80) {
    score -= 12;
  }

  const keywordGroups: Record<DocumentKind | "shared", string[]> = {
    shared: [
      "payment",
      "compensation",
      "rate",
      "fee",
      "deliverable",
      "usage",
      "rights",
      "whitelist",
      "exclusiv",
      "revision",
      "termination",
      "campaign",
      "brand"
    ],
    contract: [
      "agreement",
      "term",
      "services",
      "scope",
      "content",
      "payment terms"
    ],
    deliverables_brief: ["deliverables", "timeline", "post", "story", "reel", "tiktok"],
    campaign_brief: ["brief", "messaging", "concept", "brand guidelines"],
    pitch_deck: ["overview", "campaign", "deliverables", "brand"],
    invoice: ["invoice", "amount", "total", "net", "payment", "client"],
    email_thread: ["subject:", "from:", "usage", "rate", "deadline", "follow up"],
    unknown: ["agreement", "campaign", "deliverables", "payment"]
  };

  for (const keyword of keywordGroups.shared) {
    if (title.includes(keyword) || content.includes(keyword)) {
      score += 8;
    }
  }

  for (const keyword of keywordGroups[documentKind]) {
    if (title.includes(keyword) || content.includes(keyword)) {
      score += 10;
    }
  }

  return score;
}

function selectSectionsForLlm(
  sections: Array<{ title: string; content: string; chunkIndex: number }>,
  documentKind: DocumentKind
) {
  const limits = llmSectionLimits();
  const selected = [...sections]
    .map((section) => ({
      section,
      score: scoreSectionForLlm(section, documentKind)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limits.maxSections)
    .sort((left, right) => left.section.chunkIndex - right.section.chunkIndex)
    .map((entry) => entry.section);

  return {
    ...limits,
    selected
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  values: TInput[],
  concurrency: number,
  worker: (value: TInput, index: number) => Promise<TOutput>
) {
  const results = new Array<TOutput>(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, () =>
      runWorker()
    )
  );

  return results;
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
  const startedAt = Date.now();

  logDocumentPipeline("info", "stage_start", {
    dealId,
    documentId,
    stage: type,
    jobId: job.id
  });

  try {
    const result = await work();
    await repository.updateJob(job.id, {
      status: "ready",
      failureReason: null
    });
    logDocumentPipeline("info", "stage_complete", {
      dealId,
      documentId,
      stage: type,
      jobId: job.id,
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document processing failed.";
    await repository.updateJob(job.id, {
      status: "failed",
      failureReason: message
    });
    logDocumentPipeline("error", "stage_failed", {
      dealId,
      documentId,
      stage: type,
      jobId: job.id,
      durationMs: Date.now() - startedAt,
      error: message
    });
    throw new Error(`${type}: ${message}`);
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
  const pipelineStartedAt = Date.now();

  logDocumentPipeline("info", "pipeline_start", {
    dealId: document.dealId,
    documentId: document.id,
    fileName: document.fileName,
    sourceType: document.sourceType,
    mimeType: document.mimeType
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

    logDocumentPipeline("info", "sections_created", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      documentKind: classification.documentKind,
      sectionCount: sections.length,
      normalizedChars: extractionSource.normalizedText.length
    });

    const savedSections = await repository.replaceDocumentSections(document.id, sections);
    const llmPlan = selectSectionsForLlm(sections, classification.documentKind);
    const llmSectionIds = new Set(llmPlan.selected.map((section) => section.chunkIndex));

    logDocumentPipeline("info", "llm_section_plan", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      model: hasLlmKey() ? getLlmRoute("extract_section").primary : null,
      fallbacks: hasLlmKey() ? getLlmRoute("extract_section").fallbacks : [],
      usingFreeModel: llmPlan.usingFreeModel,
      selectedSectionCount: llmPlan.selected.length,
      totalSectionCount: sections.length,
      concurrency: llmPlan.concurrency,
      selectedSections: llmPlan.selected.map((section) => ({
        chunkIndex: section.chunkIndex,
        title: section.title,
        chars: section.content.length
      }))
    });

    const partialExtractions = await runStage(
      document.dealId,
      document.id,
      "extract_fields",
      async () =>
        mapWithConcurrency(sections, llmPlan.concurrency, async (section) => {
            const fallback = extractStructuredTerms(
              section.content,
              [section],
              classification.documentKind
            );

            if (!hasLlmKey() || !llmSectionIds.has(section.chunkIndex)) {
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
    );

    logDocumentPipeline("info", "field_extraction_complete", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      sectionCount: sections.length,
      extractionCount: partialExtractions.length,
      usedLlm: hasLlmKey()
    });

    const extraction = await runStage(
      document.dealId,
      document.id,
      "merge_results",
      async () => mergeExtractionResults(partialExtractions as ExtractionPipelineResult[])
    );

    const intelligence = buildConflictIntelligencePatch({
      text: extractionSource.normalizedText,
      sectionKey: null,
      fallbackTerms: extraction.data
    });
    extraction.data = {
      ...extraction.data,
      ...mergeConflictIntelligence(extraction.data, intelligence.patch)
    };
    extraction.evidence = [...extraction.evidence, ...intelligence.evidence];
    const extractionEvidence = Array.isArray(extraction.evidence) ? extraction.evidence : [];
    const extractionDeliverables = Array.isArray(extraction.data.deliverables)
      ? extraction.data.deliverables
      : [];

    logDocumentPipeline("info", "merge_complete", {
      dealId: document.dealId,
      documentId: document.id,
      evidenceCount: extractionEvidence.length,
      deliverablesCount: extractionDeliverables.length,
      hasPaymentAmount: extraction.data.paymentAmount !== null,
      hasBrandName: Boolean(extraction.data.brandName),
      hasCampaignName: Boolean(extraction.data.campaignName)
    });

    if (
      classification.documentKind === "campaign_brief" ||
      classification.documentKind === "deliverables_brief" ||
      classification.documentKind === "pitch_deck"
    ) {
      const fallbackBrief = extractBriefData(
        extractionSource.normalizedText,
        classification.documentKind
      );
      if (fallbackBrief) {
        fallbackBrief.sourceDocumentIds = [document.id];
        let briefData = fallbackBrief;
        if (hasLlmKey()) {
          try {
            briefData = await extractBriefWithLlm(
              extractionSource.normalizedText,
              classification.documentKind,
              fallbackBrief
            );
          } catch {
            // keep fallback
          }
        }
        extraction.data.briefData = briefData;
      }
    }

    const categoryEnrichment = await enrichBrandCategoryWithPeopleDataLabs(
      extraction.data.brandName
    );

    if (categoryEnrichment?.category) {
      const previousCategory = extraction.data.brandCategory;
      extraction.data.brandCategory = categoryEnrichment.category;
      extraction.evidence = [
        ...extraction.evidence,
        {
          fieldPath: "brandCategory",
          snippet:
            categoryEnrichment.snippet ??
            `${categoryEnrichment.brandName} matched ${dealCategoryLabel(
              categoryEnrichment.category
            )}.`,
          sectionKey: null,
          confidence: categoryEnrichment.confidence
        }
      ];

      if (
        previousCategory &&
        previousCategory !== categoryEnrichment.category
      ) {
        extraction.evidence.push({
          fieldPath: "brandCategory",
          snippet: `${categoryEnrichment.brandName} company enrichment suggests ${dealCategoryLabel(
            categoryEnrichment.category
          )}, which overrides a conflicting detected category.`,
          sectionKey: null,
          confidence: categoryEnrichment.confidence
        });
      }

      logDocumentPipeline("info", "brand_category_enriched", {
        dealId: document.dealId,
        documentId: document.id,
        brandName: categoryEnrichment.brandName,
        previousCategory,
        enrichedCategory: categoryEnrichment.category,
        confidence: categoryEnrichment.confidence,
        website: categoryEnrichment.website
      });
    }

    await repository.upsertExtractionResult(document.id, extraction);

    await repository.replaceExtractionEvidence(
      document.id,
      extractionEvidence.map((entry) => ({
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
    const isFirstDocument = latestAggregate.terms === null;
    const existingTerms = latestAggregate.terms ?? createEmptyTerms(latestAggregate.deal);

    if (isFirstDocument) {
      const nextTerms = mergeTerms(existingTerms, extraction.data, {
        manuallyEditedFields: latestAggregate.terms?.manuallyEditedFields ?? []
      });
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
    } else {
      const mergedFull = mergeTerms(
        createEmptyTerms(latestAggregate.deal),
        extraction.data
      );
      const { pendingExtraction: _pe, ...mergedExtraction } = mergedFull;
      const pendingCandidate = mergedExtraction as PendingExtractionData;

      if (
        !hasMeaningfulChanges(
          latestAggregate.terms as DealTermsRecord,
          pendingCandidate
        )
      ) {
        const nextTerms = mergeTerms(existingTerms, extraction.data, {
          manuallyEditedFields: latestAggregate.terms?.manuallyEditedFields ?? []
        });
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
          nextDeliverableDate: earliestDeliverableDate(existingTerms),
          brandName: existingTerms.brandName ?? latestAggregate.deal.brandName,
          campaignName: existingTerms.campaignName ?? latestAggregate.deal.campaignName
        });
      } else {
        const existingPending = (latestAggregate.terms as DealTermsRecord)
          .pendingExtraction as PendingExtractionData | null;

        const pendingData = existingPending
          ? coalesceExtractions(existingPending, extraction.data, (base, patch) => {
              const full = { ...base, pendingExtraction: null };
              const merged = mergeTerms(full, patch);
              const { pendingExtraction: _, ...rest } = merged;
              return rest as PendingExtractionData;
            })
          : pendingCandidate;

        await repository.savePendingExtraction(document.dealId, pendingData);

        await repository.updateDocument(document.id, {
          processingStatus: "ready",
          rawText: extractionSource.rawText,
          normalizedText: extractionSource.normalizedText,
          errorMessage: null
        });

        await repository.updateDeal(viewer.id, document.dealId, {
          summary: summary.body,
          analyzedAt: new Date().toISOString()
        });
      }
    }

    if (process.env.DATABASE_URL) {
      await syncIntakeSessionForDealId(document.dealId);
    }

    logDocumentPipeline("info", "pipeline_complete", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      durationMs: Date.now() - pipelineStartedAt,
      riskCount: risks.length,
      summaryLength: summary.body.length,
      deliverablesCount: extraction.data.deliverables?.length ?? 0
    });

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
    logDocumentPipeline("error", "pipeline_failed", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      durationMs: Date.now() - pipelineStartedAt,
      error: message
    });
    throw new Error(`pipeline: ${message}`);
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
      logDocumentPipeline("info", "queue_enqueued", {
        documentId,
        mode: "inngest"
      });
      return { mode: "inngest" as const };
    } catch {
      logDocumentPipeline("error", "queue_failed", {
        documentId,
        mode: "inngest",
        fallbackMode: "local"
      });
      return { mode: "local" as const };
    }
  }

  logDocumentPipeline("info", "queue_enqueued", {
    documentId,
    mode: "local"
  });
  return { mode: "local" as const };
}

export async function processDocumentById(documentId: string) {
  const repository = getRepository();
  const document = await repository.getDocument(documentId);

  if (!document) {
    throw new Error("Document not found.");
  }

  const viewer = await getViewerById(document.userId);

  logDocumentPipeline("info", "process_document_requested", {
    documentId,
    dealId: document.dealId,
    fileName: document.fileName
  });

  return processDocumentPipeline(viewer, document);
}

export async function listDealsForViewer(viewer: Viewer) {
  return getRepository().listDeals(viewer.id);
}

async function loadRawDealAggregatesForViewer(viewer: Viewer) {
  const repository = getRepository();
  const deals = await repository.listDeals(viewer.id);
  const aggregates: DealAggregate[] = [];

  for (const deal of deals) {
    const aggregate = await repository.getDealAggregate(viewer.id, deal.id);

    if (aggregate) {
      aggregates.push(aggregate);
    }
  }

  return aggregates;
}

export async function listDealAggregatesForViewer(viewer: Viewer) {
  const aggregates = await loadRawDealAggregatesForViewer(viewer);

  return aggregates.map((aggregate) => ({
    ...aggregate,
    conflictResults: buildConflictResults(aggregate, aggregates)
  }));
}

export async function listDocumentsForViewer(viewer: Viewer, dealId: string) {
  return getRepository().listDocuments(viewer.id, dealId);
}

export async function getDealForViewer(viewer: Viewer, dealId: string) {
  const target = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!target) {
    return null;
  }

  const aggregates = await loadRawDealAggregatesForViewer(viewer);
  const comparisonSet = aggregates.some((aggregate) => aggregate.deal.id === dealId)
    ? aggregates
    : [target, ...aggregates];

  return {
    ...target,
    conflictResults: buildConflictResults(target, comparisonSet)
  };
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

export async function deleteDealForViewer(viewer: Viewer, dealId: string) {
  return getRepository().deleteDeal(viewer.id, dealId);
}

export async function updateTermsForViewer(
  viewer: Viewer,
  dealId: string,
  patch: Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const existing = aggregate.terms ?? createEmptyTerms(aggregate.deal);
  const changedFields = detectChangedFields(existing, patch);
  const nextManualEdits = Array.from(new Set([
    ...(aggregate.terms?.manuallyEditedFields ?? []),
    ...changedFields
  ]));

  const nextTerms = mergeTerms(
    existing,
    { ...patch, manuallyEditedFields: nextManualEdits }
  );
  nextTerms.manuallyEditedFields = nextManualEdits;
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

export async function updateDealNotesForViewer(
  viewer: Viewer,
  dealId: string,
  notes: string | null
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const nextTerms = mergeTerms(
    aggregate.terms ?? createEmptyTerms(aggregate.deal),
    { notes }
  );

  return getRepository().upsertTerms(dealId, nextTerms);
}

export async function uploadDocumentsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    files?: File[];
    pastedText?: string | null;
    documentKindHint?: DocumentKind | null;
    startProcessing?: boolean;
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
    const title = inferPastedTextFileName(input.pastedText.trim());
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

  if (input.startProcessing !== false) {
    for (const document of createdDocuments) {
      const queue = await enqueueDocumentProcessing(document.id);

      if (queue.mode === "local") {
        void processDocumentById(document.id).catch(async () => {
          await getRepository().getDealAggregate(viewer.id, dealId);
        });
      }
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

export async function applyPendingChangesForViewer(
  viewer: Viewer,
  dealId: string,
  acceptedFields: string[]
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);
  if (!aggregate?.terms?.pendingExtraction) {
    return null;
  }

  const pending = aggregate.terms.pendingExtraction as PendingExtractionData;
  const applied = buildAppliedTerms(aggregate.terms, pending, acceptedFields);
  await repository.upsertTerms(dealId, applied);

  if (process.env.DATABASE_URL) {
    await syncPaymentRecordForDeal(dealId, applied);
  }

  await repository.updateDeal(viewer.id, dealId, {
    nextDeliverableDate: earliestDeliverableDate(applied),
    brandName: applied.brandName ?? aggregate.deal.brandName,
    campaignName: applied.campaignName ?? aggregate.deal.campaignName
  });

  return repository.getDealAggregate(viewer.id, dealId);
}

export async function dismissPendingChangesForViewer(
  viewer: Viewer,
  dealId: string
) {
  const repository = getRepository();
  await repository.savePendingExtraction(dealId, null);
  return repository.getDealAggregate(viewer.id, dealId);
}
