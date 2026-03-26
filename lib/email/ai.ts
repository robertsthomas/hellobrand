import { streamText } from "ai";

import {
  aiCachePolicy,
  buildAiInputHash,
  finalizeAiStreamExecution,
  prepareAiStreamExecution,
  runOpenRouterTask
} from "@/lib/ai/gateway";
import { assistantProvider } from "@/lib/assistant/provider";
import { buildEmailThreadVersion } from "@/lib/email/reply-suggestion-version";
import type { DealAggregate, EmailThreadDetail, NegotiationStance, ProfileRecord, Viewer } from "@/lib/types";

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
    extractionEvidence || "- None"
  ].join("\n");
}

export async function generateEmailThreadSummary(thread: EmailThreadDetail) {
  const fallback = fallbackSummary(thread);
  const threadText = plainTextThread(thread);
  const cache = aiCachePolicy({
    taskKey: "email_summary",
    scopeKey: `email-thread:${thread.thread.id}:${buildEmailThreadVersion(thread.thread)}`,
    input: {
      threadId: thread.thread.id,
      threadText
    }
  });

  const result = await runOpenRouterTask<string>({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_summary"
    },
    systemPrompt:
      "Summarize the email thread for a creator managing brand partnerships. Keep it concise, factual, and useful. Call out asks, commitments, payment or timeline signals, usage-rights signals, and next steps. Never use em dashes or en dashes; use commas, periods, or semicolons instead.",
    userPrompt: threadText,
    temperature: 0.2,
    cache,
    parse: (content) => content.trim() || fallback,
    serialize: (value) => value
  });

  return result?.data ?? fallback;
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

function buildEmailReplyDraftRequest(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null,
  profile: ProfileRecord,
  stance?: NegotiationStance | null,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null
) {
  const fallback = fallbackDraft(thread, partnership, profile, instructions, currentDraft);
  const discrepancyContext = thread.promiseDiscrepancies.length > 0
    ? thread.promiseDiscrepancies.map((d) => `- ${d.field}: email says "${d.emailClaim}", contract says "${d.contractValue}"`).join("\n")
    : "- None";

  const actionContext = thread.actionItems.length > 0
    ? thread.actionItems.map((a) => `- ${a.action}${a.dueDate ? ` (due: ${a.dueDate})` : ""}`).join("\n")
    : "- None";

  const stanceInstruction = stance === "firm"
    ? "\nStance: FIRM. Reference specific contract clauses, politely decline scope creep, and hold boundaries on agreed terms. Be professional but clear about what was agreed."
    : stance === "collaborative"
      ? "\nStance: COLLABORATIVE. Acknowledge the request, express willingness to discuss, and suggest compromises while protecting key terms."
      : stance === "exploratory"
        ? "\nStance: EXPLORATORY. Ask clarifying questions, express interest without commitment, and gather more information before responding substantively."
        : "";
  const instructionContext = instructions?.trim() || "None";
  const currentDraftContext = currentDraft?.body?.trim()
    ? `Current draft subject: ${currentDraft.subject.trim()}\nCurrent draft body:\n${currentDraft.body.trim()}`
    : "None";
  const workspaceSummary = workspaceContext(partnership);
  const threadText = plainTextThread(thread);

  return {
    fallback,
    cache: aiCachePolicy({
      taskKey: "email_draft",
      scopeKey: [
        "email-draft",
        thread.thread.id,
        buildEmailThreadVersion(thread.thread),
        partnership?.deal.id ?? "no-deal",
        partnership?.deal.updatedAt ?? "no-deal-version"
      ].join(":"),
      input: {
        discrepancyContext,
        actionContext,
        currentDraftContext,
        instructionContext,
        stance: stance ?? null,
        workspaceContext: workspaceSummary,
        signature: profile.preferredSignature ?? profile.displayName ?? "Creator",
        threadText
      }
    }),
    systemPrompt: `Write a concise creator-professional email reply. Use the linked workspace context as the primary business context for the email, not only the inbox thread history. The custom user prompt is optional and applies only to this next draft. If a custom user prompt is present, follow it when it does not conflict with the linked workspace facts. If it conflicts with workspace facts, preserve the workspace facts and incorporate the custom prompt as far as safely possible. Never invent commitments, approvals, dates, deliverables, usage rights, payment terms, or legal positions. Keep the tone practical and clear. Write plain email prose only, not markdown. Do not use bold, bullets, numbered lists, headings, or placeholder names like [Brand Name] or [Agency Name]. If you do not know the recipient name, use a normal generic greeting like "Hi there,". If a current draft is provided, revise that draft instead of starting from scratch unless the context requires a substantial rewrite.${stanceInstruction}\n\nReturn JSON with subject and body.`,
    userPrompt: [
      "Linked workspace context:",
      workspaceSummary,
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
      `Current thread:\n${threadText}`
    ].join("\n"),
    temperature: stance === "firm" ? 0.25 : stance === "exploratory" ? 0.45 : 0.35
  };
}

function draftTextResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
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
  const request = buildEmailReplyDraftRequest(
    thread,
    partnership,
    profile,
    stance,
    instructions,
    currentDraft
  );

  const result = await runOpenRouterTask<{ subject: string; body: string }>({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_draft"
    },
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    temperature: request.temperature,
    responseFormat: { type: "json_object" },
    cache: request.cache,
    parse: (content) => {
      try {
        const parsed = JSON.parse(content) as {
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
        return request.fallback;
      }

      return request.fallback;
    },
    serialize: (value) => value
  });

  return result?.data ?? request.fallback;
}

export async function streamEmailReplyDraft(input: {
  viewer: Viewer;
  thread: EmailThreadDetail;
  partnership: DealAggregate | null;
  profile: ProfileRecord;
  stance?: NegotiationStance | null;
  instructions?: string | null;
  currentDraft?: { subject: string; body: string } | null;
}) {
  const request = buildEmailReplyDraftRequest(
    input.thread,
    input.partnership,
    input.profile,
    input.stance ?? null,
    input.instructions ?? null,
    input.currentDraft ?? null
  );
  const prepared = await prepareAiStreamExecution({
    userId: input.viewer.id,
    taskKey: "email_draft",
    featureKey: "premium_inbox",
    metadata: {
      threadId: input.thread.thread.id,
      stance: input.stance ?? null
    }
  });

  if (prepared.budgetDecision === "blocked") {
    return draftTextResponse(request.fallback.body);
  }

  const provider = assistantProvider(prepared.fallbacks);
  if (!provider) {
    return draftTextResponse(request.fallback.body);
  }

  const inputHash = buildAiInputHash({
    viewerId: input.viewer.id,
    threadId: input.thread.thread.id,
    stance: input.stance ?? null,
    instructions: input.instructions ?? null,
    currentDraft: input.currentDraft ?? null,
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt
  });

  const result = streamText({
    model: provider.chat(prepared.requestedModel, {
      user: input.viewer.id,
      provider: {
        allow_fallbacks: prepared.fallbacks.length > 0,
        data_collection: "deny",
        zdr: true
      },
      cache_control: {
        type: "ephemeral",
        ttl: "5m"
      }
    }),
    system: `${request.systemPrompt}\n\nReturn only the email body text. Do not include a subject line, JSON, markdown, bullets, or headings.`,
    prompt: request.userPrompt,
    maxOutputTokens: prepared.maxTokens,
    temperature: request.temperature,
    onFinish: async ({ totalUsage, model }) => {
      await finalizeAiStreamExecution({
        context: {
          userId: input.viewer.id,
          taskKey: "email_draft",
          featureKey: "premium_inbox",
          metadata: {
            threadId: input.thread.thread.id,
            stance: input.stance ?? null
          }
        },
        prepared,
        usage: {
          promptTokens: totalUsage.inputTokens ?? 0,
          completionTokens: totalUsage.outputTokens ?? 0,
          totalTokens: totalUsage.totalTokens ?? 0
        },
        resolvedModel: model.modelId ?? prepared.requestedModel,
        inputHash
      });
    }
  });

  return result.toTextStreamResponse();
}

export async function generateReplySuggestions(
  thread: EmailThreadDetail
): Promise<{ id: string; label: string; prompt: string }[]> {
  const fallback = fallbackSuggestions(thread);
  const threadText = plainTextThread(thread);
  const cache = aiCachePolicy({
    taskKey: "email_suggestions",
    scopeKey: `email-suggestions:${thread.thread.id}:${buildEmailThreadVersion(thread.thread)}`,
    input: {
      threadId: thread.thread.id,
      threadText
    }
  });

  const result = await runOpenRouterTask<{ id: string; label: string; prompt: string }[]>({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_suggestions"
    },
    systemPrompt:
      'You generate 3 short reply prompt suggestions for a creator responding to a brand email. Each suggestion is a brief action the creator might want to take. Return JSON with shape { "suggestions": [{ "label": "short action label", "prompt": "one-sentence instruction" }] }. Never use em dashes or en dashes. Be specific to the email content.',
    userPrompt: `Thread:\n${threadText}`,
    temperature: 0.4,
    responseFormat: { type: "json_object" },
    cache,
    parse: (content) => {
      try {
        const parsed = JSON.parse(content) as {
          suggestions?: { label?: string; prompt?: string }[];
        };
        const items = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

        return items
          .filter((entry) => entry.label?.trim() && entry.prompt?.trim())
          .slice(0, 3)
          .map((entry, index) => ({
            id: `ai-${index}`,
            label: entry.label!.trim(),
            prompt: entry.prompt!.trim()
          }));
      } catch {
        return fallback;
      }
    },
    serialize: (value) => value
  });

  return result?.data?.length ? result.data : fallback;
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
