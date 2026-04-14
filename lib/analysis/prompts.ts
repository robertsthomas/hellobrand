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

export { BRIEF_SECTION_IDS };

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
        "brandName: The company/entity name ONLY (e.g., 'NimbusPM', 'Nike'). NEVER document titles, section headers, product descriptions, industry terms, or descriptors appended to the name. 'NimbusPM Product Project management software' is WRONG; the brandName is 'NimbusPM'. Look for company names in contract parties ('by and between X and Y'), 'Brand:' labels, or names near payment/legal terms.",
        "campaignName: The specific campaign title (e.g., 'Summer Launch 2024'). NOT generic words or section headers like 'Campaign', 'Project', 'Brief', 'Overview', 'Campaign objective', or 'Brief Campaign objective'.",
        "paymentAmount: Numeric value only. '$7,200' or 'USD 7200' or '$7.2k' all become 7200. If no amount stated, return null.",
        "currency: Currency code (USD, EUR, GBP). Default to 'USD' only if there's a payment amount without explicit currency.",
        "paymentTerms: The stated payment timing phrase, especially net terms, milestone timing, or due-date language. Examples: 'Net 30', 'due within 15 days', '50% on signature and 50% net-30 after final live links'.",
        "paymentStructure: The payout split or structure when explicitly stated. Examples: 'Flat fee', '50% on signature, 50% on completion', 'monthly retainer'.",
        "paymentTrigger: The event that causes payment. Examples: 'On signature', 'After final live links', 'After invoice receipt'.",
        "netTermsDays: Numeric day count from 'Net 45', '45 days', 'due within 45 days'. If not stated, null.",
        "deliverables: Content requirements with channels and quantities. Map format specs (Reel, TikTok, Story) to deliverables with channels.",
        "disclosureObligations: FTC, platform-specific labeling requirements (e.g., #ad, verbal mentions).",
        "briefData.campaignCode / jobNumber / referenceId: Campaign code, job number, ref ID, or internal identifiers when explicitly stated.",
        "briefData.creatorHandle: The creator-facing account or handle to post from when explicitly stated.",
        "briefData.agreementStartDate / agreementEndDate / executionTargetDate: Agreement term dates or signature/countersign target dates when explicitly labeled.",
        "briefData.conceptDueDate / draftDueDate / contentDueDate / campaignLiveDate: Milestone dates for concept submission, first draft, final content delivery, and go-live when explicitly labeled.",
        "briefData.campaignFlight / postingSchedule / postDuration / amplificationPeriod: Flight window, posting schedule, post-live duration, or paid amplification period when explicitly stated.",
        "briefData.approvalRequirements / revisionRequirements / reportingRequirements: Approval turnaround, revision turnaround, and metrics/reporting obligations that shape creator workflow.",
        "briefData.paymentSchedule / paymentRequirements / paymentNotes: Payment splits, timing, invoice/live-link/screenshot prerequisites, or operational payment instructions that matter to the creator.",
        "briefData.deliverablesSummary / deliverablePlatforms / usageNotes / competitorRestrictions / campaignNotes / linksAndAssets / promoCode: Use these for creator-operational details, links, codes, or assets that matter but do not map cleanly to top-level terms.",
        "briefData.requiredClaims: Required talking points, mandatory claims, exact hashtags, or must-say statements that the creator needs easy access to.",
        "briefData.brandContactName / Title / Email / Phone and briefData.agencyContactName / Title / Email / Phone: External points of contact ONLY. Extract only brand-side or agency-side contacts that are explicitly tied to approvals, campaign operations, signatures, or 'contact/questions' blocks.",
        "Never use creator, talent, or influencer contact details for any brandContact* or agencyContact* field. If the document only includes creator contact info, leave all contact fields null.",
        "Only return a phone number when it is clearly attached to the same external contact block as the chosen email/name/title. If unclear, return null for phone.",
      ].join("\n"),
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
        "</example_null>",
      ].join("\n"),
    },
    {
      tag: "output_contract",
      content:
        'Return JSON with this shape: { "data": { ...creator_deal_terms_fields }, "evidence": [{ "fieldPath": "paymentTerms", "snippet": "exact text", "confidence": 0.84 }], "confidence": 0.0 }.',
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
        "1-3 short sentences per section max. Entire summary must fit on one phone screen.",
        "Lead with what matters: what to post, when it is due, how they get paid, what is risky.",
        "Preserve material obligations, payment facts, exclusivity, rights limits, and watchouts. State each in fewest words.",
        "Creator-facing plain language. Not legalistic.",
        "Plain text only. No markdown, bullets, asterisks, or underscores.",
        'Required section titles: "What this partnership is", "What you deliver", "What you get paid", "Rights and restrictions", "Watchouts".',
        "If nothing notable for a section, say so in one sentence. If a fact is missing, write Not specified.",
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
