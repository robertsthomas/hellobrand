import { z } from "zod";

import { joinPromptSections, promptNumbered, promptQuotedText } from "@/lib/ai/prompting";
import { aiCachePolicy } from "@/lib/ai/gateway";
import { runStructuredOpenRouterTask } from "@/lib/ai/structured";
import { buildEmailMessageVersion } from "@/lib/email/reply-suggestion-version";
import type { DealAggregate, EmailActionItemRecord, EmailMessageRecord } from "@/lib/types";

interface ActionItemDraft {
  action: string;
  dueDate: string | null;
  urgency: EmailActionItemRecord["urgency"];
  sourceText: string | null;
}

const actionItemsSchema = z.object({
  items: z
    .array(
      z.object({
        action: z.string().trim().min(1),
        dueDate: z.string().trim().nullable(),
        urgency: z.enum(["low", "medium", "high"]),
        sourceText: z.string().trim().nullable(),
      })
    )
    .max(5),
});

const ASK_PATTERNS: Array<{
  pattern: RegExp;
  urgencyHint: ActionItemDraft["urgency"];
}> = [
  { pattern: /\b(?:please\s+)?send\s+(?:over|us|me)\s+(.{5,80}?)(?:\.|$)/i, urgencyHint: "medium" },
  { pattern: /\b(?:can|could)\s+you\s+(.{5,80}?)(?:\?|$)/i, urgencyHint: "medium" },
  { pattern: /\bneed\s+you\s+to\s+(.{5,80}?)(?:\.|$)/i, urgencyHint: "high" },
  {
    pattern:
      /\bplease\s+(?:confirm|review|approve|sign|submit|share|upload|provide)\s+(.{5,80}?)(?:\.|$)/i,
    urgencyHint: "medium",
  },
  { pattern: /\blet\s+(?:me|us)\s+know\s+(.{5,60}?)(?:\.|$)/i, urgencyHint: "low" },
  {
    pattern:
      /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end\s+of\s+(?:day|week)|eod|eow|\d{1,2}\/\d{1,2})/i,
    urgencyHint: "high",
  },
];

const DATE_PATTERNS = [
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\bby\s+(tomorrow)/i,
  /\bby\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  /\bdue\s+(?:by\s+)?(\w+\s+\d{1,2}(?:,?\s*\d{4})?)/i,
  /\bdeadline[:\s]+(\w+\s+\d{1,2}(?:,?\s*\d{4})?)/i,
  /\b(end\s+of\s+(?:day|week|month)|eod|eow)\b/i,
];

function extractDateHint(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function regexFallbackExtraction(message: EmailMessageRecord): ActionItemDraft[] {
  if (message.direction === "outbound") {
    return [];
  }

  const text = (message.textBody ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return [];
  }

  const items: ActionItemDraft[] = [];
  const seen = new Set<string>();

  for (const { pattern, urgencyHint } of ASK_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const action = match[1]?.trim() ?? match[0].trim();
    const normalized = action
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
    if (normalized.length < 8 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    const dateHint = extractDateHint(text);

    items.push({
      action: action.charAt(0).toUpperCase() + action.slice(1),
      dueDate: null,
      urgency: dateHint ? "high" : urgencyHint,
      sourceText: match[0].slice(0, 200),
    });
  }

  return items.slice(0, 5);
}

export async function extractActionItemsFromMessage(
  message: EmailMessageRecord,
  aggregate: DealAggregate | null
): Promise<ActionItemDraft[]> {
  if (message.direction === "outbound") {
    return [];
  }

  const text = (message.textBody ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length < 20) {
    return [];
  }

  const fallback = regexFallbackExtraction(message);
  const dealContext = aggregate
    ? `Deal: ${aggregate.deal.brandName} - ${aggregate.deal.campaignName}. Status: ${aggregate.deal.status}.`
    : "No linked deal context.";
  const cache = aiCachePolicy({
    taskKey: "email_action_items",
    scopeKey: `email-action-items:${message.id}:${buildEmailMessageVersion(message)}`,
    input: {
      dealContext,
      from: message.from?.email ?? "unknown",
      subject: message.subject,
      text: text.slice(0, 3000),
    },
  });

  const structuredFallback = {
    items: fallback,
  };

  const result = await runStructuredOpenRouterTask({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_action_items",
    },
    systemPrompt: joinPromptSections([
      {
        tag: "role",
        content: "You extract creator action items from inbound brand partnership emails.",
      },
      {
        tag: "rules",
        content: promptNumbered([
          "Only include concrete, specific asks that require the creator to DO something — such as sign, submit, send a document, upload content, confirm a date, or provide specific information.",
          'Do NOT include vague, generic, or low-value phrases like "let me know if you\'re interested", "let us know your rates", "feel free to reach out", "looking forward to hearing from you", or other pleasantries.',
          "Do NOT include anything that is just a soft invitation to reply — only extract items where the brand clearly needs a specific deliverable or decision from the creator.",
          'Use a short imperative sentence for "action" that states what the creator must do.',
          'Use "dueDate" only when an explicit date is present in the email. Otherwise return null.',
          'Set urgency to "high" only for items with an explicit deadline or time pressure, "medium" for clear concrete asks, and "low" for soft follow-ups.',
          'Use "sourceText" for the exact sentence or phrase containing the ask.',
          "Skip commitments made by the brand (things THEY will do).",
          "When in doubt, exclude the item. It is better to return an empty list than to surface noise.",
          'Return JSON with this shape: { "items": [{ "action": "...", "dueDate": "YYYY-MM-DD" or null, "urgency": "low|medium|high", "sourceText": "..." }] }.',
        ]),
      },
      {
        tag: "negative_examples",
        content: [
          "<bad_example>",
          'Email sentence: "Let me know if you\'re interested and your rates."',
          "Why this is BAD: This is a soft, generic invitation — not a concrete ask. The brand is fishing for interest, not requesting a deliverable.",
          "Output: no item.",
          "</bad_example>",
          "",
          "<bad_example>",
          'Email sentence: "Let us know if you have any questions."',
          "Why this is BAD: Generic closing pleasantry, not an action item.",
          "Output: no item.",
          "</bad_example>",
          "",
          "<bad_example>",
          'Email sentence: "We\'d love to collaborate with you."',
          "Why this is BAD: Expression of interest, not an ask.",
          "Output: no item.",
          "</bad_example>",
        ].join("\n"),
      },
      {
        tag: "few_shot_examples",
        content: [
          "<example>",
          "Email sentence: Please send over your final invoice by April 4.",
          'Output item: { "action": "Send the final invoice", "dueDate": "2026-04-04", "urgency": "high", "sourceText": "Please send over your final invoice by April 4." }',
          "</example>",
          "",
          "<example>",
          "Email sentence: We will review the draft internally tomorrow and send notes.",
          "Output: no item, because this is the brand's commitment, not an ask directed at the creator.",
          "</example>",
          "",
          "<example>",
          "Email sentence: Could you sign and return the attached agreement by Friday?",
          'Output item: { "action": "Sign and return the agreement", "dueDate": null, "urgency": "high", "sourceText": "Could you sign and return the attached agreement by Friday?" }',
          "</example>",
          "",
          "<example>",
          "Email: Hi! We came across your profile and think you'd be a great fit. Let us know your rates and if you're interested.",
          "Output: no items. This is an initial outreach with no concrete deliverable or deadline.",
          "</example>",
        ].join("\n"),
      },
    ]),
    userPrompt: joinPromptSections([
      {
        tag: "deal_context",
        content: dealContext,
      },
      {
        tag: "message_metadata",
        content: `From: ${message.from?.email ?? "unknown"}\nSubject: ${message.subject}`,
      },
      {
        tag: "message_text",
        content: promptQuotedText(
          text.length > 3000 ? text.slice(0, 2000) + "\n...\n" + text.slice(-1000) : text
        ),
      },
      {
        tag: "task",
        content: "Extract up to 5 creator action items from the email above.",
      },
    ]),
    temperature: 0.15,
    schema: actionItemsSchema,
    fallback: structuredFallback,
    cache,
  });

  const items = result?.data?.items ?? structuredFallback.items;

  return items
    .filter((item) => item.action.trim().length > 0)
    .map((item) => ({
      action: item.action.trim(),
      dueDate: item.dueDate?.match(/^\d{4}-\d{2}-\d{2}$/) ? item.dueDate : null,
      urgency: item.urgency,
      sourceText: item.sourceText?.slice(0, 200) ?? null,
    }))
    .slice(0, 5);
}
