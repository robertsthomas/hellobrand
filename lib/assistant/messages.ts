import type { UIMessage } from "ai";

import type { AssistantMessageRecord } from "@/lib/types";

type BasicUIPart = {
  type: string;
  text?: string;
};

export function assistantMessageText(parts: unknown[] | null | undefined) {
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .flatMap((part) => {
      if (!part || typeof part !== "object") {
        return [];
      }

      const typed = part as BasicUIPart;
      return typed.type === "text" && typeof typed.text === "string" ? [typed.text] : [];
    })
    .join("\n")
    .trim();
}

export function assistantRecordToUIMessage(record: AssistantMessageRecord): UIMessage {
  return {
    id: record.id,
    role: record.role,
    parts:
      Array.isArray(record.parts) && record.parts.length > 0
        ? (record.parts as UIMessage["parts"])
        : [{ type: "text", text: record.content }]
  };
}

export function assistantRecordsToUIMessages(records: AssistantMessageRecord[]) {
  return records.map(assistantRecordToUIMessage);
}
