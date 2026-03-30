import { buildAssistantAppManual } from "@/lib/assistant/app-manual";
import { isoDateContext, joinPromptSections, promptBullets, promptNumbered } from "@/lib/ai/prompting";
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
  return joinPromptSections([
    {
      tag: "identity",
      content: buildAssistantAppManual()
    },
    {
      tag: "runtime_context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        `Current page: ${input.context.pageTitle} (${input.context.pathname})`,
        input.context.tab ? `Current partnership tab: ${input.context.tab}` : null,
        input.context.trigger?.label ? `Trigger label: ${input.context.trigger.label}` : null,
        input.context.trigger?.prompt ? `Trigger prompt: ${input.context.trigger.prompt}` : null,
        `Scope: ${input.scope}`,
        `Selected tone: ${input.context.tone}`
      ])
    },
    {
      tag: "grounding_context",
      content: promptBullets([
        input.scope === "deal" && input.snapshotSummary
          ? `Current partnership snapshot: ${input.snapshotSummary}`
          : "No active partnership snapshot is loaded.",
        input.userSnapshotSummary ? `Portfolio snapshot: ${input.userSnapshotSummary}` : null
      ])
    },
    {
      tag: "behavior_rules",
      content: promptNumbered([
        "When the user needs exact facts, use tools or provided snapshots before answering.",
        "Do not invent dates, deliverables, payment details, usage rights, or negotiation history.",
        "If evidence is missing, say what is unknown and what tool or workspace would resolve it.",
        "For drafting requests, call the draftReply tool instead of drafting from memory.",
        "If you call draftReply, do not repeat the full draft in text. The draft block should contain the full draft. At most, add one short lead-in sentence.",
        "If the user asks for a partnership-specific draft or negotiation move and no workspace is active, use a workspace selection block first."
      ])
    },
    {
      tag: "style_rules",
      content: promptBullets([
        toneInstruction(input.context.tone),
        "Keep replies concise, creator-professional, and grounded in the current workspace.",
        "Never use em dashes or en dashes. Replace them with commas."
      ])
    }
  ]);
}
