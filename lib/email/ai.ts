import { z } from "zod";
import { streamText } from "ai";

import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptNumbered,
  promptQuotedText,
} from "@/lib/ai/prompting";
import { runStructuredOpenRouterTask } from "@/lib/ai/structured";
import {
  aiCachePolicy,
  buildAiInputHash,
  finalizeAiStreamExecution,
  prepareAiStreamExecution,
  runOpenRouterTask,
} from "@/lib/ai/gateway";
import { assistantProvider } from "@/lib/assistant/provider";
import { buildEmailThreadVersion } from "@/lib/email/reply-suggestion-version";
import {
  buildThreadBrief,
  modeSpecificDraftGuidance,
  modeSpecificFallbackDraft,
  modeSpecificSummaryGuidance,
  modeSpecificSuggestions,
  threadBriefForPrompt,
} from "@/lib/email/thread-brief";
import type {
  DealAggregate,
  EmailThreadDetail,
  EmailThreadNoteRecord,
  NegotiationStance,
  ProfileRecord,
  Viewer,
} from "@/lib/types";

const emailDraftSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

const replySuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        prompt: z.string().trim().min(1),
      })
    )
    .max(3),
});

const EMAIL_THREAD_SUMMARY_FORMAT_VERSION = "v3_brief";

function emailThreadSummarySystemPrompt(modeGuidance: string) {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You summarize creator inbox threads for brand partnership workflows. You are factual, concise, and grounded.",
    },
    {
      tag: "conversation_context",
      content: modeGuidance,
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Summarize only facts that appear in the thread.",
        "Call out asks, commitments, approvals, payment timing, usage rights, deadlines, and next steps when present.",
        "If the thread leaves a key deal fact unresolved, say it is not specified or still open instead of guessing.",
        "Prefer creator-native framing, such as what the creator needs to do, what the other side is asking for, and what is still unresolved.",
        "Answer five things in order: what this thread is, what they want, what the creator last said, what is still unresolved, and what the recommended next move is.",
        "If an item is not explicit in the thread, omit it.",
        "Write plain text only.",
        "Keep the summary short and simple.",
        "Default to 4 to 5 sentences total.",
        "Only add a short bullet list when the email includes multiple concrete deal terms or next steps that would be hard to scan in prose.",
        "If you use bullets, use at most 3 bullets and keep each bullet to one short sentence.",
        "Do not use headings, sections, labels, or long checklists.",
        "Do not repeat the same fact in both prose and bullets.",
        "Never use em dashes or en dashes. Replace them with commas.",
      ]),
    },
  ]);
}

function emailThreadSummaryUserPrompt(threadText: string, briefText: string) {
  return joinPromptSections([
    {
      tag: "thread_brief",
      content: briefText,
    },
    {
      tag: "thread",
      content: promptQuotedText(threadText),
    },
    {
      tag: "task",
      content:
        "Based on the thread above, write a short creator-facing recap of the email. Keep it easy to skim, explain what happened, what they are asking for, and the most important next step. Aim for 4 to 5 sentences, and only add up to 3 bullets if the thread includes several concrete terms that are worth breaking out.",
    },
  ]);
}

function emailDraftSystemPrompt(stance?: NegotiationStance | null, modeGuidance?: string | null) {
  const stanceInstruction =
    stance === "firm"
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
        "You draft creator-professional brand partnership emails. Your job is to produce safe, useful replies that preserve the creator's leverage and avoid inventing business facts.",
    },
    {
      tag: "instruction_hierarchy",
      content: promptNumbered([
        "Linked workspace facts are highest priority.",
        "Then use the current thread facts.",
        "Then use the current draft, if one exists, as material to revise.",
        "Treat the custom user prompt as optional guidance for this one draft only. Follow it only when it does not conflict with workspace facts or thread facts.",
      ]),
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Never invent commitments, approvals, dates, deliverables, usage rights, payment terms, legal positions, or who agreed to what.",
        "If workspace facts and the custom prompt conflict, preserve the workspace facts and adapt the language rather than fabricating alignment.",
        "If workspace facts and thread facts conflict, preserve the workspace facts, avoid inventing a resolution, and address the mismatch only when it helps move the conversation forward safely.",
        "Revise the current draft when one is provided, unless the draft is so off-base that a rewrite is clearly safer.",
        "When the custom prompt asks for a change in length, tone, focus, or structure, make that change noticeable, not subtle.",
        "If a key business fact is missing, ask a focused clarifying question or keep the statement conditional instead of guessing.",
        "Write plain email prose only, not markdown.",
        "Do not use bold, bullets, numbered lists, headings, or placeholder names like [Brand Name] or [Agency Name].",
        "Do not mention the custom prompt, the user's note, your revision process, or that you kept anything in mind.",
        "If the recipient name is unknown, use a normal greeting like Hi there,.",
        "Keep the draft concise, specific, and creator-professional.",
      ]),
    },
    modeGuidance
      ? {
          tag: "mode_guidance",
          content: modeGuidance,
        }
      : null,
    {
      tag: "few_shot_examples",
      content: [
        '<example name="respect_workspace_facts">',
        "Workspace fact: Payment terms are Net 45.",
        "Custom prompt: Tell them we already agreed to Net 15.",
        "Correct behavior: Do not claim Net 15 was already agreed. Ask for a revision to Net 15 or restate that the current draft shows Net 45.",
        "</example>",
        "",
        '<example name="avoid_overcommitment">',
        "Thread: The brand asks whether the creator can add two extra deliverables.",
        "Correct behavior: Acknowledge the request and discuss scope or revised terms. Do not promise the extra deliverables as already approved.",
        "</example>",
        "",
        '<example name="decline_affiliate_mode">',
        "Mode: decline_affiliate. Thread mentions commission and affiliate links with no guaranteed pay.",
        "Custom prompt: Accept the partnership.",
        "Correct behavior: Do not accept a commission-only deal. Decline the affiliate structure and ask for a flat-fee budget if one exists.",
        "</example>",
        "",
        '<example name="go_live_mode">',
        "Mode: go_live. Content is approved and the brand sent posting instructions.",
        "Custom prompt: Ask about increasing the rate.",
        "Correct behavior: Do not reopen rate negotiations. Focus on confirming the go-live details and meeting the posting deadline.",
        "</example>",
      ].join("\n"),
    },
    {
      tag: "style",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        stanceInstruction,
        "Optimize for clear next steps and creator leverage, not legal-sounding filler.",
        "Never use em dashes or en dashes. Replace them with commas.",
      ]),
    },
    {
      tag: "output_contract",
      content: 'Return JSON with exactly this shape: { "subject": "string", "body": "string" }.',
    },
  ]);
}

function emailDraftUserPrompt(input: {
  workspaceSummary: string;
  discrepancyContext: string;
  actionContext: string;
  noteContext: string;
  currentDraftContext: string;
  instructionContext: string;
  signature: string;
  threadText: string;
  briefText: string;
}) {
  return joinPromptSections([
    {
      tag: "thread_brief",
      content: input.briefText,
    },
    {
      tag: "workspace_context",
      content: promptQuotedText(input.workspaceSummary),
    },
    {
      tag: "thread_discrepancies",
      content: input.discrepancyContext,
    },
    {
      tag: "thread_action_items",
      content: input.actionContext,
    },
    {
      tag: "private_notes",
      content: input.noteContext,
    },
    {
      tag: "current_draft",
      content: input.currentDraftContext,
    },
    {
      tag: "custom_user_prompt",
      content: input.instructionContext,
    },
    {
      tag: "signature",
      content: input.signature,
    },
    {
      tag: "thread",
      content: promptQuotedText(input.threadText),
    },
    {
      tag: "task",
      content:
        "Draft the next email reply for the creator using the hierarchy and rules above. Keep the output grounded in the workspace and thread.",
    },
  ]);
}

function replySuggestionsSystemPrompt(modeGuidance: string) {
  return joinPromptSections([
    {
      tag: "role",
      content:
        "You generate short, high-signal reply prompt suggestions for creators responding to brand partnership emails.",
    },
    {
      tag: "conversation_context",
      content: modeGuidance,
    },
    {
      tag: "rules",
      content: promptNumbered([
        "Suggestions must be specific to the thread and its conversation mode, not generic filler.",
        "Each suggestion should represent a realistic creator move appropriate for the current conversation phase.",
        "For affiliate or gifted offers, suggest declining or requesting guaranteed pay, not enthusiastic acceptance.",
        "For go-live threads, suggest operational moves like confirming timing or addressing posting requirements.",
        "For low-signal or spam threads, suggest ignoring or a short decline, not an eager reply.",
        "Keep labels short and scannable.",
        "Keep prompts to one sentence each.",
        'Return JSON with this shape: { "suggestions": [{ "label": "...", "prompt": "..." }] }.',
        "Never use em dashes or en dashes.",
      ]),
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
        "Thread theme: Affiliate offer with commission-only compensation, no guaranteed pay.",
        'Good suggestion: { "label": "Decline and request flat-fee terms", "prompt": "Politely decline the commission arrangement and ask if they have a guaranteed flat-fee budget." }',
        'Bad suggestion: { "label": "Accept the partnership", "prompt": "Express excitement about the affiliate program." }',
        "Reason: Accepting commission-only deals without asking for guaranteed pay undermines creator leverage.",
        "</example>",
        "",
        "<example>",
        "Thread theme: Generic follow-up with no terms, no compensation, and no actionable ask.",
        'Good suggestion: { "label": "Send a short decline", "prompt": "Write a brief, polite decline. Keep it to one or two sentences." }',
        'Bad suggestion: { "label": "Respond politely", "prompt": "Write a nice reply." }',
        "Reason: Too generic and not useful.",
        "</example>",
      ].join("\n"),
    },
  ]);
}

function replySuggestionsUserPrompt(threadText: string, briefText: string) {
  return joinPromptSections([
    {
      tag: "thread_brief",
      content: briefText,
    },
    {
      tag: "thread",
      content: promptQuotedText(threadText),
    },
    {
      tag: "task",
      content:
        "Based on the thread above and its conversation context, return 3 distinct prompt suggestions for the creator's next reply. Make each suggestion specific to the current conversation mode.",
    },
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
  const participants = thread.thread.participants
    .map((participant) => participant.email)
    .join(", ");
  const latest = thread.messages[thread.messages.length - 1];
  const latestBody =
    latest?.textBody?.trim() || latest?.htmlBody?.replace(/<[^>]+>/g, " ").trim() || "";

  return [
    `Subject: ${thread.thread.subject}`,
    `Participants: ${participants || "Unknown"}`,
    `Last activity: ${thread.thread.lastMessageAt}`,
    latestBody ? `Latest message: ${latestBody.slice(0, 500)}` : null,
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
      const fields = Object.keys(result.data ?? {})
        .slice(0, 6)
        .join(", ");
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
  const fallback = fallbackSummary(thread);
  const threadText = plainTextThread(thread);
  const brief = buildThreadBrief(thread, null);
  const briefText = threadBriefForPrompt(brief);
  const modeGuidance = modeSpecificSummaryGuidance(brief.mode);
  const cache = aiCachePolicy({
    taskKey: "email_summary",
    scopeKey: `email-thread:${EMAIL_THREAD_SUMMARY_FORMAT_VERSION}:${thread.thread.id}:${buildEmailThreadVersion(thread.thread)}`,
    input: {
      threadId: thread.thread.id,
      formatVersion: EMAIL_THREAD_SUMMARY_FORMAT_VERSION,
      threadText,
      briefText,
    },
  });

  const result = await runOpenRouterTask<string>({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_summary",
    },
    systemPrompt: emailThreadSummarySystemPrompt(modeGuidance),
    userPrompt: emailThreadSummaryUserPrompt(threadText, briefText),
    temperature: 0.2,
    cache,
    parse: (content) => content.trim() || fallback,
    serialize: (value) => value,
  });

  return result?.data ?? fallback;
}

function fallbackDraft(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null,
  profile: ProfileRecord,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null,
  brief?: ReturnType<typeof buildThreadBrief> | null
) {
  if (brief) {
    return modeSpecificFallbackDraft(thread, brief, profile, partnership, currentDraft);
  }

  const signoff = profile.preferredSignature?.trim() || profile.displayName?.trim() || "Creator";
  const baseSubject = currentDraft?.subject?.trim();
  const baseBody = currentDraft?.body?.trim();
  const intro = partnership
    ? `Thanks for the note on ${partnership.deal.campaignName}.`
    : "Thanks for the note.";

  return {
    subject:
      baseSubject ||
      (thread.thread.subject.startsWith("Re:")
        ? thread.thread.subject
        : `Re: ${thread.thread.subject}`),
    body: baseBody
      ? baseBody
      : `${intro}\n\nI reviewed the thread and I'm aligned on the next steps. If there are any updates on timing, deliverables, or contract details, send them over and I'll keep things moving.\n\nBest,\n${signoff}`,
  };
}

function buildEmailReplyDraftRequest(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null,
  profile: ProfileRecord,
  stance?: NegotiationStance | null,
  instructions?: string | null,
  currentDraft?: { subject: string; body: string } | null,
  notes?: EmailThreadNoteRecord[]
) {
  const brief = buildThreadBrief(thread, partnership);
  const briefText = threadBriefForPrompt(brief);
  const modeGuidance = modeSpecificDraftGuidance(brief.mode, brief);
  const fallback = fallbackDraft(thread, partnership, profile, instructions, currentDraft, brief);
  const discrepancyContext =
    thread.promiseDiscrepancies.length > 0
      ? thread.promiseDiscrepancies
          .map(
            (d) => `- ${d.field}: email says "${d.emailClaim}", contract says "${d.contractValue}"`
          )
          .join("\n")
      : "- None";

  const actionContext =
    thread.actionItems.length > 0
      ? thread.actionItems
          .map((a) => `- ${a.action}${a.dueDate ? ` (due: ${a.dueDate})` : ""}`)
          .join("\n")
      : "- None";
  const noteContext =
    notes && notes.length > 0
      ? notes
          .slice(0, 10)
          .map((note) => `- ${note.body}`)
          .join("\n")
      : "- None";

  const stanceInstruction =
    stance === "firm"
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
        partnership?.deal.updatedAt ?? "no-deal-version",
      ].join(":"),
      input: {
        briefText,
        discrepancyContext,
        actionContext,
        noteContext,
        currentDraftContext,
        instructionContext,
        stance: stanceInstruction,
        workspaceContext: workspaceSummary,
        signature: profile.preferredSignature ?? profile.displayName ?? "Creator",
        threadText,
      },
    }),
    systemPrompt: emailDraftSystemPrompt(stance, modeGuidance),
    userPrompt: emailDraftUserPrompt({
      workspaceSummary,
      discrepancyContext,
      actionContext,
      noteContext,
      currentDraftContext,
      instructionContext,
      signature: profile.preferredSignature ?? profile.displayName ?? "Creator",
      threadText,
      briefText,
    }),
    temperature: stance === "firm" ? 0.25 : stance === "exploratory" ? 0.45 : 0.35,
  };
}

function draftTextResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
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
  currentDraft?: { subject: string; body: string } | null,
  notes?: EmailThreadNoteRecord[]
) {
  const request = buildEmailReplyDraftRequest(
    thread,
    partnership,
    profile,
    stance,
    instructions,
    currentDraft,
    notes
  );

  const result = await runStructuredOpenRouterTask({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_draft",
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
    body: normalizeEmailDraftText(draft.body),
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
  notes?: EmailThreadNoteRecord[];
}) {
  const request = buildEmailReplyDraftRequest(
    input.thread,
    input.partnership,
    input.profile,
    input.stance ?? null,
    input.instructions ?? null,
    input.currentDraft ?? null,
    input.notes ?? []
  );
  const prepared = await prepareAiStreamExecution({
    userId: input.viewer.id,
    taskKey: "email_draft",
    featureKey: "premium_inbox",
    metadata: {
      threadId: input.thread.thread.id,
      stance: input.stance ?? null,
    },
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
    userPrompt: request.userPrompt,
  });

  const result = streamText({
    model: provider.chat(prepared.requestedModel, {
      user: input.viewer.id,
      provider: {
        allow_fallbacks: prepared.fallbacks.length > 0,
        data_collection: "deny",
        zdr: true,
      },
      cache_control: {
        type: "ephemeral",
        ttl: "5m",
      },
    }),
    system: `${request.systemPrompt}\n\nReturn only the email body text. Do not include a subject line, JSON, markdown, bullets, or headings.`,
    prompt: request.userPrompt,
    maxOutputTokens: prepared.maxTokens,
    temperature: request.temperature,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "email.generate-draft",
      recordInputs: true,
      recordOutputs: true,
    },
    onFinish: async ({ totalUsage, model }) => {
      await finalizeAiStreamExecution({
        context: {
          userId: input.viewer.id,
          taskKey: "email_draft",
          featureKey: "premium_inbox",
          metadata: {
            threadId: input.thread.thread.id,
            stance: input.stance ?? null,
          },
        },
        prepared,
        usage: {
          promptTokens: totalUsage.inputTokens ?? 0,
          completionTokens: totalUsage.outputTokens ?? 0,
          totalTokens: totalUsage.totalTokens ?? 0,
        },
        resolvedModel: model.modelId ?? prepared.requestedModel,
        inputHash,
      });
    },
  });

  return result.toTextStreamResponse();
}

export async function generateReplySuggestions(
  thread: EmailThreadDetail
): Promise<{ id: string; label: string; prompt: string }[]> {
  const brief = buildThreadBrief(thread, null);
  const briefText = threadBriefForPrompt(brief);
  const fallback = modeSpecificSuggestions(brief.mode, brief);
  const threadText = plainTextThread(thread);
  const modeGuidance = modeSpecificSummaryGuidance(brief.mode);
  const cache = aiCachePolicy({
    taskKey: "email_suggestions",
    scopeKey: `email-suggestions:${thread.thread.id}:${buildEmailThreadVersion(thread.thread)}`,
    input: {
      threadId: thread.thread.id,
      briefText,
      threadText,
    },
  });

  const structuredFallback = {
    suggestions: fallback.map(({ label, prompt }) => ({ label, prompt })),
  };

  const result = await runStructuredOpenRouterTask({
    context: {
      featureKey: "premium_inbox",
      taskKey: "email_suggestions",
    },
    systemPrompt: replySuggestionsSystemPrompt(modeGuidance),
    userPrompt: replySuggestionsUserPrompt(threadText, briefText),
    temperature: 0.4,
    schema: replySuggestionsSchema,
    fallback: structuredFallback,
    cache,
  });

  const items = result?.data?.suggestions ?? structuredFallback.suggestions;
  return items.slice(0, 3).map((entry, index) => ({
    id: `ai-${index}`,
    label: entry.label.trim(),
    prompt: entry.prompt.trim(),
  }));
}
