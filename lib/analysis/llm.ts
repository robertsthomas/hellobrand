import OpenAI from "openai";

import type {
  DealTermsRecord,
  DocumentKind,
  DocumentSectionInput,
  DocumentSummaryResult,
  ExtractionPipelineResult,
  FieldEvidence,
  RiskFlagRecord
} from "@/lib/types";

type TermsData = Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">;

function providerConfig() {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "HelloBrand"
      }
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      defaultHeaders: undefined
    };
  }

  return null;
}

function client() {
  const config = providerConfig();
  if (!config) {
    throw new Error("No LLM provider configured.");
  }

  return new OpenAI(config);
}

export function hasLlmKey() {
  return Boolean(providerConfig());
}

export function getLlmModel() {
  return (
    process.env.LLM_MODEL ||
    process.env.OPENROUTER_MODEL ||
    process.env.OPENAI_MODEL ||
    (process.env.OPENROUTER_API_KEY ? "openrouter/free" : "gpt-5")
  );
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

async function requestJson(systemPrompt: string, userPrompt: string) {
  const response = await client().chat.completions.create({
    model: getLlmModel(),
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" }
  } as never);

  const content = response.choices[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Model returned an empty response.");
  }

  return safeParseJson(content);
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

      return {
        id: asString(row.id) || `llm-deliverable-${index}`,
        title,
        dueDate: asString(row.dueDate),
        channel: asString(row.channel),
        quantity: asNumber(row.quantity),
        status:
          row.status === "pending" ||
          row.status === "in_progress" ||
          row.status === "completed" ||
          row.status === "overdue"
            ? row.status
            : "pending",
        description: asString(row.description)
      };
    })
    .filter((entry): entry is TermsData["deliverables"][number] => Boolean(entry));

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

  const next: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">> = raw
    .map((entry) => {
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
    })
    .filter(
      (
        entry
      ): entry is Omit<RiskFlagRecord, "id" | "dealId" | "createdAt"> => Boolean(entry)
    );

  return next.length > 0 ? next : fallback;
}

export async function extractSectionWithLlm(
  section: DocumentSectionInput,
  documentKind: DocumentKind,
  fallback: ExtractionPipelineResult
): Promise<ExtractionPipelineResult> {
  const payload = await requestJson(
    "You extract creator deal facts from one document section at a time. Return only explicit facts from the section. Never guess missing values. Use null for anything not present. Keep output compact and factual.",
    `Extract facts from this ${documentKind} section.\n\nSection title: ${section.title}\nSection text:\n${section.content}\n\nFallback extraction for this section:\n${JSON.stringify(
      fallback.data,
      null,
      2
    )}\n\nReturn JSON with this shape:\n{\n  "data": { ...creator_deal_terms_fields },\n  "evidence": [{ "fieldPath": "paymentTerms", "snippet": "exact text", "confidence": 0.84 }],\n  "confidence": 0.0\n}\n\nOnly include evidence snippets taken directly from this section.`
  );

  return {
    schemaVersion: "v2-section",
    model: `llm:${getLlmModel()}`,
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
    "You analyze creator deal risk after factual extraction is complete. Focus on creator-specific issues like paid usage, whitelisting, exclusivity, vague deliverables, long payment terms, and one-sided termination. Do not restate every contract term.",
    `Document kind: ${documentKind}\n\nNormalized document text:\n${text}\n\nStructured extraction:\n${JSON.stringify(
      extraction.data,
      null,
      2
    )}\n\nFallback risks:\n${JSON.stringify(fallback, null, 2)}\n\nReturn JSON with this shape:\n{\n  "riskFlags": [\n    {\n      "category": "usage_rights",\n      "title": "Perpetual paid usage rights",\n      "detail": "plain-language explanation",\n      "severity": "high",\n      "suggestedAction": "practical negotiation step",\n      "evidence": ["quoted snippet"]\n    }\n  ]\n}`
  );

  return normalizeRiskFlags(payload.riskFlags, fallback, documentId);
}

export async function generateSummaryWithLlm(
  extraction: ExtractionPipelineResult,
  risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  fallback: DocumentSummaryResult
) {
  const payload = await requestJson(
    "You write concise, plain-English creator deal summaries. You are not a law firm. Be clear, direct, and useful.",
    `Using the extracted fields and risk flags below, write a creator-facing summary with these sections: "What this deal is", "What you deliver", "What you get paid", "Rights and restrictions", and "Watchouts".\n\nExtracted fields:\n${JSON.stringify(
      extraction.data,
      null,
      2
    )}\n\nRisk flags:\n${JSON.stringify(risks, null, 2)}\n\nFallback summary:\n${fallback.body}\n\nReturn JSON with shape:\n{\n  "body": "markdown summary"\n}`
  );

  return {
    body: asString(payload.body) ?? fallback.body,
    version: `llm:${getLlmModel()}`
  };
}
