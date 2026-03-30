import { z } from "zod";
import { streamText } from "ai";

import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptNumbered,
  promptQuotedText
} from "@/lib/ai/prompting";
import { runStructuredOpenRouterTask } from "@/lib/ai/structured";
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

const emailDraftSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1)
});

const replySuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      label: z.string().trim().min(1),
      prompt: z.string().trim().min(1)
    })
  ).max(3)
});

function emailThreadSummarySystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You summarize creator inbox threads for brand partnership workflows. You are factual, concise, and grounded."
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Summarize only facts that appear in the thread.",
        "Call out asks, commitments, approvals, payment timing, usage rights, deadlines, and next steps when present.",
        "If an item is not explicit in the thread, omit it.",
        "Write plain text only.",
        "Never use em dashes or en dashes. Replace them with commas."
      ])
    }
  ]);
}

function emailThreadSummaryUserPrompt(threadText: string) {
  return joinPromptSections([
    {
      tag: "thread",
      content: promptQuotedText(threadText)
    },
    {
      tag: "task",
      content:
        "Based on the thread above, write a concise creator-facing summary that helps the creator understand what happened, what is being asked, and what to do next."
    }
  ]);
}

function emailDraftSystemPrompt(stance?: NegotiationStance | null) {
  const stanceInstruction = stance === "firm"
    ? "Stance: firm. Hold boundaries on agreed terms, reference specifics, and avoid unnecessary softness."
    : stance === "collaborative"
      ? "Stance: collaborative. Protect the creator while sounding constructive and solution-oriented."
      : stance === "exploratory"
        ? "Stance: exploratory. Ask clarifying questions and avoid committing before the facts are clear."
        : "Stance: balanced. Be practical, clear, and creator-professional.";

  return joinPromptSections([
    {
      tag: "role",
      content:
        "You draft creator-professional brand partnership emails. Your job is to produce safe, useful replies that preserve the creator's leverage and avoid inventing business facts."
    },
    {
      tag: "instruction_hierarchy",
      content: promptNumbered([
        "Linked workspace facts are highest priority.",
        "Then use the current thread facts.",
        "Then use the current draft, if one exists, as material to revise.",
        "Treat the custom user prompt as optional guidance for this one draft only. Follow it only when it does not conflict with workspace facts or thread facts."
      ])
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Never invent commitments, approvals, dates, deliverables, usage rights, payment terms, legal positions, or who agreed to what.",
        "If workspace facts and the custom prompt conflict, preserve the workspace facts and adapt the language rather than fabricating alignment.",
        "Revise the current draft when one is provided, unless the draft is so off-base that a rewrite is clearly safer.",
        "Write plain email prose only, not markdown.",
        "Do not use bold, bullets, numbered lists, headings, or placeholder names like [Brand Name] or [Agency Name].",
        "If the recipient name is unknown, use a normal greeting like Hi there,.",
        "Keep the draft concise, specific, and creator-professional."
      ])
    },
    {
      tag: "few_shot_examples",
      content: [
        "<example name=\"respect_workspace_facts\">",
        "Workspace fact: Payment terms are Net 45.",
        "Custom prompt: Tell them we already agreed to Net 15.",
        "Correct behavior: Do not claim Net 15 was already agreed. Ask for a revision to Net 15 or restate that the current draft shows Net 45.",
        "</example>",
        "",
        "<example name=\"avoid_overcommitment\">",
        "Thread: The brand asks whether the creator can add two extra deliverables.",
        "Correct behavior: Acknowledge the request and discuss scope or revised terms. Do not promise the extra deliverables as already approved.",
        "</example>"
      ].join("\n")
    },
    {
      tag: "style",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        stanceInstruction,
        "Never use em dashes or en dashes. Replace them with commas."
      ])
    },
    {
      tag: "output_contract",
      content: 'Return JSON with exactly this shape: { "subject": "string", "body": "string" }.'
    }
  ]);
}

function emailDraftUserPrompt(input: {
  workspaceSummary: string;
  discrepancyContext: string;
  actionContext: string;
  currentDraftContext: string;
  instructionContext: string;
  signature: string;
  threadText: string;
}) {
  return joinPromptSections([
    {
      tag: "workspace_context",
      content: promptQuotedText(input.workspaceSummary)
    },
    {
      tag: "thread_discrepancies",
      content: input.discrepancyContext
    },
    {
      tag: "thread_action_items",
      content: input.actionContext
    },
    {
      tag: "current_draft",
      content: input.currentDraftContext
    },
    {
      tag: "custom_user_prompt",
      content: input.instructionContext
    },
    {
      tag: "signature",
      content: input.signature
    },
    {
      tag: "thread",
      content: promptQuotedText(input.threadText)
    },
    {
      tag: "task",
      content:
        "Draft the next email reply for the creator using the hierarchy and rules above. Keep the output grounded in the workspace and thread."
    }
  ]);
}

function replySuggestionsSystemPrompt() {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You generate short, high-signal reply prompt suggestions for creators responding to brand partnership emails."
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Suggestions must be specific to the thread, not generic filler.",
        "Each suggestion should represent a realistic creator move such as clarify scope, push back on terms, confirm timing, or ask a follow-up question.",
        "Keep labels short and scannable.",
        "Keep prompts to one sentence each.",
        'Return JSON with this shape: { "suggestions": [{ "label": "...", "prompt": "..." }] }.',
        "Never use em dashes or en dashes."
      ])
    },
    {
      tag: "few_shot_examples",
      content: [
        "<example>",
        "Thread theme: The brand asks for a rushed posting timeline with unclear revisions.",
        'Good suggestion: { "label": "Clarify the turnaround and approval flow", "prompt": "Ask the brand to confirm the posting deadline, review window, and how many revision rounds are expected." }',
        "</example>",
        "",
        "<example>",
        "Bad suggestion: { \"label\": \"Respond politely\", \"prompt\": \"Write a nice reply.\" }",
        "Reason: Too generic and not useful.",
        "</example>"
      ].join("\n")
    }
  ]);
}

function replySuggestionsUserPrompt(threadText: string) {
  return joinPromptSections([
    {
      tag: "thread",
      content: promptQuotedText(threadText)
    },
    {
      tag: "task",
      content:
        "Based on the thread above, return 3 distinct prompt suggestions for the creator's next reply."
    }
  ]);
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
    systemPrompt: emailThreadSummarySystemPrompt(),
    userPrompt: emailThreadSummaryUserPrompt(threadText),
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
    ? "firm"
    : stance === "collaborative"
      ? "collaborative"
      : stance === "exploratory"
        ? "exploratory"
        : null;
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
        stance: stanceInstruction,
        workspaceContext: workspaceSummary,
        signature: profile.preferredSignature ?? profile.displayName ?? "Creator",
        threadText
      }
    }),
    systemPrompt: emailDraftSystemPrompt(stance),
    userPrompt: emailDraftUserPrompt({
      workspaceSummary,
      discrepancyContext,
      actionContext,
      currentDraftContext,
      instructionContext,
      signature: profile.preferredSignature ?? profile.displayName ?? "Creator",
      threadText
    }),
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

  const result = await runStructuredOpenRouterTask({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_draft"
    },
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    temperature: request.temperature,
    schema: emailDraftSchema,
    fallback: request.fallback,
    cache: request.cache,
  });

  const draft = result?.data ?? request.fallback;
  return {
    subject: normalizeEmailDraftText(draft.subject),
    body: normalizeEmailDraftText(draft.body)
  };
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

  const structuredFallback = {
    suggestions: fallback.map(({ label, prompt }) => ({ label, prompt }))
  };

  const result = await runStructuredOpenRouterTask({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_suggestions"
    },
    systemPrompt: replySuggestionsSystemPrompt(),
    userPrompt: replySuggestionsUserPrompt(threadText),
    temperature: 0.4,
    schema: replySuggestionsSchema,
    fallback: structuredFallback,
    cache,
  });

  const items = result?.data?.suggestions ?? structuredFallback.suggestions;
  return items.slice(0, 3).map((entry, index) => ({
    id: `ai-${index}`,
    label: entry.label.trim(),
    prompt: entry.prompt.trim()
  }));
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
