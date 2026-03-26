import type { EmailThreadDetail } from "@/lib/types";

export type ReplySuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export function buildEmailThreadVersion(
  thread: Pick<EmailThreadDetail["thread"], "updatedAt" | "lastMessageAt" | "messageCount">
) {
  return [thread.updatedAt, thread.lastMessageAt, thread.messageCount].join(":");
}

export function buildReplySuggestionThreadVersion(
  thread: Pick<EmailThreadDetail["thread"], "updatedAt" | "lastMessageAt" | "messageCount">
) {
  return buildEmailThreadVersion(thread);
}

export function buildEmailMessageVersion(
  message: Pick<EmailThreadDetail["messages"][number], "id" | "updatedAt" | "receivedAt" | "sentAt">
) {
  return [
    message.id,
    message.updatedAt,
    message.receivedAt ?? "",
    message.sentAt ?? ""
  ].join(":");
}

export function sanitizeReplySuggestions(value: unknown): ReplySuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is ReplySuggestion =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === "string" &&
        typeof (entry as { label?: unknown }).label === "string" &&
        typeof (entry as { prompt?: unknown }).prompt === "string"
    )
    .map((entry) => ({
      id: entry.id.trim(),
      label: entry.label.trim(),
      prompt: entry.prompt.trim()
    }))
    .filter(
      (entry) =>
        entry.id.length > 0 && entry.label.length > 0 && entry.prompt.length > 0
    );
}
