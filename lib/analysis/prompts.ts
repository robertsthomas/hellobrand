/**
 * LLM prompt construction for document analysis tasks.
 */
import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptNumbered,
  promptQuotedText,
} from "@/lib/ai/prompting";
import type {
  DocumentKind,
  DocumentSectionInput,
  ExtractionPipelineResult,
  RiskFlagRecord,
  SummaryType,
} from "@/lib/types";

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

const BRIEF_SECTION_IDS = [
  "campaign-overview",
  "deliverables-summary",
  "key-dates",
  "talking-points",
  "messaging-guidelines",
  "brand-guidelines",
  "usage-rights-summary",
  "do-not-mention",
  "approval-requirements",
] as const;
const ANALYSIS_PROMPT_VERSION = "2026-04-16-v3";

export function conceptGenerationSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You are a creative strategist specializing in branded creator content for social platforms. You generate distinct, actionable creative concept directions that feel creator-native, not brand-advertorial.",
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Generate 3 distinct creative concept directions. Each must have a different core idea, hook style, and narrative approach.",
        "Every concept must include all required fields: title, hook, summary, structure, messagingIntegration, ctaApproach, moodAndTone, rationale.",
        "Hooks must be specific and visual: describe exactly what happens in the first 1-3 seconds. No generic openings like 'Have you ever wondered...' or 'POV:'.",
        "Structure must be 3-5 beats showing narrative progression from opening to close. Include timing/length guidance per beat.",
        "Messaging integration must explain how brand talking points weave in naturally, not as a script or ad read.",
        "CTA approach must feel creator-native: a natural recommendation, not a hard sell.",
        "Platform notes are required when the deliverable specifies a platform (TikTok, Instagram, YouTube). Adapt format, length, trends, and audience behavior per platform.",
        "Respect the do-not-mention list absolutely. Never reference topics, competitors, or claims listed there.",
        "Never invent product features, claims, or messaging points not present in the brief context.",
        "Use the full workspace context: brand overview, deal terms, risk flags, partnership summary, uploaded documents, and visual references should shape the ideas.",
        "If the workspace includes visual references, reflect them in the shot language, mood, pacing, styling, or setting choices.",
        "If the workspace includes risk flags or compliance constraints, avoid concepts that would make those issues worse or encourage unsupported claims.",
        "Concepts must feel authentic to a creator's voice and audience, not like a brand press release.",
        "If disclosure requirements exist, suggest where they naturally fit in the content flow.",
        "Each concept should be genuinely different: vary the hook style, narrative structure, tone, and CTA approach across the 3 concepts.",
      ]),
    },
    {
      tag: "few_shot_examples",
      content: [
        "<example_strong>",
        'Deliverable: 1x TikTok video (30-60s) for a skincare brand\nConcept: "The Mirror Swap"\nHook: "Creator opens medicine cabinet, every product is replaced with [Product]. Camera catches their genuine surprise at the first pump."\nStructure: Beat 1: Normal routine, reach for usual product (3s). Beat 2: Find [Product] instead, confused (2s). Beat 3: First application, real reaction (5s). Beat 4: Walk through texture/feel differences, tie to messaging points (15-20s). Beat 5: Soft CTA (3s).\nMessaging: The "what makes it different" beat covers key points as genuine discovery, not pitch.\nCTA: "Link in bio if you want to try the swap" positioned as sharing a find.',
        "</example_strong>",
        "",
        "<example_weak>",
        'Hook: "POV: You just discovered the best skincare product" — too generic, feels like an ad, no visual specificity.',
        "</example_weak>",
        "",
        "<example_platform_aware>",
        "TikTok: Hook must land in first 1.5s. Use native text overlays, not branded graphics. Natural sound on. 30-60s.\nInstagram Reel: Similar length but can be more polished. Music integration matters more. Hashtag strategy in caption.\nYouTube Integration: 60-90s within longer video. Can be more educational/detailed. Mid-roll placement works well.",
        "</example_platform_aware>",
      ].join("\n"),
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "concepts": [{ "title": "2-6 word name", "hook": "specific opening 1-3 seconds", "summary": "2-3 sentence concept description", "structure": "3-5 beat narrative flow with timing", "messagingIntegration": "how brand messages weave in naturally", "ctaApproach": "creator-native call to action", "platformNotes": "platform-specific guidance or null", "moodAndTone": "visual/tonal direction", "rationale": "why this works for brand + creator + audience" }] }.',
    },
  ]);
}

export function conceptGenerationUserPrompt(contextJson: string, deliverableLabel: string) {
  return joinPromptSections([
    {
      tag: "context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        `Target deliverable: ${deliverableLabel}`,
      ]),
    },
    {
      tag: "partnership_context",
      content: promptQuotedText(contextJson),
    },
    {
      tag: "task",
      content: `Generate 3 distinct creative concept directions for the target deliverable. Use the partnership context above, including deal terms, uploaded document excerpts, risk flags, and visual references when present. Respect all constraints, do-not-mention lists, and disclosure requirements. Make each concept genuinely different in approach, hook style, and tone.`,
    },
  ]);
}

export function conceptVariationUserPrompt(
  contextJson: string,
  deliverableLabel: string,
  baseConcept: { title: string; hook: string; summary: string; structure: string }
) {
  return joinPromptSections([
    {
      tag: "context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        `Target deliverable: ${deliverableLabel}`,
      ]),
    },
    {
      tag: "partnership_context",
      content: promptQuotedText(contextJson),
    },
    {
      tag: "base_concept",
      content: promptQuotedText(JSON.stringify(baseConcept, null, 2)),
    },
    {
      tag: "task",
      content: `Generate 2 creative variations on the base concept above for the target deliverable. Keep the core direction but explore different hooks, structural beats, CTA approaches, or tonal shifts. Use the full workspace context, uploaded references, and any risk or compliance constraints to keep the variations grounded. Each variation should feel fresh while staying true to the original concept's strength.`,
    },
  ]);
}

export function extractSectionSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You extract creator partnership facts from a single document section. You are strict, literal, and evidence-driven. Your goal is to extract REAL values from the document, not placeholders.",
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Return only facts that are explicitly stated in the section. Do not guess, infer, or fill gaps.",
        "Use null, empty arrays, or omission when the section does not support a field.",
        "Evidence snippets must be copied verbatim from the section: meaningful phrases or full sentences only. No bullets, headings, page labels, or isolated tokens.",
        "Do not resolve cross-document conflicts here. Section extraction is single-document grounding only.",
        "If a fact does not map cleanly to the schema, place it in notes instead of inventing a field.",
        "Adapt extraction to the document type: contracts yield structured terms, briefs yield deliverable specs and timelines, emails yield proposed terms, invoices yield payment evidence. Do not force fields that don't exist in the document type.",
      ]),
    },
    {
      tag: "field_extraction_rules",
      content: [
        "CRITICAL (most commonly confused):",
        "brandName: The company/entity name ONLY (e.g., 'NimbusPM', 'Nike'). NEVER document titles, section headers, product descriptions, or industry terms. 'NimbusPM Product Project management software' is WRONG; brandName is 'NimbusPM'. Look in contract parties ('by and between X and Y'), 'Brand:' labels, or names near payment/legal terms.",
        "campaignName: The specific campaign title (e.g., 'Summer Launch 2024'). NOT generic words or section headers like 'Campaign', 'Project', 'Brief', 'Campaign objective'.",
        "paymentAmount: Numeric value only. '$7,200' becomes 7200. NOT days (Net 45 is 45 days, not $45).",
        "netTermsDays: Numeric day count from 'Net 45', '45 days', 'due within 45 days'. null if not stated.",
        "",
        "STANDARD FIELDS (extract when stated):",
        "currency, paymentTerms, paymentStructure, paymentTrigger, deliverables (with channels and quantities), usageRights, usageDuration, usageTerritory, usageChannels, exclusivity, exclusivityDuration, exclusivityCategory, disclosureObligations, revisions, termination, terminationNotice, governingLaw, notes.",
        "",
        "BRIEF DATA (workflow details under briefData.*):",
        "campaignCode, jobNumber, referenceId, creatorHandle, agreementStartDate, agreementEndDate, executionTargetDate, conceptDueDate, draftDueDate, contentDueDate, campaignLiveDate, campaignFlight, postingSchedule, postDuration, amplificationPeriod, approvalRequirements, revisionRequirements, reportingRequirements, deliverablesSummary, deliverablePlatforms, requiredClaims, usageNotes, competitorRestrictions, paymentSchedule, paymentRequirements, paymentNotes, campaignNotes, linksAndAssets, promoCode.",
        "",
        "CONTACTS (external brand/agency ONLY, never creator contacts):",
        "brandContactName, brandContactTitle, brandContactEmail, brandContactPhone, agencyContactName, agencyContactTitle, agencyContactEmail, agencyContactPhone. Only when tied to approvals, operations, signatures, or contact blocks. Phone only when clearly in same contact block as email/name.",
      ].join("\n"),
    },
    {
      tag: "few_shot_examples",
      content: [
        "<example_complete>",
        'Section text: "This Agreement is entered into by NimbusPM (Company) and the Creator. Compensation: $7,200 USD, payable Net 45."',
        "Expected JSON output:",
        '{"data":{"brandName":"NimbusPM","paymentAmount":7200,"currency":"USD","paymentTerms":"Net 45","netTermsDays":45},"evidence":[{"fieldPath":"brandName","snippet":"NimbusPM (Company)","confidence":0.95},{"fieldPath":"paymentAmount","snippet":"$7,200 USD","confidence":0.95},{"fieldPath":"netTermsDays","snippet":"Net 45","confidence":0.9}],"confidence":0.92}',
        "</example_complete>",
        "",
        "<example_correct>",
        "Section text: This Usage Rights Addendum ('Agreement') is entered into by NimbusPM ('Company') and the Influencer ('Creator'). Company agrees to pay Creator $7,200.",
        "Extract: brandName='NimbusPM', paymentAmount=7200",
        "Even though the section header mentions 'Usage Rights Addendum', the actual brand is 'NimbusPM' from the contract parties.",
        "</example_correct>",
        "",
        "<example_wrong>",
        "Section text from a document titled 'Usage Rights Addendum' about content usage licensing.",
        "Bad extract: brandName='Usage Rights Addendum' (WRONG - this is a document title, not a brand name)",
        "Correct: brandName=null, put relevant terms in usageRights or notes.",
        "</example_wrong>",
        "",
        "<example_correct>",
        "Section text: Payment will be made within 45 days of receiving the final invoice.",
        "Extract: netTermsDays=45, paymentTerms='Net 45'",
        "Bad extract: paymentAmount=45 (WRONG - 45 is days, not dollars)",
        "</example_correct>",
        "",
        "<example_correct>",
        "Section text: Creator grants Brand the right to use the content in paid social advertisements for 90 days on LinkedIn and YouTube.",
        "Extract: usageRightsPaidAllowed=true, usageDuration='90 days', usageChannels=['LinkedIn', 'YouTube']",
        "</example_correct>",
        "",
        "<example_null>",
        "Section text: Campaign Brief Campaign objective: Generate demo requests from founder-led teams.",
        "Extract: campaignName=null ('Campaign objective' is a section header, not the campaign title)",
        "</example_null>",
        "",
        "<example_null>",
        "Section text: Influencer: [Insert Name] | Brand: [To Be Determined] | Campaign: [TBD]",
        "Extract: brandName=null, campaignName=null (template placeholders, not actual values)",
        "</example_null>",
      ].join("\n"),
    },
    {
      tag: "output_contract",
      content:
        'Before extracting, note any ambiguities or edge cases. Then return JSON: { "reasoning": "brief notes on ambiguous fields", "data": { ...creator_deal_terms_fields }, "evidence": [{ "fieldPath": "paymentTerms", "snippet": "exact text", "confidence": 0.84 }], "confidence": 0.0 }.',
    },
  ]);
}

export function extractSectionUserPrompt(
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
        `Section ${section.chunkIndex}: ${section.title}`,
      ]),
    },
    {
      tag: "section_text",
      content: promptQuotedText(section.content),
    },
    {
      tag: "prior_extraction",
      content: [
        "Overwrite these values ONLY if this section has more specific or contradictory info.",
        promptQuotedText(JSON.stringify(fallback.data, null, 2)),
      ].join("\n\n"),
    },
    {
      tag: "task",
      content: [
        "Extract creator partnership facts. Before each field confirm:",
        "1. Is it explicitly stated in the text?",
        "2. Is it a real value, not a placeholder or header?",
        "",
        "Fields to extract when stated: brandName, campaignName, paymentAmount, currency, paymentTerms, paymentStructure, paymentTrigger, netTermsDays, deliverables, usageRights, usageDuration, usageTerritory, usageChannels, exclusivity, exclusivityDuration, exclusivityCategory, disclosureObligations, revisions, termination, terminationNotice, governingLaw, notes.",
        "For workflow details that do not belong to top-level legal/payment fields, place them under briefData. Important briefData fields here: campaignCode, jobNumber, referenceId, creatorHandle, agreementStartDate, agreementEndDate, executionTargetDate, conceptDueDate, draftDueDate, contentDueDate, campaignLiveDate, campaignFlight, postingSchedule, postDuration, amplificationPeriod, approvalRequirements, revisionRequirements, reportingRequirements, deliverablesSummary, deliverablePlatforms, requiredClaims, usageNotes, competitorRestrictions, paymentSchedule, paymentRequirements, paymentNotes, campaignNotes.",
        "For external contacts, place them under briefData using only these fields when explicitly supported: brandContactName, brandContactTitle, brandContactEmail, brandContactPhone, agencyContactName, agencyContactTitle, agencyContactEmail, agencyContactPhone.",
        "",
        "Return null for any field not explicitly stated.",
      ].join("\n"),
    },
  ]);
}

export function analyzeRisksSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You flag creator-relevant risks in partnership documents. Only flag items needing creator attention or negotiation.",
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
        "Do not restate normal terms as risks. A clear deliverable with a date is not a risk.",
      ]),
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
        "</example>",
        "",
        '<example doc_type="email">',
        'Email text: "Hey! Just checking in, wanted to see if you had any questions about the brief?"',
        "Do NOT flag. This is a soft follow-up email with no creator risk.",
        "</example>",
        "",
        '<example doc_type="brief">',
        'Brief text: "Creator must submit content within 48 hours of receiving the product."',
        "Good: category=deliverables, severity=medium, title='Tight turnaround window', evidence=[that exact sentence].",
        "</example>",
        "",
        '<example doc_type="invoice">',
        'Invoice text: "Payment will be processed within 90 days of campaign completion."',
        "Good: category=payment_terms, severity=high, title='Extended payment terms', evidence=[that exact sentence].",
        "</example>",
      ].join("\n"),
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "riskFlags": [{ "category": "usage_rights|exclusivity|payment_terms|deliverables|termination|other", "title": "short label", "detail": "plain-language explanation", "severity": "low|medium|high", "suggestedAction": "practical negotiation step or null", "evidence": ["quoted snippet from document"] }] }.',
    },
  ]);
}

export function analyzeRisksUserPrompt(
  text: string,
  documentKind: DocumentKind,
  extraction: ExtractionPipelineResult,
  fallback: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>
) {
  return joinPromptSections([
    {
      tag: "context",
      content: promptBullets([`Today: ${isoDateContext()}`, `Document kind: ${documentKind}`]),
    },
    {
      tag: "document_text",
      content: promptQuotedText(text),
    },
    {
      tag: "extracted_facts",
      content: promptQuotedText(JSON.stringify(extraction.data, null, 2)),
    },
    {
      tag: "prior_risks",
      content: promptQuotedText(JSON.stringify(fallback, null, 2)),
    },
    {
      tag: "task",
      content:
        "Return only creator-relevant risk flags directly supported by the document text and extracted facts.",
    },
  ]);
}

export function summarySystemPrompt(mode: "default" | "rewrite") {
  const roleDescription =
    mode === "rewrite"
      ? "You rewrite creator contract summaries into shorter, scannable versions without changing meaning."
      : "You write scannable creator partnership summaries. The reader must understand the deal in under 30 seconds.";

  return joinPromptSections([
    {
      tag: "role",
      content: roleDescription,
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Produce exactly these 5 sections, in order: 'What this partnership is', 'What you deliver', 'What you get paid', 'Rights and restrictions', 'Watchouts'.",
        "Each section: 1-3 sentences. Entire summary must fit on one phone screen.",
        "Lead with what matters: what to post, when it is due, how they get paid, what is risky.",
        "Preserve material obligations, payment facts, exclusivity, rights limits, and watchouts. State each in fewest words.",
        "Creator-facing plain language. Not legalistic.",
        "Plain text only. No markdown, bullets, asterisks, or underscores.",
        "If nothing notable for a section, write 'Not specified.' in one sentence.",
      ]),
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "sections": [{ "title": "What this partnership is", "paragraphs": ["plain text"] }], "body": "full plain text summary" }.',
    },
  ]);
}

export function summaryUserPrompt(input: {
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
          content: promptQuotedText(JSON.stringify(input.extraction.data, null, 2)),
        }
      : null,
    input.risks
      ? {
          tag: "risk_flags",
          content: promptQuotedText(JSON.stringify(input.risks, null, 2)),
        }
      : null,
    input.baseSummary
      ? {
          tag: "current_summary",
          content: promptQuotedText(input.baseSummary),
        }
      : null,
    input.grounding
      ? {
          tag: "grounding",
          content: promptQuotedText(JSON.stringify(input.grounding, null, 2)),
        }
      : null,
    {
      tag: "fallback_summary",
      content: promptQuotedText(input.fallbackBody),
    },
    {
      tag: "task",
      content: input.styleInstruction
        ? `Type: ${input.targetType}. ${input.styleInstruction}`
        : "Write the creator-facing summary from the extracted facts and risk flags above.",
    },
  ];

  return joinPromptSections(sections);
}

export function briefExtractionSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You extract campaign-brief fields from partnership documents. Strict: only capture what is explicitly stated.",
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Source types vary: formal briefs, contracts, riders, term sheets, welcome kits, FAQ agreements, calendars, image one-pagers, pitch decks, storyboards, moodboards, creative feedback, and status updates are all valid sources.",
        "Return null or empty arrays for anything not found. Do not invent messaging, approvals, or audience details.",
        "Use doNotMention for prohibited claims, banned phrasing, or explicit avoid lists.",
        "Use requiredClaims for mandatory talking points, hashtags, disclaimers, or statements the creator must include.",
        "Use linksAndAssets for explicit URLs, asset folders, drive links, or reference links the creator is expected to use.",
        "Keep creator-operational timeline data when stated: agreement dates, signature targets, concept due date, draft due date, content live date, campaign flight, post duration, amplification period, and reporting requirements.",
        "Keep payment workflow data when stated if it affects operations: payment schedule, payment trigger dependencies, invoice/live-link/screenshot requirements, and payout prerequisites.",
        "Ignore purely legal boilerplate unless it directly shapes the creator brief experience.",
      ]),
    },
    {
      tag: "output_contract",
      content:
        "Return JSON: { campaignOverview, campaignCode, jobNumber, referenceId, messagingPoints, talkingPoints, creativeConceptOverview, requiredClaims, brandGuidelines, approvalRequirements, revisionRequirements, targetAudience, toneAndStyle, deliverablesSummary, deliverablePlatforms, creatorHandle, postingSchedule, agreementStartDate, agreementEndDate, executionTargetDate, conceptDueDate, campaignLiveDate, campaignFlight, draftDueDate, contentDueDate, postDuration, amplificationPeriod, usageNotes, disclosureRequirements, competitorRestrictions, linksAndAssets, promoCode, paymentSchedule, paymentRequirements, paymentNotes, reportingRequirements, campaignNotes, doNotMention, brandContactName, brandContactTitle, brandContactEmail, brandContactPhone, agencyContactName, agencyContactTitle, agencyContactEmail, agencyContactPhone }. Null or [] for missing fields.",
    },
  ]);
}

export function briefGenerationSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You write polished, actionable campaign briefs for creators from partnership context.",
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Use provided context only. Do not invent terms, dates, or requirements.",
        "Preserve risks, deliverables, timing, rights, and approval constraints when present.",
        "Pre-fill from briefData when available, improve clarity and organization.",
        "Each section: id, title, content required. items is optional.",
      ]),
    },
    {
      tag: "section_ids",
      content: promptBullets(BRIEF_SECTION_IDS.map((id) => `"${id}"`)),
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "sections": [{ "id": "campaign-overview", "title": "...", "content": "...", "items": ["..."] }] }.',
    },
  ]);
}

export function clauseConsolidationSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You consolidate repeated creator partnership contract clauses after structured extraction. You are not an extractor. You rewrite only the provided extracted snippets into concise, faithful summaries.",
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
        "Write in plain text only. No markdown bullets, no numbered lists, no headings.",
      ]),
    },
    {
      tag: "output_contract",
      content:
        'Return JSON: { "usageRights": "...", "exclusivity": "...", "deliverablesSummary": "...", "termination": "...", "notes": "..." }.',
    },
  ]);
}

export function clauseConsolidationUserPrompt(input: ClauseConsolidationInput) {
  return joinPromptSections([
    {
      tag: "context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        "Source: extracted clause snippets",
        "Task: summarize repeated occurrences for downstream deal terms",
      ]),
    },
    {
      tag: "fallback_values",
      content: promptQuotedText(JSON.stringify(input.fallback, null, 2)),
    },
    {
      tag: "usage_rights_snippets",
      content: promptQuotedText(JSON.stringify(input.usageRights, null, 2)),
    },
    {
      tag: "exclusivity_snippets",
      content: promptQuotedText(JSON.stringify(input.exclusivity, null, 2)),
    },
    {
      tag: "deliverables_snippets",
      content: promptQuotedText(JSON.stringify(input.deliverables, null, 2)),
    },
    {
      tag: "termination_snippets",
      content: promptQuotedText(JSON.stringify(input.termination, null, 2)),
    },
    {
      tag: "notes_snippets",
      content: promptQuotedText(JSON.stringify(input.notes, null, 2)),
    },
  ]);
}
