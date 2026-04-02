import { replaceDashesWithCommas } from "@/lib/assistant/text";
import { assistantMessageText } from "@/lib/assistant/messages";
import type { AssistantClientContext, AssistantMessageRecord, AssistantScope } from "@/lib/types";

function assistantErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

export function isAssistantProviderContentPolicyError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("content policy") ||
    normalized.includes("content_filter") ||
    normalized.includes("responsible ai") ||
    normalized.includes("aoaicodeofconduct") ||
    normalized.includes("temporarily blocked")
  );
}

function clip(value: string | null | undefined, max = 240) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max)}...`;
}

export function logAssistantProviderDiagnostics(input: {
  area: "assistant_stream" | "assistant_route";
  error: unknown;
  scope: AssistantScope;
  context: AssistantClientContext;
  threadId?: string | null;
  persistedMessages?: AssistantMessageRecord[];
  uiMessages?: Array<{ role: string; parts?: unknown[] | null }>;
  snapshotSummary?: string | null;
  userSnapshotSummary?: string | null;
  systemPrompt?: string | null;
}) {
  const message = assistantErrorText(input.error);

  if (!isAssistantProviderContentPolicyError(message)) {
    return;
  }

  const recentUserMessage =
    input.persistedMessages
      ?.filter((entry) => entry.role === "user")
      .at(-1)?.content ??
    [...(input.uiMessages ?? [])]
      .reverse()
      .find((entry) => entry.role === "user" && Array.isArray(entry.parts))
      ?.parts;

  const recentAssistantMessage =
    input.persistedMessages?.filter((entry) => entry.role === "assistant").at(-1)?.content ?? null;

  const recentUserExcerpt = Array.isArray(recentUserMessage)
    ? clip(assistantMessageText(recentUserMessage))
    : clip(recentUserMessage);

  console.error("[assistant] provider content policy block", {
    area: input.area,
    threadId: input.threadId ?? null,
    scope: input.scope,
    pathname: input.context.pathname,
    pageTitle: input.context.pageTitle,
    tab: input.context.tab,
    tone: input.context.tone,
    profileLocation: input.context.profileLocation,
    triggerKind: input.context.trigger?.kind ?? null,
    triggerLabel: clip(input.context.trigger?.label),
    triggerPrompt: clip(input.context.trigger?.prompt),
    recentUserMessage: recentUserExcerpt,
    recentAssistantMessage: clip(recentAssistantMessage),
    snapshotSummary: clip(input.snapshotSummary),
    userSnapshotSummary: clip(input.userSnapshotSummary),
    systemPrompt: clip(input.systemPrompt, 320),
    persistedMessageCount: input.persistedMessages?.length ?? null,
    providerMessage: clip(message, 320)
  });
}

export function formatAssistantProviderError(error: unknown) {
  const message = assistantErrorText(error);

  if (isAssistantProviderContentPolicyError(message)) {
    return replaceDashesWithCommas(
      "The AI provider blocked that request before I could answer. Try a more neutral rewrite or ask a narrower question like listing deliverables, payment timing, or drafting a reply."
    );
  }

  return replaceDashesWithCommas(
    message || "I ran into a backend issue before I could finish answering."
  );
}
