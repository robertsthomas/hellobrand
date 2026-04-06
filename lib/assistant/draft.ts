import { z } from "zod";

import { aiCachePolicy } from "@/lib/ai/gateway";
import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptNumbered,
  promptQuotedText
} from "@/lib/ai/prompting";
import { runStructuredOpenRouterTask } from "@/lib/ai/structured";
import { replaceDashesWithCommas } from "@/lib/assistant/text";
import { generateEmailDraft } from "@/lib/email/generate";
import type {
  AssistantClientContext,
  AssistantTone,
  DealAggregate,
  DraftIntent,
  ProfileRecord,
  Viewer
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const assistantDraftSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1)
});

function toneInstruction(tone: AssistantTone) {
  switch (tone) {
    case "friendly":
      return "Write in a friendly, approachable tone. Keep it warm and specific.";
    case "direct":
      return "Write in a direct tone. Keep it concise, sharp, and easy to scan.";
    case "warm":
      return "Write in a warm, human tone. Keep it supportive without becoming vague.";
    case "professional":
    default:
      return "Write in a professional tone. Keep it polished, practical, and business-ready.";
  }
}

function intentGuidance(intent: DraftIntent | null | undefined) {
  switch (intent) {
    case "clarify-clause":
      return "Job: clarify a clause or ambiguous term before the creator commits.";
    case "request-faster-payment":
      return "Job: request shorter payment timing without implying the brand already agreed.";
    case "limit-usage-rights":
      return "Job: narrow usage scope, duration, territory, channels, or paid media rights and protect leverage.";
    case "clarify-deadline":
      return "Job: confirm deadlines, production timing, and approval windows before committing.";
    case "payment-reminder":
      return "Job: follow up on payment politely, ask what is still needed, and keep momentum on the receivable.";
    case "request-contract-revisions":
      return "Job: request contract revisions on the creator's highest-priority concerns and offer next steps.";
    case "confirm-deliverables":
      return "Job: confirm the current deliverables list and invite corrections before production starts.";
    case "confirm-revised-brief":
      return "Job: confirm receipt of the revised brief, show alignment, and clarify what changed if needed.";
    default:
      return "Job: draft the next creator-professional email that moves the partnership forward.";
  }
}

function topRiskLines(partnership: DealAggregate) {
  const severityRank = { high: 0, medium: 1, low: 2 } as const;

  return [...partnership.riskFlags]
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
    .slice(0, 4)
    .map((flag) => {
      const suggestedAction = flag.suggestedAction?.trim()
        ? ` Suggested action: ${flag.suggestedAction.trim()}`
        : "";

      return `[${flag.severity}] ${flag.title}: ${flag.detail}${suggestedAction}`;
    });
}

function evidenceLines(partnership: DealAggregate) {
  return partnership.extractionEvidence
    .slice(0, 4)
    .map((entry) => `${entry.fieldPath}: ${entry.snippet}`);
}

function workspaceSnapshot(partnership: DealAggregate) {
  const deliverables = partnership.terms?.deliverables ?? [];

  return [
    `Brand: ${partnership.deal.brandName}`,
    `Campaign: ${partnership.deal.campaignName}`,
    `Status: ${partnership.deal.status}`,
    `Payment status: ${partnership.deal.paymentStatus}`,
    `Payment amount: ${
      partnership.terms?.paymentAmount !== null &&
      partnership.terms?.paymentAmount !== undefined
        ? formatCurrency(
            partnership.terms.paymentAmount,
            partnership.terms?.currency ?? "USD"
          )
        : "Unknown"
    }`,
    `Payment terms: ${partnership.terms?.paymentTerms ?? "Unknown"}`,
    `Payment trigger: ${partnership.terms?.paymentTrigger ?? "Unknown"}`,
    `Usage rights: ${partnership.terms?.usageRights ?? "Unknown"}`,
    `Usage duration: ${partnership.terms?.usageDuration ?? "Unknown"}`,
    `Usage territory: ${partnership.terms?.usageTerritory ?? "Unknown"}`,
    `Usage channels: ${
      partnership.terms?.usageChannels?.join(", ") || "Unknown"
    }`,
    `Exclusivity: ${
      partnership.terms?.exclusivityApplies === null
        ? "Unknown"
        : partnership.terms?.exclusivityApplies
          ? "Yes"
          : "No"
    }`,
    `Exclusivity category: ${partnership.terms?.exclusivityCategory ?? "Unknown"}`,
    `Exclusivity duration: ${partnership.terms?.exclusivityDuration ?? "Unknown"}`,
    `Approval requirements: ${partnership.terms?.briefData?.approvalRequirements ?? "Unknown"}`,
    `Revisions: ${partnership.terms?.revisions ?? "Unknown"}`,
    `Deliverables: ${
      deliverables.length > 0
        ? deliverables
            .slice(0, 5)
            .map(
              (item) =>
                `${item.quantity ?? 1} ${item.title}${
                  item.dueDate ? ` due ${formatDate(item.dueDate)}` : ""
                }`
            )
            .join(", ")
        : "None extracted"
    }`,
    `Current workspace summary: ${
      partnership.currentSummary?.body ??
      partnership.deal.summary ??
      "No current summary available."
    }`
  ].join("\n");
}

function buildGenericFallback(subjectBase: string, recipient: string, focus: string, sender: string) {
  return {
    subject: `${subjectBase} follow-up`,
    body:
      `Hi ${recipient},\n\n` +
      `I’m following up on ${focus}. I want to make sure we’re aligned on the current terms and next steps before moving forward.\n\n` +
      "If helpful, I can send proposed wording or a clean summary of what I’m asking to revise.\n\n" +
      `Best,\n${sender}`
  };
}

function normalizeDraftText(value: string) {
  return replaceDashesWithCommas(
    value
      .replace(/\r\n/g, "\n")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "")
      .replace(/\[Brand\/Agency Name\]/gi, "there")
      .replace(/\[Brand Name\]/gi, "there")
      .replace(/\[Agency Name\]/gi, "there")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function assistantDraftSystemPrompt(input: {
  intent: DraftIntent | null;
  tone: AssistantTone;
}) {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You draft creator-professional outbound emails inside HelloBrand. Your job is to produce one usable message grounded in saved workspace facts, not generic AI filler."
    },
    {
      tag: "instruction_hierarchy",
      content: promptNumbered([
        "Saved workspace facts are highest priority.",
        "Then use the requested draft job, current page context, and trigger context.",
        "Use evidence and risk guidance to shape the ask, but do not copy snippets verbatim unless they fit naturally.",
        "If a fact is unknown, avoid asserting it as true."
      ])
    },
    {
      tag: "draft_job",
      content: intentGuidance(input.intent)
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Never invent approvals, dates, deliverables, rights, payment timing, promised revisions, or prior agreements.",
        "Preserve creator leverage by clearly separating confirmed facts from requested changes, questions, or negotiation asks.",
        "If the workspace shows a risky term, frame the email as a request, revision, clarification, or follow-up, not as if the brand already accepted a change.",
        "If conflicting facts or missing details make the next step unsafe, ask a focused clarifying question instead of pretending the issue is resolved.",
        "Keep the draft concise, specific, and creator-professional, not robotic or overly formal.",
        "Write plain email prose only, not markdown.",
        "Do not use bullets, numbered lists, headings, placeholder names, or legal-sounding bluff language.",
        "If the recipient is unknown, use a natural greeting like Hi there, or Hi {brand} team,.",
        `Today: ${isoDateContext()}`,
        "Never use em dashes or en dashes. Replace them with commas."
      ])
    },
    {
      tag: "few_shot_examples",
      content: [
        "<example name=\"protect_leverage_on_payment\">",
        "Workspace fact: Payment terms are Net 45.",
        "Requested job: Ask for Net 15.",
        "Correct behavior: Ask whether the brand can revise the timing to Net 15. Do not say Net 15 was already agreed.",
        "</example>",
        "",
        "<example name=\"grounded_usage_pushback\">",
        "Workspace fact: Usage rights include paid social and whitelisting.",
        "Correct behavior: Ask to narrow usage or separate paid usage compensation. Do not overstate what the contract says if the scope is still unclear.",
        "</example>"
      ].join("\n")
    },
    {
      tag: "style",
      content: promptBullets([
        toneInstruction(input.tone),
        "Sound like a creator who understands the deal and knows what they need.",
        "Optimize for clear next steps, not legal theatrics."
      ])
    },
    {
      tag: "output_contract",
      content: 'Return JSON with exactly this shape: { "subject": "string", "body": "string" }.'
    }
  ]);
}

function assistantDraftUserPrompt(input: {
  partnership: DealAggregate;
  context: AssistantClientContext;
  focus: string;
  recipient: string | null;
  sender: string;
  intent: DraftIntent | null;
}) {
  const risks = topRiskLines(input.partnership);
  const evidence = evidenceLines(input.partnership);

  return joinPromptSections([
    {
      tag: "workspace_snapshot",
      content: promptQuotedText(workspaceSnapshot(input.partnership))
    },
    {
      tag: "assistant_context",
      content: promptBullets([
        `Current page: ${input.context.pageTitle} (${input.context.pathname})`,
        input.context.tab ? `Current partnership tab: ${input.context.tab}` : null,
        input.context.profileLocation
          ? `Creator location context: ${input.context.profileLocation}`
          : null,
        input.context.trigger?.label ? `Trigger label: ${input.context.trigger.label}` : null,
        input.context.trigger?.prompt ? `Trigger prompt: ${input.context.trigger.prompt}` : null
      ])
    },
    {
      tag: "risk_context",
      content: risks.length > 0 ? promptBullets(risks) : "No active risk flags."
    },
    {
      tag: "evidence_context",
      content: evidence.length > 0 ? promptBullets(evidence) : "No extracted evidence snippets."
    },
    {
      tag: "draft_request",
      content: promptBullets([
        `Requested move: ${input.focus}`,
        input.intent ? `Intent: ${input.intent}` : null,
        `Recipient hint: ${input.recipient ?? `${input.partnership.deal.brandName} team`}`,
        `Signature: ${input.sender}`
      ])
    },
    {
      tag: "task",
      content:
        "Draft one creator-facing outbound email that fits the requested move and stays grounded in the saved partnership facts."
    }
  ]);
}

export async function generateAssistantWorkspaceDraft(input: {
  viewer: Viewer;
  partnership: DealAggregate;
  profile: ProfileRecord | null;
  context: AssistantClientContext;
  focus: string;
  recipient?: string | null;
  intent?: DraftIntent | null;
}) {
  const sender =
    input.profile?.preferredSignature?.trim() ||
    input.profile?.displayName?.trim() ||
    input.viewer.displayName;
  const fallback = input.intent
    ? generateEmailDraft(input.partnership, input.intent, sender)
    : buildGenericFallback(
        input.partnership.deal.campaignName || input.partnership.deal.brandName,
        input.recipient ?? `${input.partnership.deal.brandName} team`,
        input.focus,
        sender
      );
  const systemPrompt = assistantDraftSystemPrompt({
    intent: input.intent ?? null,
    tone: input.context.tone
  });
  const userPrompt = assistantDraftUserPrompt({
    partnership: input.partnership,
    context: input.context,
    focus: input.focus,
    recipient: input.recipient ?? null,
    sender,
    intent: input.intent ?? null
  });

  const result = await runStructuredOpenRouterTask({
    context: {
      userId: input.viewer.id,
      taskKey: "email_draft",
      featureKey: "assistant_chat",
      metadata: {
        dealId: input.partnership.deal.id,
        source: "assistant_workspace_draft",
        intent: input.intent ?? null
      }
    },
    systemPrompt,
    userPrompt,
    temperature: input.intent === "payment-reminder" ? 0.25 : 0.35,
    schema: assistantDraftSchema,
    fallback,
    cache: aiCachePolicy({
      taskKey: "email_draft",
      userId: input.viewer.id,
      scopeKey: [
        "assistant-workspace-draft",
        input.partnership.deal.id,
        input.partnership.deal.updatedAt,
        input.intent ?? "custom"
      ].join(":"),
      input: {
        focus: input.focus,
        recipient: input.recipient ?? null,
        context: {
          pathname: input.context.pathname,
          tab: input.context.tab,
          profileLocation: input.context.profileLocation,
          tone: input.context.tone,
          trigger: input.context.trigger
        },
        workspaceSummary: workspaceSnapshot(input.partnership)
      }
    })
  });

  const draft = result?.data ?? fallback;

  return {
    subject: normalizeDraftText(draft.subject),
    body: normalizeDraftText(draft.body)
  };
}
