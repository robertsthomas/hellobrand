import OpenAI from "openai";

import { getEmailSummaryModel } from "@/lib/email/config";
import type {
  DealAggregate,
  EmailActionItemRecord,
  EmailMessageRecord
} from "@/lib/types";

interface ActionItemDraft {
  action: string;
  dueDate: string | null;
  urgency: EmailActionItemRecord["urgency"];
  sourceText: string | null;
}

function providerConfig() {
  if (!process.env.OPENROUTER_API_KEY) {
    return null;
  }

  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ||
        process.env.INTEGRATIONS_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3011",
      "X-Title": process.env.OPENROUTER_APP_NAME || "HelloBrand"
    }
  };
}

function client() {
  const config = providerConfig();
  if (!config) {
    return null;
  }

  return new OpenAI(config);
}

const ASK_PATTERNS: Array<{
  pattern: RegExp;
  urgencyHint: ActionItemDraft["urgency"];
}> = [
  { pattern: /\b(?:please\s+)?send\s+(?:over|us|me)\s+(.{5,80}?)(?:\.|$)/i, urgencyHint: "medium" },
  { pattern: /\b(?:can|could)\s+you\s+(.{5,80}?)(?:\?|$)/i, urgencyHint: "medium" },
  { pattern: /\bneed\s+you\s+to\s+(.{5,80}?)(?:\.|$)/i, urgencyHint: "high" },
  { pattern: /\bplease\s+(?:confirm|review|approve|sign|submit|share|upload|provide)\s+(.{5,80}?)(?:\.|$)/i, urgencyHint: "medium" },
  { pattern: /\blet\s+(?:me|us)\s+know\s+(.{5,60}?)(?:\.|$)/i, urgencyHint: "low" },
  { pattern: /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end\s+of\s+(?:day|week)|eod|eow|\d{1,2}\/\d{1,2})/i, urgencyHint: "high" }
];

const DATE_PATTERNS = [
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\bby\s+(tomorrow)/i,
  /\bby\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  /\bdue\s+(?:by\s+)?(\w+\s+\d{1,2}(?:,?\s*\d{4})?)/i,
  /\bdeadline[:\s]+(\w+\s+\d{1,2}(?:,?\s*\d{4})?)/i,
  /\b(end\s+of\s+(?:day|week|month)|eod|eow)\b/i
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
    const normalized = action.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    if (normalized.length < 8 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    const dateHint = extractDateHint(text);

    items.push({
      action: action.charAt(0).toUpperCase() + action.slice(1),
      dueDate: null,
      urgency: dateHint ? "high" : urgencyHint,
      sourceText: match[0].slice(0, 200)
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

  const api = client();
  if (!api) {
    return regexFallbackExtraction(message);
  }

  const dealContext = aggregate
    ? `Deal: ${aggregate.deal.brandName} - ${aggregate.deal.campaignName}. Status: ${aggregate.deal.status}.`
    : "No linked deal context.";

  try {
    const response = await api.chat.completions.create({
      model: getEmailSummaryModel(),
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content: `You are an assistant for a creator managing brand partnerships. Extract action items directed at the creator from the email message. Only include concrete asks — things the creator needs to do, respond to, send, confirm, sign, or review.

Return JSON: { "items": [{ "action": "...", "dueDate": "YYYY-MM-DD" or null, "urgency": "low"|"medium"|"high", "sourceText": "..." }] }

Rules:
- "action": brief imperative sentence (e.g., "Send revised draft to brand team")
- "dueDate": ISO date if explicitly mentioned, null otherwise
- "urgency": "high" if deadline is within 3 days or marked urgent, "medium" for clear asks, "low" for soft requests
- "sourceText": the exact sentence or phrase from the email that contains the ask
- Maximum 5 items
- Skip pleasantries, greetings, and generic sign-offs
- Only extract asks directed AT the creator, not commitments made BY the brand`
        },
        {
          role: "user",
          content: `${dealContext}\n\nFrom: ${message.from?.email ?? "unknown"}\nSubject: ${message.subject}\n\n${text.slice(0, 3000)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as {
      items?: Array<{
        action?: string;
        dueDate?: string | null;
        urgency?: string;
        sourceText?: string;
      }>;
    };

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return regexFallbackExtraction(message);
    }

    return parsed.items
      .filter((item) => item.action?.trim())
      .map((item) => ({
        action: item.action!.trim(),
        dueDate: item.dueDate?.match(/^\d{4}-\d{2}-\d{2}$/) ? item.dueDate : null,
        urgency: (["low", "medium", "high"].includes(item.urgency ?? "")
          ? item.urgency
          : "medium") as ActionItemDraft["urgency"],
        sourceText: item.sourceText?.slice(0, 200) ?? null
      }))
      .slice(0, 5);
  } catch {
    return regexFallbackExtraction(message);
  }
}
