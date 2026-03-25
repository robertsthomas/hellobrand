import OpenAI from "openai";

import { getEmailDraftModel, getEmailSummaryModel } from "@/lib/email/config";
import type { DealAggregate, EmailThreadDetail, NegotiationStance, ProfileRecord } from "@/lib/types";

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

function plainTextThread(thread: EmailThreadDetail) {
  return thread.messages
    .map((message) => {
      const from = message.from?.email ?? "unknown";
      const receivedAt = message.receivedAt ?? message.sentAt ?? "unknown time";
      return `From: ${from}\nAt: ${receivedAt}\nSubject: ${message.subject}\n\n${message.textBody ?? ""}`;
    })
    .join("\n\n---\n\n");
}

function fallbackSummary(thread: EmailThreadDetail) {
  const participants = thread.thread.participants.map((participant) => participant.email).join(", ");
  const latest = thread.messages[thread.messages.length - 1];
  const latestBody = latest?.textBody?.trim() || latest?.htmlBody?.replace(/<[^>]+>/g, " ").trim() || "";

  return [
    `Subject: ${thread.thread.subject}`,
    `Participants: ${participants || "Unknown"}`,
    `Last activity: ${thread.thread.lastMessageAt}`,
    latestBody ? `Latest message: ${latestBody.slice(0, 500)}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function workspaceContext(partnership: DealAggregate | null) {
  if (!partnership) {
    return "No linked workspace context.";
  }

  const terms = partnership.terms;
  const summaries = partnership.summaries
    .slice(0, 3)
    .map((summary) => `- ${summary.body}`)
    .join("\n");
  const risks = partnership.riskFlags
    .slice(0, 6)
    .map((flag) => `- [${flag.severity}] ${flag.title}: ${flag.detail}`)
    .join("\n");
  const documents = partnership.documents
    .slice(0, 8)
    .map((document) => `- ${document.fileName} (${document.documentKind})`)
    .join("\n");
  const extractionEvidence = partnership.extractionResults
    .slice(0, 6)
    .map((result) => {
      const fields = Object.keys(result.data ?? {}).slice(0, 6).join(", ");
      return `- ${result.documentId}: ${fields || "structured extraction available"}`;
    })
    .join("\n");

  return [
    `Workspace campaign: ${partnership.deal.campaignName}`,
    `Workspace brand: ${partnership.deal.brandName}`,
    `Workspace status: ${partnership.deal.status}`,
    `Workspace payment status: ${partnership.deal.paymentStatus}`,
    "",
    "Key terms:",
    `- Payment amount: ${terms?.paymentAmount ? `$${terms.paymentAmount}` : "Unknown"}`,
    `- Currency: ${terms?.currency ?? "Unknown"}`,
    `- Payment terms: ${terms?.paymentTerms ?? "Unknown"}`,
    `- Payment trigger: ${terms?.paymentTrigger ?? "Unknown"}`,
    `- Deliverables: ${(terms?.deliverables ?? []).map((item) => `${item.quantity ?? "TBD"} ${item.title}`).join(", ") || "Unknown"}`,
    `- Usage rights: ${terms?.usageRights ?? "Unknown"}`,
    `- Usage duration: ${terms?.usageDuration ?? "Unknown"}`,
    `- Usage territory: ${terms?.usageTerritory ?? "Unknown"}`,
    `- Usage channels: ${(terms?.usageChannels ?? []).join(", ") || "Unknown"}`,
    `- Exclusivity applies: ${terms?.exclusivityApplies === null ? "Unknown" : terms?.exclusivityApplies ? "Yes" : "No"}`,
    `- Exclusivity category: ${terms?.exclusivityCategory ?? "Unknown"}`,
    `- Exclusivity duration: ${terms?.exclusivityDuration ?? "Unknown"}`,
    `- Revisions: ${terms?.revisions ?? "Unknown"}`,
    `- Termination: ${terms?.termination ?? "Unknown"}`,
    `- Notes: ${terms?.notes ?? "None"}`,
    "",
    "Workspace summaries:",
    summaries || "- None",
    "",
    "Workspace risk flags:",
    risks || "- None",
    "",
    "Workspace documents:",
    documents || "- None",
    "",
    "Workspace extracted structure:",
    extractionEvidence || "- None",
  ].join("\n");
}

export async function generateEmailThreadSummary(thread: EmailThreadDetail) {
  const api = client();
  if (!api) {
    return fallbackSummary(thread);
  }

  const response = await api.chat.completions.create({
    model: getEmailSummaryModel(),
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Summarize the email thread for a creator managing brand partnerships. Keep it concise, factual, and useful. Call out asks, commitments, payment/timeline/usage-rights signals, and next steps. Never use em dashes (—) or en dashes (–); use commas, periods, or semicolons instead."
      },
      {
        role: "user",
        content: plainTextThread(thread)
      }
    ]
  });

  return response.choices[0]?.message?.content?.trim() || fallbackSummary(thread);
}

function fallbackDraft(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null,
  profile: ProfileRecord,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null
) {
  const signoff = profile.preferredSignature?.trim() || profile.displayName?.trim() || "Creator";
  const baseSubject = currentDraft?.subject?.trim();
  const baseBody = currentDraft?.body?.trim();
  const intro = partnership
    ? `Thanks for the note on ${partnership.deal.campaignName}.`
    : "Thanks for the note.";
  const extraGuidance = instructions?.trim()
    ? `\n\nI kept your note in mind: ${instructions.trim()}`
    : "";

  return {
    subject: baseSubject || (thread.thread.subject.startsWith("Re:")
      ? thread.thread.subject
      : `Re: ${thread.thread.subject}`),
    body: baseBody
      ? `${baseBody}${extraGuidance}`
      : `${intro}\n\nI reviewed the thread and I’m aligned on the next steps. If there are any updates on timing, deliverables, or contract details, send them over and I’ll keep things moving.${extraGuidance}\n\nBest,\n${signoff}`
  };
}

function normalizeEmailDraftText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "")
    .replace(/\[Brand\/Agency Name\]/gi, "there")
    .replace(/\[Brand Name\]/gi, "there")
    .replace(/\[Agency Name\]/gi, "there")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateEmailReplyDraft(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null,
  profile: ProfileRecord,
  stance?: NegotiationStance | null,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null
) {
  const api = client();
  if (!api) {
    return fallbackDraft(thread, partnership, profile, instructions, currentDraft);
  }

  const discrepancyContext = thread.promiseDiscrepancies.length > 0
    ? thread.promiseDiscrepancies.map((d) => `- ${d.field}: email says "${d.emailClaim}", contract says "${d.contractValue}"`).join("\n")
    : "- None";

  const actionContext = thread.actionItems.length > 0
    ? thread.actionItems.map((a) => `- ${a.action}${a.dueDate ? ` (due: ${a.dueDate})` : ""}`).join("\n")
    : "- None";

  const stanceInstruction = stance === "firm"
    ? "\nStance: FIRM — Reference specific contract clauses, politely decline scope creep, hold boundaries on agreed terms. Be professional but clear about what was agreed."
    : stance === "collaborative"
    ? "\nStance: COLLABORATIVE — Acknowledge the request, express willingness to discuss, suggest compromises while protecting key terms. Warm but aware."
    : stance === "exploratory"
    ? "\nStance: EXPLORATORY — Ask clarifying questions, express interest without commitment, gather more information before responding substantively."
    : "";
  const instructionContext = instructions?.trim() || "None";
  const currentDraftContext = currentDraft?.body?.trim()
    ? `Current draft subject: ${currentDraft.subject.trim()}\nCurrent draft body:\n${currentDraft.body.trim()}`
    : "None";

  const response = await api.chat.completions.create({
    model: getEmailDraftModel(),
    temperature: stance === "firm" ? 0.25 : stance === "exploratory" ? 0.45 : 0.35,
    messages: [
      {
        role: "system",
        content: `Write a concise creator-professional email reply. Use the linked workspace context as the primary business context for the email, not only the inbox thread history. The custom user prompt is optional and applies only to this next draft. If a custom user prompt is present, follow it when it does not conflict with the linked workspace facts. If it conflicts with workspace facts, preserve the workspace facts and incorporate the custom prompt as far as safely possible. Never invent commitments, approvals, dates, deliverables, usage rights, payment terms, or legal positions. Keep the tone practical and clear. Write plain email prose only, not markdown. Do not use bold, bullets, numbered lists, headings, or placeholder names like [Brand Name] or [Agency Name]. If you do not know the recipient name, use a normal generic greeting like "Hi there,". If a current draft is provided, revise that draft instead of starting from scratch unless the context requires a substantial rewrite.${stanceInstruction}\n\nReturn JSON with subject and body.`
      },
      {
        role: "user",
        content: [
          "Linked workspace context:",
          workspaceContext(partnership),
          "",
          "Email vs contract discrepancies from this thread:",
          discrepancyContext,
          "",
          "Pending action items from this thread:",
          actionContext,
          "",
          "Current draft to revise:",
          currentDraftContext,
          "",
          "Custom user prompt for this next draft only:",
          instructionContext,
          "",
          `Profile signature:\n${profile.preferredSignature ?? profile.displayName ?? "Creator"}`,
          "",
          `Current thread:\n${plainTextThread(thread)}`,
        ].join("\n")
      }
    ],
    response_format: { type: "json_object" }
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as {
      subject?: string;
      body?: string;
    };

    if (parsed.subject?.trim() && parsed.body?.trim()) {
      return {
        subject: normalizeEmailDraftText(parsed.subject),
        body: normalizeEmailDraftText(parsed.body)
      };
    }
  } catch {
    // fall through to fallback
  }

  return fallbackDraft(thread, partnership, profile, instructions, currentDraft);
}

const SUGGESTIONS_MODEL = "google/gemini-2.0-flash-001";

export async function generateReplySuggestions(
  thread: EmailThreadDetail
): Promise<{ id: string; label: string; prompt: string }[]> {
  const api = client();
  if (!api) {
    return fallbackSuggestions(thread);
  }

  try {
    const response = await api.chat.completions.create({
      model: SUGGESTIONS_MODEL,
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You generate 3 short reply prompt suggestions for a creator responding to a brand email. Each suggestion is a brief action the creator might want to take. Return a JSON array of objects with \"label\" (short, 6-10 words, action-oriented) and \"prompt\" (1 sentence instruction for an AI reply generator). Never use em dashes or en dashes. Be specific to the email content."
        },
        {
          role: "user",
          content: `Thread:\n${plainTextThread(thread)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      suggestions?: { label?: string; prompt?: string }[];
    };
    const items = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    return items
      .filter((s) => s.label?.trim() && s.prompt?.trim())
      .slice(0, 3)
      .map((s, i) => ({
        id: `ai-${i}`,
        label: s.label!.trim(),
        prompt: s.prompt!.trim()
      }));
  } catch {
    return fallbackSuggestions(thread);
  }
}

function fallbackSuggestions(thread: EmailThreadDetail) {
  const hasActionItems = thread.actionItems.length > 0;
  const suggestions = [
    {
      id: "fallback-0",
      label: hasActionItems
        ? "Confirm the next steps they asked about"
        : "Ask for more details on the deliverables",
      prompt: hasActionItems
        ? "Address the pending action items and confirm next steps."
        : "Ask the brand to clarify the deliverables, timeline, or creative direction."
    },
    {
      id: "fallback-1",
      label: "Push back on the terms politely",
      prompt: "Politely push back on terms that feel unfavorable. Suggest alternatives."
    },
    {
      id: "fallback-2",
      label: "Keep it short and confirm availability",
      prompt: "Write a brief reply confirming availability and interest without overcommitting."
    }
  ];
  return suggestions;
}
