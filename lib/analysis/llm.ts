import { z } from "zod";

import { aiCachePolicy, hasAiClient } from "@/lib/ai/gateway";
import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptNumbered,
  promptQuotedText
} from "@/lib/ai/prompting";
import { runStructuredOpenRouterTask } from "@/lib/ai/structured";
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
  RiskFlagRecord,
  SummaryType
} from "@/lib/types";
import {
  serializeDealSummarySections,
  stripInlineMarkdown,
  toPlainDealSummary
} from "@/lib/deal-summary";
import { sanitizeCampaignName, sanitizePartyName } from "@/lib/party-labels";
import { normalizeEvidenceSnippet } from "@/lib/utils";

type TermsData = Omit<
  DealTermsRecord,
  "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction"
>;
type LlmTask =
  | "extract_section"
  | "analyze_risks"
  | "generate_summary"
  | "generate_brief"
  | "consolidate_clauses";
type LlmRoute = {
  primary: string;
  fallbacks: string[];
};

const extractionResponseSchema = z.object({
  data: z.record(z.unknown()).default({}),
  evidence: z.array(
    z.object({
      fieldPath: z.string().trim().min(1),
      snippet: z.string().trim().min(1),
      confidence: z.number().nullable().optional()
    })
  ).default([]),
  confidence: z.number().nullable().optional()
});

const riskFlagsResponseSchema = z.object({
  riskFlags: z.array(
    z.object({
      category: z.enum([
        "usage_rights",
        "exclusivity",
        "payment_terms",
        "deliverables",
        "termination",
        "other"
      ]),
      title: z.string().trim().min(1),
      detail: z.string().trim().min(1),
      severity: z.enum(["low", "medium", "high"]),
      suggestedAction: z.string().trim().nullable().optional(),
      evidence: z.array(z.string().trim().min(1)).default([])
    })
  ).default([])
});

const summaryResponseSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string().trim().min(1),
      paragraphs: z.array(z.string().trim().min(1)).min(1)
    })
  ).default([]),
  body: z.string().default("")
});

const briefExtractionResponseSchema = z.object({
  campaignOverview: z.string().nullable().optional(),
  messagingPoints: z.array(z.string().trim().min(1)).default([]),
  talkingPoints: z.array(z.string().trim().min(1)).default([]),
  creativeConceptOverview: z.string().nullable().optional(),
  brandGuidelines: z.string().nullable().optional(),
  approvalRequirements: z.string().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  toneAndStyle: z.string().nullable().optional(),
  doNotMention: z.array(z.string().trim().min(1)).default([])
});

const generatedBriefResponseSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      content: z.string().trim().min(1),
      items: z.array(z.string().trim().min(1)).optional()
    })
  ).default([])
});

const clauseConsolidationResponseSchema = z.object({
  usageRights: z.string().trim().nullable().optional(),
  exclusivity: z.string().trim().nullable().optional(),
  deliverablesSummary: z.string().trim().nullable().optional(),
  termination: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional()
});

export interface ClauseConsolidationInput {
  usageRights: string[];
  exclusivity: string[];
  deliverables: string[];
  termination: string[];
  notes: string[];
  fallback: {
    usageRights: string | null;
    exclusivity: string | null;
    deliverablesSummary: string | null;
    termination: string | null;
    notes: string | null;
  };
}

export interface ClauseConsolidationResult {
  usageRights: string | null;
  exclusivity: string | null;
  deliverablesSummary: string | null;
  termination: string | null;
  notes: string | null;
  model: string;
}

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
    .filter((entry) => Boolean(entry));
}

function taskSpecificModel(task: LlmTask) {
  switch (task) {
    case "extract_section":
      return process.env.OPENROUTER_MODEL_EXTRACT || null;
    case "analyze_risks":
      return process.env.OPENROUTER_MODEL_RISKS || null;
    case "generate_summary":
    case "generate_brief":
    case "consolidate_clauses":
      return process.env.OPENROUTER_MODEL_CONTENT || null;
    default:
      return null;
  }
}

function taskSpecificFallbacks(task: LlmTask) {
  switch (task) {
    case "extract_section":
      return parseModelList(process.env.OPENROUTER_MODEL_EXTRACT_FALLBACKS);
    case "analyze_risks":
      return parseModelList(process.env.OPENROUTER_MODEL_RISKS_FALLBACKS);
    case "generate_summary":
    case "generate_brief":
    case "consolidate_clauses":
      return parseModelList(process.env.OPENROUTER_MODEL_CONTENT_FALLBACKS);
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
    },
    consolidate_clauses: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-mini"]
    }
  };

  const sharedFallbacks = parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS);
  const requestedPrimary =
    taskSpecificModel(task) ||
    process.env.OPENROUTER_MODEL ||
    defaultRoutes[task].primary;
  const primary = requestedPrimary;
  const fallbacks = [
    ...taskSpecificFallbacks(task),
    ...sharedFallbacks,
    ...defaultRoutes[task].fallbacks
  ].filter((model, index, list) => model !== primary && list.indexOf(model) === index);

  return { primary, fallbacks };
}

async function requestStructured<TSchema extends z.ZodTypeAny>(
  task: LlmTask,
  systemPrompt: string,
  userPrompt: string,
  schema: TSchema,
  fallback: z.infer<TSchema>,
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
    const response = await runStructuredOpenRouterTask({
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
      schema,
      fallback,
      cache,
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

function extractSectionSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You extract creator partnership facts from a single document section. You are strict, literal, and evidence-driven. Your goal is to extract REAL values from the document, not placeholders."
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Return only facts that are explicitly stated in the section. Do not guess, infer, or fill gaps.",
        "Use null, empty arrays, or omission when the section does not support a field.",
        "Evidence snippets must be copied verbatim from the section: meaningful phrases or full sentences only. No bullets, headings, page labels, or isolated tokens.",
        "Do not resolve cross-document conflicts here. Section extraction is single-document grounding only.",
        "If a fact does not map cleanly to the schema, place it in notes instead of inventing a field.",
        "Adapt extraction to the document type: contracts yield structured terms, briefs yield deliverable specs and timelines, emails yield proposed terms, invoices yield payment evidence. Do not force fields that don't exist in the document type."
      ])
    },
    {
      tag: "field_extraction_rules",
      content: [
        "brandName: The company/entity name ONLY (e.g., 'NimbusPM', 'Nike'). NEVER document titles, section headers, product descriptions, industry terms, or descriptors appended to the name. 'NimbusPM Product Project management software' is WRONG; the brandName is 'NimbusPM'. Look for company names in contract parties ('by and between X and Y'), 'Brand:' labels, or names near payment/legal terms.",
        "campaignName: The specific campaign title (e.g., 'Summer Launch 2024'). NOT generic words or section headers like 'Campaign', 'Project', 'Brief', 'Overview', 'Campaign objective', or 'Brief Campaign objective'.",
        "paymentAmount: Numeric value only. '$7,200' or 'USD 7200' or '$7.2k' all become 7200. If no amount stated, return null.",
        "currency: Currency code (USD, EUR, GBP). Default to 'USD' only if there's a payment amount without explicit currency.",
        "paymentTerms: The stated payment timing phrase, especially net terms, milestone timing, or due-date language. Examples: 'Net 30', 'due within 15 days', '50% on signature and 50% net-30 after final live links'.",
        "paymentStructure: The payout split or structure when explicitly stated. Examples: 'Flat fee', '50% on signature, 50% on completion', 'monthly retainer'.",
        "paymentTrigger: The event that causes payment. Examples: 'On signature', 'After final live links', 'After invoice receipt'.",
        "netTermsDays: Numeric day count from 'Net 45', '45 days', 'due within 45 days'. If not stated, null.",
        "deliverables: Content requirements with channels and quantities. Map format specs (Reel, TikTok, Story) to deliverables with channels.",
        "disclosureObligations: FTC, platform-specific labeling requirements (e.g., #ad, verbal mentions)."
      ].join("\n")
    },
    {
      tag: "few_shot_examples",
      content: [
        "<example_correct>",
        "Section text: This Usage Rights Addendum ('Agreement') is entered into by NimbusPM ('Company') and the Influencer ('Creator'). Company agrees to pay Creator $7,200.",
        "Extract: brandName='NimbusPM', paymentAmount=7200",
        "Even though the section header mentions 'Usage Rights Addendum', the actual brand is 'NimbusPM' from the contract parties.",
        "</example_correct>",
        "",
        "<example_correct>",
        "Section text: The influencer will be compensated $7,200 USD for the NimbusPM product launch campaign.",
        "Extract: brandName='NimbusPM', campaignName='product launch', paymentAmount=7200, currency='USD'",
        "</example_correct>",
        "",
        "<example_wrong>",
        "Section text from a document titled 'Usage Rights Addendum' about content usage licensing.",
        "Bad extract: brandName='Usage Rights Addendum' (WRONG - this is a document title, not a brand name)",
        "Correct: brandName=null, put relevant terms in usageRights or notes.",
        "</example_wrong>",
        "",
        "<example_wrong>",
        "Section text: USAGE RIGHTS ADDENDUM",
        "Bad extract: brandName='Usage Rights Addendum' or brandName='Usage Rights' (WRONG - document type and section header, not a brand)",
        "Correct: brandName=null",
        "</example_wrong>",
        "",
        "<example_correct>",
        "Section text: Payment will be made within 45 days of receiving the final invoice.",
        "Extract: netTermsDays=45, paymentTerms='Net 45'",
        "Bad extract: paymentAmount=45 (WRONG - 45 is days, not dollars)",
        "</example_correct>",
        "",
        "<example_correct>",
        "Section text: Compensation is payable 50% on signature and 50% net-30 after final live links.",
        "Extract: paymentTerms='50% on signature and 50% net-30 after final live links', paymentStructure='50% on signature, 50% on completion', paymentTrigger='On signature and after final live links', netTermsDays=30",
        "</example_correct>",
        "",
        "<example_correct>",
        "Section text: Creator grants Brand the right to use the content in paid social advertisements for 90 days on LinkedIn and YouTube.",
        "Extract: usageRightsPaidAllowed=true, usageDuration='90 days', usageChannels=['LinkedIn', 'YouTube']",
        "</example_correct>",
        "",
        "<example_null>",
        "Section text: Key Messaging: Create content that resonates with the target audience.",
        "Extract: brandName=null, campaignName=null, notes='Key Messaging: Create content that resonates with the target audience.'",
        "</example_null>",
        "",
        "<example_null>",
        "Section text: Campaign Brief Campaign objective: Generate demo requests from founder-led teams.",
        "Extract: campaignName=null (WRONG to use 'Campaign objective' or 'Brief Campaign objective' because this is a section header, not the campaign title)",
        "</example_null>",
        "",
        "<example_null>",
        "Section text: Influencer: [Insert Name] | Brand: [To Be Determined] | Campaign: [TBD]",
        "Extract: brandName=null, campaignName=null (template placeholders, not actual values)",
        "</example_null>"
      ].join("\n")
    },
    {
      tag: "output_contract",
      content:
        'Return JSON with this shape: { "data": { ...creator_deal_terms_fields }, "evidence": [{ "fieldPath": "paymentTerms", "snippet": "exact text", "confidence": 0.84 }], "confidence": 0.0 }.'
    }
  ]);
}

function extractSectionUserPrompt(
  section: DocumentSectionInput,
  documentKind: DocumentKind,
  fallback: ExtractionPipelineResult
) {
  return joinPromptSections([
    {
      tag: "context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        `Document kind: ${documentKind}`,
        `Section ${section.chunkIndex}: ${section.title}`
      ])
    },
    {
      tag: "section_text",
      content: promptQuotedText(section.content)
    },
    {
      tag: "prior_extraction",
      content: [
        "Overwrite these values ONLY if this section has more specific or contradictory info.",
        promptQuotedText(JSON.stringify(fallback.data, null, 2))
      ].join("\n\n")
    },
    {
      tag: "task",
      content: [
        "Extract creator partnership facts. Before each field confirm:",
        "1. Is it explicitly stated in the text?",
        "2. Is it a real value, not a placeholder or header?",
        "",
        "Fields to extract when stated: brandName, campaignName, paymentAmount, currency, paymentTerms, paymentStructure, paymentTrigger, netTermsDays, deliverables, usageRights, usageDuration, usageTerritory, usageChannels, exclusivity, exclusivityDuration, exclusivityCategory, disclosureObligations, revisions, termination, terminationNotice, governingLaw, notes.",
        "",
        "Return null for any field not explicitly stated."
      ].join("\n")
    }
  ]);
}

function analyzeRisksSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You flag creator-relevant risks in partnership documents. Only flag items needing creator attention or negotiation."
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Every risk must be supported by quoted document text. No guessing.",
        "Focus on: perpetual/broad usage rights, unpaid whitelisting, exclusivity traps, vague deliverables, long net terms (Net 60+), one-sided termination, unlimited revisions, and IP assignment overreach.",
        "Contracts: flag IP scope, usage duration/territory, termination, indemnity, net terms.",
        "Briefs without contracts: flag missing payment terms, undefined revision limits, open-ended scope.",
        "Invoices/emails/trackers: flag delayed payment triggers, approval blockers, scope creep. Do not invent unstated legal rights.",
        "Decks/moodboards/reports: only flag when they reveal concrete creator risk (undisclosed disclosure requirements, unpaid extra assets).",
        "Do not restate normal terms as risks. A clear deliverable with a date is not a risk."
      ])
    },
    {
      tag: "few_shot_examples",
      content: [
        "<example>",
        'Text: "Brand may use the content in paid media worldwide in perpetuity."',
        "Good: category=usage_rights, severity=high, evidence=[that exact sentence]",
        "</example>",
        "",
        "<example>",
        'Text: "Creator will deliver one Instagram Reel by May 5."',
        "Do NOT flag. Clear scope, clear date, not a risk.",
        "</example>",
        "",
        "<example>",
        'Text: "Creator grants Brand exclusive rights across all social platforms for 12 months."',
        "Good: category=exclusivity, severity=high, evidence=[that exact sentence]",
        "</example>"
      ].join("\n")
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "riskFlags": [{ "category": "usage_rights|exclusivity|payment_terms|deliverables|termination|other", "title": "short label", "detail": "plain-language explanation", "severity": "low|medium|high", "suggestedAction": "practical negotiation step or null", "evidence": ["quoted snippet from document"] }] }.'
    }
  ]);
}

function analyzeRisksUserPrompt(
  text: string,
  documentKind: DocumentKind,
  extraction: ExtractionPipelineResult,
  fallback: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>
) {
  return joinPromptSections([
    {
      tag: "context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        `Document kind: ${documentKind}`
      ])
    },
    {
      tag: "document_text",
      content: promptQuotedText(text)
    },
    {
      tag: "extracted_facts",
      content: promptQuotedText(JSON.stringify(extraction.data, null, 2))
    },
    {
      tag: "prior_risks",
      content: promptQuotedText(JSON.stringify(fallback, null, 2))
    },
    {
      tag: "task",
      content:
        "Return only creator-relevant risk flags directly supported by the document text and extracted facts."
    }
  ]);
}

function summarySystemPrompt(mode: "default" | "rewrite") {
  const roleDescription =
    mode === "rewrite"
      ? "You rewrite creator contract summaries into shorter, scannable versions without changing meaning."
      : "You write scannable creator partnership summaries. The reader must understand the deal in under 30 seconds.";

  return joinPromptSections([
    {
      tag: "role",
      content: roleDescription
    },
    {
      tag: "rules",
      content: promptNumbered([
        "1-3 short sentences per section max. Entire summary must fit on one phone screen.",
        "Lead with what matters: what to post, when it is due, how they get paid, what is risky.",
        "Preserve material obligations, payment facts, exclusivity, rights limits, and watchouts. State each in fewest words.",
        "Creator-facing plain language. Not legalistic.",
        "Plain text only. No markdown, bullets, asterisks, or underscores.",
        'Required section titles: "What this partnership is", "What you deliver", "What you get paid", "Rights and restrictions", "Watchouts".',
        "If nothing notable for a section, say so in one sentence. If a fact is missing, write Not specified."
      ])
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "sections": [{ "title": "What this partnership is", "paragraphs": ["plain text"] }], "body": "full plain text summary" }.'
    }
  ]);
}

function summaryUserPrompt(input: {
  extraction: ExtractionPipelineResult | null;
  risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">> | null;
  fallbackBody: string;
  targetType?: SummaryType;
  styleInstruction?: string;
  baseSummary?: string;
  grounding?: Record<string, unknown>;
}) {
  const sections = [
    input.extraction
      ? {
          tag: "extracted_fields",
          content: promptQuotedText(JSON.stringify(input.extraction.data, null, 2))
        }
      : null,
    input.risks
      ? {
          tag: "risk_flags",
          content: promptQuotedText(JSON.stringify(input.risks, null, 2))
        }
      : null,
    input.baseSummary
      ? {
          tag: "current_summary",
          content: promptQuotedText(input.baseSummary)
        }
      : null,
    input.grounding
      ? {
          tag: "grounding",
          content: promptQuotedText(JSON.stringify(input.grounding, null, 2))
        }
      : null,
    {
      tag: "fallback_summary",
      content: promptQuotedText(input.fallbackBody)
    },
    {
      tag: "task",
      content: input.styleInstruction
        ? `Type: ${input.targetType}. ${input.styleInstruction}`
        : "Write the creator-facing summary from the extracted facts and risk flags above."
    }
  ];

  return joinPromptSections(sections);
}

function briefExtractionSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You extract campaign-brief fields from partnership documents. Strict: only capture what is explicitly stated."
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Source types vary: formal briefs, pitch decks, storyboards, moodboards, creative feedback, and status updates are all valid sources.",
        "Return null or empty arrays for anything not found. Do not invent messaging, approvals, or audience details.",
        "Use doNotMention for prohibited claims, banned phrasing, or explicit avoid lists.",
        "Ignore payment, invoicing, and legal clauses unless they directly shape the creator brief experience."
      ])
    },
    {
      tag: "output_contract",
      content:
        "Return JSON: { campaignOverview, messagingPoints, talkingPoints, creativeConceptOverview, brandGuidelines, approvalRequirements, targetAudience, toneAndStyle, doNotMention }. Null or [] for missing fields."
    }
  ]);
}

function briefGenerationSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You write polished, actionable campaign briefs for creators from partnership context."
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Use provided context only. Do not invent terms, dates, or requirements.",
        "Preserve risks, deliverables, timing, rights, and approval constraints when present.",
        "Pre-fill from briefData when available, improve clarity and organization.",
        "Each section: id, title, content required. items is optional."
      ])
    },
    {
      tag: "section_ids",
      content: promptBullets(BRIEF_SECTION_IDS.map((id) => `"${id}"`))
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "sections": [{ "id": "campaign-overview", "title": "...", "content": "...", "items": ["..."] }] }.'
    }
  ]);
}

function clauseConsolidationSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You consolidate repeated creator partnership contract clauses after Google Document AI extraction. You are not an extractor. You rewrite only the provided extracted snippets into concise, faithful summaries."
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Use only the provided snippets. Do not add legal interpretation, risk analysis, or missing terms.",
        "If snippets repeat the same idea, deduplicate them.",
        "If snippets conflict, preserve the conflict in neutral language instead of choosing one side.",
        "Keep important conditions, durations, territories, exceptions, quantities, and party obligations.",
        "Return null for a field when there are no snippets for that field.",
        "Keep deliverables summary concise. Do not replace structured deliverable quantities when they are already clear.",
        "Write in plain text only. No markdown bullets, no numbered lists, no headings."
      ])
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "usageRights": "...", "exclusivity": "...", "deliverablesSummary": "...", "termination": "...", "notes": "..." }.'
    }
  ]);
}

function clauseConsolidationUserPrompt(input: ClauseConsolidationInput) {
  return joinPromptSections([
    {
      tag: "context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        "Source: Google Document AI custom extractor entities",
        "Task: summarize repeated occurrences for downstream deal terms"
      ])
    },
    {
      tag: "fallback_values",
      content: promptQuotedText(JSON.stringify(input.fallback, null, 2))
    },
    {
      tag: "usage_rights_snippets",
      content: promptQuotedText(JSON.stringify(input.usageRights, null, 2))
    },
    {
      tag: "exclusivity_snippets",
      content: promptQuotedText(JSON.stringify(input.exclusivity, null, 2))
    },
    {
      tag: "deliverables_snippets",
      content: promptQuotedText(JSON.stringify(input.deliverables, null, 2))
    },
    {
      tag: "termination_snippets",
      content: promptQuotedText(JSON.stringify(input.termination, null, 2))
    },
    {
      tag: "notes_snippets",
      content: promptQuotedText(JSON.stringify(input.notes, null, 2))
    }
  ]);
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
  const llmBrandName = sanitizePartyName(asString(input.brandName), "brand");
  const llmAgencyName = sanitizePartyName(asString(input.agencyName), "agency");

  return {
    ...fallbackData,
    brandName: llmBrandName ?? fallbackData.brandName,
    agencyName: llmAgencyName ?? fallbackData.agencyName,
    creatorName: asString(input.creatorName) ?? fallbackData.creatorName,
    campaignName: sanitizeCampaignName(asString(input.campaignName)) ?? fallbackData.campaignName,
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
  const sanitizedFallbackEvidence = fallbackEvidence
    .map((entry) => {
      const snippet = normalizeEvidenceSnippet(entry.snippet);
      if (!snippet) {
        return null;
      }

      return {
        ...entry,
        snippet
      };
    })
    .filter((entry): entry is FieldEvidence => Boolean(entry));

  if (!Array.isArray(rawEvidence)) {
    return sanitizedFallbackEvidence;
  }

  const evidence = rawEvidence
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const fieldPath = asString(row.fieldPath);
      const snippet = normalizeEvidenceSnippet(asString(row.snippet));
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

  return evidence.length > 0 ? evidence : sanitizedFallbackEvidence;
}

function normalizeRiskFlags(
  raw: unknown,
  fallback: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  documentId: string
): Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">> {
  const sanitizedFallback = fallback.map((flag) => ({
    ...flag,
    evidence: (Array.isArray(flag.evidence) ? flag.evidence : [])
      .map((snippet) => normalizeEvidenceSnippet(snippet))
      .filter((snippet): snippet is string => Boolean(snippet))
  }));

  if (!Array.isArray(raw)) {
    return sanitizedFallback;
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

      const sanitizedEvidence = asStringArray(row.evidence)
        .map((snippet) => normalizeEvidenceSnippet(snippet))
        .filter((snippet): snippet is string => Boolean(snippet));

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
        evidence: sanitizedEvidence,
        sourceDocumentId: documentId
      };
    });

  const next = mapped.filter(
    (
      entry
    ): entry is Omit<RiskFlagRecord, "id" | "dealId" | "createdAt"> => entry !== null
  );

  return next.length > 0 ? next : sanitizedFallback;
}

export async function extractSectionWithLlm(
  section: DocumentSectionInput,
  documentKind: DocumentKind,
  fallback: ExtractionPipelineResult
): Promise<ExtractionPipelineResult> {
  const payload = await requestStructured(
    "extract_section",
    extractSectionSystemPrompt(),
    extractSectionUserPrompt(section, documentKind, fallback),
    extractionResponseSchema,
    {
      data: fallback.data as Record<string, unknown>,
      evidence: fallback.evidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        confidence: entry.confidence ?? null
      })),
      confidence: fallback.confidence
    },
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
  const payload = await requestStructured(
    "analyze_risks",
    analyzeRisksSystemPrompt(),
    analyzeRisksUserPrompt(text, documentKind, extraction, fallback),
    riskFlagsResponseSchema,
    { riskFlags: fallback },
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
  const payload = await requestStructured(
    "generate_summary",
    summarySystemPrompt("default"),
    summaryUserPrompt({
      extraction,
      risks,
      fallbackBody: fallback.body
    }),
    summaryResponseSchema,
    { sections: [], body: fallback.body },
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

export async function generateSimplifiedSummaryWithLlm(input: {
  targetType: SummaryType;
  baseSummary: string;
  grounding: Record<string, unknown>;
  fallback: DocumentSummaryResult;
}) {
  const styleInstruction =
    input.targetType === "plain_language"
      ? "Rewrite the legal summary in simple, conversational creator language. Keep it short: 1-2 sentences per section. State facts directly without filler. The creator should understand the entire deal in under 20 seconds of reading."
      : "Compress the summary into the shortest possible quick-reference version. One sentence per section maximum. State only the most critical fact per section: the amount, the deadline, the restriction, the risk. Skip anything generic or obvious.";

  const payload = await requestStructured(
    "generate_summary",
    summarySystemPrompt("rewrite"),
    summaryUserPrompt({
      extraction: null,
      risks: null,
      fallbackBody: input.fallback.body,
      targetType: input.targetType,
      styleInstruction,
      baseSummary: input.baseSummary,
      grounding: input.grounding
    }),
    summaryResponseSchema,
    { sections: [], body: input.fallback.body },
    {
      requestType: "generate_summary",
      purpose: `summary_variant:${input.targetType}`,
      targetType: input.targetType,
      fallbackSummaryChars: input.fallback.body.length
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
        : toPlainDealSummary(asString(payload.body) ?? input.fallback.body)) ??
      input.fallback.body,
    version: `llm:${input.targetType}:${getLlmModel("generate_summary")}`
  };
}

export async function consolidateClausesWithLlm(
  input: ClauseConsolidationInput
): Promise<ClauseConsolidationResult> {
  const payload = await requestStructured(
    "consolidate_clauses",
    clauseConsolidationSystemPrompt(),
    clauseConsolidationUserPrompt(input),
    clauseConsolidationResponseSchema,
    input.fallback,
    {
      requestType: "consolidate_clauses",
      usageRightsCount: input.usageRights.length,
      exclusivityCount: input.exclusivity.length,
      deliverablesCount: input.deliverables.length,
      terminationCount: input.termination.length,
      notesCount: input.notes.length
    }
  );

  return {
    usageRights:
      toPlainDealSummary(asString(payload.usageRights) ?? "") ??
      input.fallback.usageRights,
    exclusivity:
      toPlainDealSummary(asString(payload.exclusivity) ?? "") ??
      input.fallback.exclusivity,
    deliverablesSummary:
      toPlainDealSummary(asString(payload.deliverablesSummary) ?? "") ??
      input.fallback.deliverablesSummary,
    termination:
      toPlainDealSummary(asString(payload.termination) ?? "") ??
      input.fallback.termination,
    notes:
      toPlainDealSummary(asString(payload.notes) ?? "") ?? input.fallback.notes,
    model: getLlmModel("consolidate_clauses")
  };
}

export async function extractBriefWithLlm(
  text: string,
  kind: DocumentKind,
  fallback: BriefData
): Promise<BriefData> {
  try {
    const payload = await requestStructured(
      "extract_section",
      briefExtractionSystemPrompt(),
      joinPromptSections([
        {
          tag: "document_metadata",
          content: promptBullets([
            `Today: ${isoDateContext()}`,
            `Document kind: ${kind}`
          ])
        },
        {
          tag: "document_text",
          content: promptQuotedText(text.slice(0, 6000))
        },
        {
          tag: "task",
          content: "Extract the campaign-brief fields from the document above."
        }
      ]),
      briefExtractionResponseSchema,
      {
        campaignOverview: fallback.campaignOverview,
        messagingPoints: fallback.messagingPoints,
        talkingPoints: fallback.talkingPoints,
        creativeConceptOverview: fallback.creativeConceptOverview,
        brandGuidelines: fallback.brandGuidelines,
        approvalRequirements: fallback.approvalRequirements,
        targetAudience: fallback.targetAudience,
        toneAndStyle: fallback.toneAndStyle,
        doNotMention: fallback.doNotMention
      },
      {
        documentKind: kind,
        purpose: "brief_extraction"
      }
    );

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

export async function generateBriefWithLlm(
  aggregate: DealAggregate,
  options: { mode?: "brief" | "summary" } = {}
): Promise<GeneratedBrief> {
  const mode = options.mode ?? "brief";
  const payload = await requestStructured(
    "generate_brief",
    briefGenerationSystemPrompt(),
    joinPromptSections([
      {
        tag: "partnership_context",
        content: promptQuotedText(buildBriefContext(aggregate))
      },
      {
        tag: "task",
        content:
          mode === "summary"
            ? "Generate a concise creator-facing summary of the uploaded campaign brief data from the partnership context above. Prioritize key brief terms: objective, deliverables, dates, messaging, creative requirements, approvals, usage notes, disclosures, and avoid-list items. Do not invent missing details."
            : "Generate the creator-facing campaign brief from the partnership context above."
      }
    ]),
    generatedBriefResponseSchema,
    { sections: [] },
    {
      requestType: "generate_brief",
      dealId: aggregate.deal.id
    }
  );

  const sections = normalizeBriefSections(payload.sections);

  return {
    sections: sections.length > 0 ? sections : [],
    generatedAt: new Date().toISOString(),
    modelVersion: `llm:${mode}:${getLlmModel("generate_brief")}`
  };
}
