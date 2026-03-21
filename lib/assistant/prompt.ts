import { buildAssistantAppManual } from "@/lib/assistant/app-manual";
import type { AssistantClientContext, AssistantScope, AssistantTone } from "@/lib/types";

function toneInstruction(tone: AssistantTone) {
  switch (tone) {
    case "friendly":
      return "Write in a friendly, approachable tone. Keep it warm but still practical and grounded.";
    case "direct":
      return "Write in a direct tone. Keep it concise, sharp, and easy to scan.";
    case "warm":
      return "Write in a warm, human tone. Keep it supportive without becoming vague.";
    case "professional":
    default:
      return "Write in a professional tone. Keep it polished, clear, and business-ready.";
  }
}

export function buildAssistantPrompt(input: {
  scope: AssistantScope;
  context: AssistantClientContext;
  snapshotSummary: string | null;
  userSnapshotSummary: string | null;
}) {
  return [
    buildAssistantAppManual(),
    `Current page: ${input.context.pageTitle} (${input.context.pathname})`,
    input.context.tab ? `Current partnership tab: ${input.context.tab}` : null,
    input.context.trigger?.label ? `Trigger label: ${input.context.trigger.label}` : null,
    input.context.trigger?.prompt ? `Trigger prompt: ${input.context.trigger.prompt}` : null,
    input.scope === "deal" && input.snapshotSummary
      ? `Current partnership snapshot: ${input.snapshotSummary}`
      : null,
    input.userSnapshotSummary ? `Portfolio snapshot: ${input.userSnapshotSummary}` : null,
    `Selected tone: ${input.context.tone}`,
    toneInstruction(input.context.tone),
    "When the user needs exact facts, call tools first instead of guessing.",
    "For drafting requests, call the draftReply tool instead of writing the draft from memory.",
    "If you call the draftReply tool, do not repeat the full draft in text. The draft block should be the only full draft output. At most, add one short lead-in sentence.",
    "If the user asks for a partnership-specific draft or negotiation move and no partnership workspace is active, use a workspace selection block so they can choose the correct workspace.",
    "When drafting a reply, keep it concise, specific, and creator-professional.",
    "Never use em dashes or en dashes. Replace them with commas."
  ]
    .filter(Boolean)
    .join("\n\n");
}
