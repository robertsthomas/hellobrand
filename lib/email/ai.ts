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
          "Summarize the email thread for a creator managing brand partnerships. Keep it concise, factual, and useful. Call out asks, commitments, payment/timeline/usage-rights signals, and next steps."
      },
      {
        role: "user",
        content: plainTextThread(thread)
      }
    ]
  });

  return response.choices[0]?.message?.content?.trim() || fallbackSummary(thread);
}

function fallbackDraft(thread: EmailThreadDetail, partnership: DealAggregate | null, profile: ProfileRecord) {
  const signoff = profile.preferredSignature?.trim() || profile.displayName?.trim() || "Creator";
  const intro = partnership
    ? `Thanks for the note on ${partnership.deal.campaignName}.`
    : "Thanks for the note.";

  return {
    subject: thread.thread.subject.startsWith("Re:")
      ? thread.thread.subject
      : `Re: ${thread.thread.subject}`,
    body: `${intro}\n\nI reviewed the thread and I’m aligned on the next steps. If there are any updates on timing, deliverables, or contract details, send them over and I’ll keep things moving.\n\nBest,\n${signoff}`
  };
}

export async function generateEmailReplyDraft(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null,
  profile: ProfileRecord,
  stance?: NegotiationStance | null
) {
  const api = client();
  if (!api) {
    return fallbackDraft(thread, partnership, profile);
  }

  const partnershipContext = partnership
    ? [
        `Brand: ${partnership.deal.brandName}`,
        `Campaign: ${partnership.deal.campaignName}`,
        `Status: ${partnership.deal.status}`,
        `Payment: ${partnership.terms?.paymentAmount ? `$${partnership.terms.paymentAmount}` : "Unknown"}, terms: ${partnership.terms?.paymentTerms ?? "Unknown"}`,
        `Usage rights: ${partnership.terms?.usageRights ?? "Unknown"}, duration: ${partnership.terms?.usageDuration ?? "Unknown"}`,
        `Exclusivity: ${partnership.terms?.exclusivity ?? partnership.terms?.exclusivityApplies ? "Yes" : "No/Unknown"}${partnership.terms?.exclusivityCategory ? ` (${partnership.terms.exclusivityCategory})` : ""}`,
        `Deliverables: ${(partnership.terms?.deliverables ?? []).map((item) => `${item.quantity ?? "TBD"} ${item.title}`).join(", ") || "Unknown"}`,
        `Partnership summary: ${partnership.currentSummary?.body ?? partnership.deal.summary ?? "None"}`
      ].join("\n")
    : "No linked partnership context.";

  const riskContext = partnership && partnership.riskFlags.length > 0
    ? `\nRisk flags:\n${partnership.riskFlags.map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`).join("\n")}`
    : "";

  const discrepancyContext = thread.promiseDiscrepancies.length > 0
    ? `\nEmail vs contract discrepancies:\n${thread.promiseDiscrepancies.map((d) => `- ${d.field}: email says "${d.emailClaim}", contract says "${d.contractValue}"`).join("\n")}`
    : "";

  const actionContext = thread.actionItems.length > 0
    ? `\nPending action items from this thread:\n${thread.actionItems.map((a) => `- ${a.action}${a.dueDate ? ` (due: ${a.dueDate})` : ""}`).join("\n")}`
    : "";

  const stanceInstruction = stance === "firm"
    ? "\nStance: FIRM — Reference specific contract clauses, politely decline scope creep, hold boundaries on agreed terms. Be professional but clear about what was agreed."
    : stance === "collaborative"
    ? "\nStance: COLLABORATIVE — Acknowledge the request, express willingness to discuss, suggest compromises while protecting key terms. Warm but aware."
    : stance === "exploratory"
    ? "\nStance: EXPLORATORY — Ask clarifying questions, express interest without commitment, gather more information before responding substantively."
    : "";

  const response = await api.chat.completions.create({
    model: getEmailDraftModel(),
    temperature: stance === "firm" ? 0.25 : stance === "exploratory" ? 0.45 : 0.35,
    messages: [
      {
        role: "system",
        content: `Write a concise creator-professional email reply. Use the thread and partnership context including deal terms, risk flags, and any discrepancies between email claims and contract. Do not invent commitments. Keep the tone practical and clear.${stanceInstruction}\n\nReturn JSON with subject and body.`
      },
      {
        role: "user",
        content: `Partnership context:\n${partnershipContext}${riskContext}${discrepancyContext}${actionContext}\n\nProfile signature:\n${profile.preferredSignature ?? profile.displayName ?? "Creator"}\n\nThread:\n${plainTextThread(thread)}`
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
        subject: parsed.subject.trim(),
        body: parsed.body.trim()
      };
    }
  } catch {
    // fall through to fallback
  }

  return fallbackDraft(thread, partnership, profile);
}
