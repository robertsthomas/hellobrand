import { aiCachePolicy, hasAiClient, runOpenRouterTask } from "@/lib/ai/gateway";
import { mergeConflictIntelligence, normalizeDealCategory } from "@/lib/conflict-intelligence";
import type {
  BriefData,
  CampaignDateWindow,
  DealAggregate,
  DealTermsRecord,
  DisclosureObligation,
  DocumentKind,
  DocumentSectionInput,
  DocumentSummaryResult,
  ExtractionPipelineResult,
  FieldEvidence,
  GeneratedBrief,
  GeneratedBriefSection,
  RiskFlagRecord
} from "@/lib/types";
import {
  serializeDealSummarySections,
  stripInlineMarkdown,
  toPlainDealSummary
} from "@/lib/deal-summary";

type TermsData = Omit<
  DealTermsRecord,
  "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction"
>;
type LlmTask = "extract_section" | "analyze_risks" | "generate_summary" | "generate_brief";
type LlmRoute = {
  primary: string;
  fallbacks: string[];
};

function shouldLogLlmDebug() {
  return process.env.DEBUG_DOCUMENT_PIPELINE === "1" || process.env.NODE_ENV !== "production";
}

function logLlmDebug(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (!shouldLogLlmDebug()) {
    return;
  }

  const logger = level === "error" ? console.error : console.info;
  logger(`[document-llm] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
}

export function hasLlmKey() {
  return hasAiClient();
}

function parseModelList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => Boolean(entry) && !entry.startsWith("anthropic/"));
}

function taskSpecificModel(task: LlmTask) {
  switch (task) {
    case "extract_section":
      return (
        process.env.LLM_MODEL_EXTRACT ||
        process.env.OPENROUTER_MODEL_EXTRACT ||
        null
      );
    case "analyze_risks":
      return (
        process.env.LLM_MODEL_RISKS ||
        process.env.OPENROUTER_MODEL_RISKS ||
        null
      );
    case "generate_summary":
      return (
        process.env.LLM_MODEL_SUMMARY ||
        process.env.OPENROUTER_MODEL_SUMMARY ||
        null
      );
    case "generate_brief":
      return (
        process.env.LLM_MODEL_BRIEF ||
        process.env.OPENROUTER_MODEL_BRIEF ||
        null
      );
    default:
      return null;
  }
}

function taskSpecificFallbacks(task: LlmTask) {
  switch (task) {
    case "extract_section":
      return parseModelList(
        process.env.LLM_MODEL_EXTRACT_FALLBACKS ||
          process.env.OPENROUTER_MODEL_EXTRACT_FALLBACKS
      );
    case "analyze_risks":
      return parseModelList(
        process.env.LLM_MODEL_RISKS_FALLBACKS ||
          process.env.OPENROUTER_MODEL_RISKS_FALLBACKS
      );
    case "generate_summary":
      return parseModelList(
        process.env.LLM_MODEL_SUMMARY_FALLBACKS ||
          process.env.OPENROUTER_MODEL_SUMMARY_FALLBACKS
      );
    case "generate_brief":
      return parseModelList(
        process.env.LLM_MODEL_BRIEF_FALLBACKS ||
          process.env.OPENROUTER_MODEL_BRIEF_FALLBACKS
      );
    default:
      return [];
  }
}

export function getLlmModel(task: LlmTask = "extract_section") {
  return getLlmRoute(task).primary;
}

export function getLlmRoute(task: LlmTask = "extract_section"): LlmRoute {
  const defaultRoutes: Record<LlmTask, LlmRoute> = {
    extract_section: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    },
    analyze_risks: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    },
    generate_summary: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    },
    generate_brief: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    }
  };

  const sharedFallbacks = parseModelList(
    process.env.LLM_MODEL_FALLBACKS || process.env.OPENROUTER_MODEL_FALLBACKS
  );
  const requestedPrimary =
    taskSpecificModel(task) ||
    process.env.LLM_MODEL ||
    process.env.OPENROUTER_MODEL ||
    defaultRoutes[task].primary;
  const primary = requestedPrimary.startsWith("anthropic/")
    ? defaultRoutes[task].primary
    : requestedPrimary;
  const fallbacks = [
    ...taskSpecificFallbacks(task),
    ...sharedFallbacks,
    ...defaultRoutes[task].fallbacks
  ].filter((model, index, list) => model !== primary && list.indexOf(model) === index);

  return { primary, fallbacks };
}

function safeParseJson(input: string) {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    const match = input.match(/\{[\s\S]*\}$/);
    if (!match) {
      throw new Error("Model did not return valid JSON.");
    }

    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

async function requestJson(
  task: LlmTask,
  systemPrompt: string,
  userPrompt: string,
  debugMeta?: Record<string, unknown>
) {
  const route = getLlmRoute(task);
  const model = route.primary;
  const startedAt = Date.now();
  const scopeParts = [
    task,
    typeof debugMeta?.documentId === "string" ? debugMeta.documentId : null,
    typeof debugMeta?.dealId === "string" ? debugMeta.dealId : null,
    typeof debugMeta?.sectionIndex === "number" ? String(debugMeta.sectionIndex) : null,
    typeof debugMeta?.purpose === "string" ? debugMeta.purpose : null
  ].filter(Boolean);
  const cache = aiCachePolicy({
    taskKey: task,
    scopeKey: scopeParts.join(":") || task,
    input: {
      task,
      systemPrompt,
      userPrompt,
      debugMeta
    }
  });

  logLlmDebug("info", "request_start", {
    model,
    fallbacks: route.fallbacks,
    task,
    ...debugMeta
  });

  try {
    const response = await runOpenRouterTask<Record<string, unknown>>({
      context: {
        featureKey: task === "generate_brief" ? "brief_generation" : "document_analysis",
        taskKey: task,
        metadata: debugMeta
      },
      systemPrompt:
        systemPrompt +
        "\n\nIMPORTANT: Never use em dashes (—) or en dashes (–) in any output. Use commas, periods, or semicolons instead.",
      userPrompt,
      temperature: 0.1,
      responseFormat: { type: "json_object" },
      cache,
      parse: (content) => safeParseJson(content),
      serialize: (value) => value
    });

    if (!response) {
      throw new Error("LLM budget limit reached.");
    }

    logLlmDebug("info", "request_complete", {
      model,
      resolvedModel: response.resolvedModel,
      fallbacks: route.fallbacks,
      task,
      durationMs: Date.now() - startedAt,
      responseChars: JSON.stringify(response.data).length,
      cacheHit: response.cacheHit,
      budgetDecision: response.budgetDecision,
      ...debugMeta
    });

    return response.data;
  } catch (error) {
    logLlmDebug("error", "request_failed", {
      model,
      fallbacks: route.fallbacks,
      task,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown LLM error",
      ...debugMeta
    });
    throw error;
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(asString).filter((entry): entry is string => Boolean(entry));
}

function asDateWindow(value: unknown): CampaignDateWindow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  return {
    startDate: asString(row.startDate),
    endDate: asString(row.endDate),
    postingWindow: asString(row.postingWindow)
  };
}

function asDisclosureObligations(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const title = asString(row.title);
      const detail = asString(row.detail);
      if (!title || !detail) {
        return null;
      }

      const obligation: DisclosureObligation = {
        id: asString(row.id) ?? `llm-disclosure-${index}`,
        title,
        detail,
        source: asString(row.source)
      };

      return obligation;
    })
    .filter((entry): entry is DisclosureObligation => entry !== null);
}

function normalizeDeliverables(
  value: unknown,
  fallbackDeliverables: TermsData["deliverables"]
) {
  if (!Array.isArray(value)) {
    return fallbackDeliverables;
  }

  const normalized = value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const title = asString(row.title);
      if (!title) {
        return null;
      }

      const status: TermsData["deliverables"][number]["status"] =
        row.status === "pending" ||
        row.status === "in_progress" ||
        row.status === "completed" ||
        row.status === "overdue"
          ? row.status
          : "pending";

      const normalizedEntry: TermsData["deliverables"][number] = {
        id: asString(row.id) || `llm-deliverable-${index}`,
        title,
        dueDate: asString(row.dueDate),
        channel: asString(row.channel),
        quantity: asNumber(row.quantity),
        status,
        description: asString(row.description)
      };

      return normalizedEntry;
    })
    .filter(
      (entry): entry is TermsData["deliverables"][number] => entry !== null
    );

  return normalized.length > 0 ? normalized : fallbackDeliverables;
}

function normalizeTerms(
  rawData: unknown,
  fallbackData: TermsData
): TermsData {
  if (!rawData || typeof rawData !== "object") {
    return fallbackData;
  }

  const input = rawData as Record<string, unknown>;

  const mergedConflictIntelligence = mergeConflictIntelligence(fallbackData, {
    competitorCategories: asStringArray(input.competitorCategories),
    restrictedCategories: asStringArray(input.restrictedCategories),
    disclosureObligations: asDisclosureObligations(input.disclosureObligations),
    campaignDateWindow: asDateWindow(input.campaignDateWindow)
  });

  return {
    ...fallbackData,
    brandName: asString(input.brandName) ?? fallbackData.brandName,
    agencyName: asString(input.agencyName) ?? fallbackData.agencyName,
    creatorName: asString(input.creatorName) ?? fallbackData.creatorName,
    campaignName: asString(input.campaignName) ?? fallbackData.campaignName,
    paymentAmount: asNumber(input.paymentAmount) ?? fallbackData.paymentAmount,
    currency: asString(input.currency) ?? fallbackData.currency,
    paymentTerms: asString(input.paymentTerms) ?? fallbackData.paymentTerms,
    paymentStructure: asString(input.paymentStructure) ?? fallbackData.paymentStructure,
    netTermsDays: asNumber(input.netTermsDays) ?? fallbackData.netTermsDays,
    paymentTrigger: asString(input.paymentTrigger) ?? fallbackData.paymentTrigger,
    deliverables: normalizeDeliverables(input.deliverables, fallbackData.deliverables),
    usageRights: asString(input.usageRights) ?? fallbackData.usageRights,
    usageRightsOrganicAllowed:
      asBoolean(input.usageRightsOrganicAllowed) ?? fallbackData.usageRightsOrganicAllowed,
    usageRightsPaidAllowed:
      asBoolean(input.usageRightsPaidAllowed) ?? fallbackData.usageRightsPaidAllowed,
    whitelistingAllowed:
      asBoolean(input.whitelistingAllowed) ?? fallbackData.whitelistingAllowed,
    usageDuration: asString(input.usageDuration) ?? fallbackData.usageDuration,
    usageTerritory: asString(input.usageTerritory) ?? fallbackData.usageTerritory,
    usageChannels: Array.from(
      new Set([...fallbackData.usageChannels, ...asStringArray(input.usageChannels)])
    ),
    exclusivity: asString(input.exclusivity) ?? fallbackData.exclusivity,
    exclusivityApplies:
      asBoolean(input.exclusivityApplies) ?? fallbackData.exclusivityApplies,
    exclusivityCategory:
      asString(input.exclusivityCategory) ?? fallbackData.exclusivityCategory,
    exclusivityDuration:
      asString(input.exclusivityDuration) ?? fallbackData.exclusivityDuration,
    exclusivityRestrictions:
      asString(input.exclusivityRestrictions) ?? fallbackData.exclusivityRestrictions,
    brandCategory:
      normalizeDealCategory(asString(input.brandCategory)) ?? fallbackData.brandCategory,
    competitorCategories: mergedConflictIntelligence.competitorCategories,
    restrictedCategories: mergedConflictIntelligence.restrictedCategories,
    campaignDateWindow: mergedConflictIntelligence.campaignDateWindow,
    disclosureObligations: mergedConflictIntelligence.disclosureObligations,
    revisions: asString(input.revisions) ?? fallbackData.revisions,
    revisionRounds: asNumber(input.revisionRounds) ?? fallbackData.revisionRounds,
    termination: asString(input.termination) ?? fallbackData.termination,
    terminationAllowed:
      asBoolean(input.terminationAllowed) ?? fallbackData.terminationAllowed,
    terminationNotice:
      asString(input.terminationNotice) ?? fallbackData.terminationNotice,
    terminationConditions:
      asString(input.terminationConditions) ?? fallbackData.terminationConditions,
    governingLaw: asString(input.governingLaw) ?? fallbackData.governingLaw,
    notes: asString(input.notes) ?? fallbackData.notes
  };
}

function normalizeEvidence(
  rawEvidence: unknown,
  sectionKey: string | null,
  fallbackEvidence: FieldEvidence[]
) {
  if (!Array.isArray(rawEvidence)) {
    return fallbackEvidence;
  }

  const evidence = rawEvidence
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const fieldPath = asString(row.fieldPath);
      const snippet = asString(row.snippet);
      if (!fieldPath || !snippet) {
        return null;
      }

      return {
        fieldPath,
        snippet,
        sectionKey,
        confidence: asNumber(row.confidence)
      };
    })
    .filter((entry): entry is FieldEvidence => Boolean(entry));

  return evidence.length > 0 ? evidence : fallbackEvidence;
}

function normalizeRiskFlags(
  raw: unknown,
  fallback: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  documentId: string
): Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">> {
  if (!Array.isArray(raw)) {
    return fallback;
  }

  const mapped: Array<
    Omit<RiskFlagRecord, "id" | "dealId" | "createdAt"> | null
  > = raw.map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const category = asString(row.category);
      const title = asString(row.title);
      const detail = asString(row.detail);
      const severity = asString(row.severity);

      if (!category || !title || !detail || !severity) {
        return null;
      }

      if (
        category !== "usage_rights" &&
        category !== "exclusivity" &&
        category !== "payment_terms" &&
        category !== "deliverables" &&
        category !== "termination" &&
        category !== "other"
      ) {
        return null;
      }

      if (severity !== "low" && severity !== "medium" && severity !== "high") {
        return null;
      }

      return {
        category: category as Omit<
          RiskFlagRecord,
          "id" | "dealId" | "createdAt"
        >["category"],
        title,
        detail,
        severity: severity as Omit<
          RiskFlagRecord,
          "id" | "dealId" | "createdAt"
        >["severity"],
        suggestedAction: asString(row.suggestedAction),
        evidence: asStringArray(row.evidence),
        sourceDocumentId: documentId
      };
    });

  const next = mapped.filter(
    (
      entry
    ): entry is Omit<RiskFlagRecord, "id" | "dealId" | "createdAt"> => entry !== null
  );

  return next.length > 0 ? next : fallback;
}

export async function extractSectionWithLlm(
  section: DocumentSectionInput,
  documentKind: DocumentKind,
  fallback: ExtractionPipelineResult
): Promise<ExtractionPipelineResult> {
  const payload = await requestJson(
    "extract_section",
    "You extract creator partnership facts from one document section at a time. Return only explicit facts from the section. Never guess missing values. Use null for anything not present. Keep output compact and factual.",
    `Extract facts from this ${documentKind} section.\n\nSection title: ${section.title}\nSection text:\n${section.content}\n\nFallback extraction for this section:\n${JSON.stringify(
      fallback.data,
      null,
      2
    )}\n\nReturn JSON with this shape:\n{\n  "data": { ...creator_deal_terms_fields },\n  "evidence": [{ "fieldPath": "paymentTerms", "snippet": "exact text", "confidence": 0.84 }],\n  "confidence": 0.0\n}\n\nOnly include evidence snippets taken directly from this section.`,
    {
      requestType: "extract_section",
      documentKind,
      sectionIndex: section.chunkIndex,
      sectionTitle: section.title,
      sectionChars: section.content.length
    }
  );

  return {
    schemaVersion: "v2-section",
    model: `llm:${getLlmModel("extract_section")}`,
    confidence: asNumber(payload.confidence) ?? fallback.confidence,
    data: normalizeTerms(payload.data, fallback.data),
    evidence: normalizeEvidence(
      payload.evidence,
      `section:${section.chunkIndex}`,
      fallback.evidence
    ),
    conflicts: []
  };
}

export async function analyzeRisksWithLlm(
  text: string,
  documentKind: DocumentKind,
  extraction: ExtractionPipelineResult,
  fallback: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  documentId: string
) {
  const payload = await requestJson(
    "analyze_risks",
    "You analyze creator partnership risk after factual extraction is complete. Focus on creator-specific issues like paid usage, whitelisting, exclusivity, vague deliverables, long payment terms, and one-sided termination. Do not restate every contract term.",
    `Document kind: ${documentKind}\n\nNormalized document text:\n${text}\n\nStructured extraction:\n${JSON.stringify(
      extraction.data,
      null,
      2
    )}\n\nFallback risks:\n${JSON.stringify(fallback, null, 2)}\n\nReturn JSON with this shape:\n{\n  "riskFlags": [\n    {\n      "category": "usage_rights",\n      "title": "Perpetual paid usage rights",\n      "detail": "plain-language explanation",\n      "severity": "high",\n      "suggestedAction": "practical negotiation step",\n      "evidence": ["quoted snippet"]\n    }\n  ]\n}`,
    {
      requestType: "analyze_risks",
      documentKind,
      documentId,
      textChars: text.length,
      fallbackRiskCount: fallback.length
    }
  );

  return normalizeRiskFlags(payload.riskFlags, fallback, documentId);
}

export async function generateSummaryWithLlm(
  extraction: ExtractionPipelineResult,
  risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  fallback: DocumentSummaryResult
) {
  const evidenceCount = Array.isArray(extraction.evidence) ? extraction.evidence.length : 0;
  const payload = await requestJson(
    "generate_summary",
    "You write concise, plain-English creator partnership summaries. You are not a law firm. Be clear, direct, and useful.",
    `Using the extracted fields and risk flags below, write a creator-facing summary with these sections: "What this partnership is", "What you deliver", "What you get paid", "Rights and restrictions", and "Watchouts". Use plain text only. Do not use markdown symbols, heading markers, or bullet markers.\n\nExtracted fields:\n${JSON.stringify(
      extraction.data,
      null,
      2
    )}\n\nRisk flags:\n${JSON.stringify(risks, null, 2)}\n\nFallback summary:\n${fallback.body}\n\nReturn JSON with shape:\n{\n  "sections": [\n    {\n      "title": "What this partnership is",\n      "paragraphs": ["plain text paragraph"]\n    }\n  ],\n  "body": "plain text summary"\n}`,
    {
      requestType: "generate_summary",
      riskCount: risks.length,
      evidenceCount,
      fallbackSummaryChars: fallback.body.length
    }
  );

  const sections = Array.isArray(payload.sections)
    ? payload.sections
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const record = entry as { title?: unknown; paragraphs?: unknown };
          const title = stripInlineMarkdown(asString(record.title) ?? "");
          const paragraphs = Array.isArray(record.paragraphs)
            ? record.paragraphs
                .map((paragraph) => toPlainDealSummary(asString(paragraph) ?? ""))
                .filter((paragraph): paragraph is string => Boolean(paragraph))
            : [];

          if (!title || paragraphs.length === 0) {
            return null;
          }

          return {
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            title,
            paragraphs
          };
        })
        .filter(
          (
            entry
          ): entry is { id: string; title: string; paragraphs: string[] } =>
            Boolean(entry)
        )
    : [];

  return {
    body:
      (sections.length > 0
        ? serializeDealSummarySections(sections)
        : toPlainDealSummary(asString(payload.body) ?? fallback.body)) ?? fallback.body,
    version: `llm:${getLlmModel("generate_summary")}`
  };
}

export async function extractBriefWithLlm(
  text: string,
  kind: DocumentKind,
  fallback: BriefData
): Promise<BriefData> {
  const systemPrompt = `You are a creator-partnership analyst. Extract campaign brief fields from the document and return a JSON object with these fields:
campaignOverview (string|null), messagingPoints (string[]), talkingPoints (string[]), creativeConceptOverview (string|null), brandGuidelines (string|null), approvalRequirements (string|null), targetAudience (string|null), toneAndStyle (string|null), doNotMention (string[]).
Only include information explicitly stated. Return null or empty arrays for fields not found.`;

  try {
    const payload = await requestJson("extract_section", systemPrompt, text.slice(0, 6000), {
      documentKind: kind,
      purpose: "brief_extraction"
    });

    return {
      campaignOverview: asString(payload.campaignOverview) ?? fallback.campaignOverview,
      messagingPoints: asStringArray(payload.messagingPoints).length > 0
        ? asStringArray(payload.messagingPoints)
        : fallback.messagingPoints,
      talkingPoints: asStringArray(payload.talkingPoints).length > 0
        ? asStringArray(payload.talkingPoints)
        : fallback.talkingPoints,
      creativeConceptOverview: asString(payload.creativeConceptOverview) ?? fallback.creativeConceptOverview,
      brandGuidelines: asString(payload.brandGuidelines) ?? fallback.brandGuidelines,
      approvalRequirements: asString(payload.approvalRequirements) ?? fallback.approvalRequirements,
      targetAudience: asString(payload.targetAudience) ?? fallback.targetAudience,
      toneAndStyle: asString(payload.toneAndStyle) ?? fallback.toneAndStyle,
      doNotMention: asStringArray(payload.doNotMention).length > 0
        ? asStringArray(payload.doNotMention)
        : fallback.doNotMention,
      sourceDocumentIds: fallback.sourceDocumentIds
    };
  } catch {
    return fallback;
  }
}

const BRIEF_SECTION_IDS = [
  "campaign-overview",
  "deliverables-summary",
  "key-dates",
  "talking-points",
  "messaging-guidelines",
  "brand-guidelines",
  "usage-rights-summary",
  "do-not-mention",
  "approval-requirements"
] as const;

function normalizeBriefSections(raw: unknown): GeneratedBriefSection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const sections: GeneratedBriefSection[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const id = asString(row.id);
    const title = asString(row.title);
    const content = asString(row.content);

    if (!id || !title || !content) {
      continue;
    }

    const items = asStringArray(row.items);
    const section: GeneratedBriefSection = { id, title, content };
    if (items.length > 0) {
      section.items = items;
    }
    sections.push(section);
  }

  return sections;
}

function buildBriefContext(aggregate: DealAggregate) {
  const { deal, terms, riskFlags } = aggregate;
  const summary = aggregate.currentSummary?.body ?? deal.summary ?? null;

  const context: Record<string, unknown> = {
    brandName: terms?.brandName,
    campaignName: terms?.campaignName ?? deal.campaignName,
    summary,
    paymentAmount: terms?.paymentAmount,
    currency: terms?.currency,
    paymentTerms: terms?.paymentTerms,
    deliverables: terms?.deliverables?.map((d) => ({
      title: d.title,
      dueDate: d.dueDate,
      channel: d.channel,
      quantity: d.quantity,
      description: d.description
    })),
    usageRights: terms?.usageRights,
    usageDuration: terms?.usageDuration,
    usageChannels: terms?.usageChannels,
    exclusivity: terms?.exclusivity,
    exclusivityDuration: terms?.exclusivityDuration,
    exclusivityCategory: terms?.exclusivityCategory,
    campaignDateWindow: terms?.campaignDateWindow,
    briefData: terms?.briefData,
    riskFlags: riskFlags.map((f) => ({
      category: f.category,
      title: f.title,
      detail: f.detail,
      severity: f.severity
    }))
  };

  return JSON.stringify(context, null, 2);
}

export async function generateBriefWithLlm(aggregate: DealAggregate): Promise<GeneratedBrief> {
  const systemPrompt = `You are a creator campaign brief writer. Synthesize all partnership context into a polished, actionable campaign brief with these specific sections (use these exact IDs):

${BRIEF_SECTION_IDS.map((id) => `- "${id}"`).join("\n")}

For each section, provide an id, title, content (paragraph text), and optional items (bullet list).
Pre-fill from existing briefData where available and enhance with partnership context.
Return JSON: { "sections": [{ "id": "...", "title": "...", "content": "...", "items": ["..."] }] }`;

  const userPrompt = `Generate a professional campaign brief from this partnership context:\n\n${buildBriefContext(aggregate)}`;

  const payload = await requestJson("generate_brief", systemPrompt, userPrompt, {
    requestType: "generate_brief",
    dealId: aggregate.deal.id
  });

  const sections = normalizeBriefSections(payload.sections);

  return {
    sections: sections.length > 0 ? sections : [],
    generatedAt: new Date().toISOString(),
    modelVersion: `llm:${getLlmModel("generate_brief")}`
  };
}
