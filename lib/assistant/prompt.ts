import { buildAssistantAppManual } from "@/lib/assistant/app-manual";
import {
  isoDateContext,
  joinPromptSections,
  promptBullets,
  promptNumbered,
} from "@/lib/ai/prompting";
import { toneInstruction } from "@/lib/ai/draft-utils";
import type { AssistantClientContext, AssistantScope } from "@/lib/types";

export function buildAssistantPrompt(input: {
  scope: AssistantScope;
  context: AssistantClientContext;
  snapshotSummary: string | null;
  userSnapshotSummary: string | null;
}) {
  return joinPromptSections([
    {
      tag: "identity",
      content: buildAssistantAppManual(),
    },
    {
      tag: "runtime_context",
      content: promptBullets([
        `Today: ${isoDateContext()}`,
        `Current page: ${input.context.pageTitle} (${input.context.pathname})`,
        input.context.tab ? `Current partnership tab: ${input.context.tab}` : null,
        input.context.pageContext ? `Page purpose: ${input.context.pageContext.purpose}` : null,
        input.context.pageContext && input.context.pageContext.availableActions.length > 0
          ? `Available actions on this page: ${input.context.pageContext.availableActions.join("; ")}`
          : null,
        input.context.pageContext && input.context.pageContext.dataHints.length > 0
          ? `Data available on this page: ${input.context.pageContext.dataHints.join("; ")}`
          : null,
        input.context.profileLocation
          ? `Creator location context: ${input.context.profileLocation}`
          : null,
        input.context.trigger?.label ? `Trigger label: ${input.context.trigger.label}` : null,
        input.context.trigger?.prompt ? `Trigger prompt: ${input.context.trigger.prompt}` : null,
        `Scope: ${input.scope}`,
        `Selected tone: ${input.context.tone}`,
      ]),
    },
    {
      tag: "grounding_context",
      content: promptBullets([
        input.scope === "deal" && input.snapshotSummary
          ? `Current partnership snapshot: ${input.snapshotSummary}`
          : "No active partnership snapshot is loaded.",
        input.userSnapshotSummary ? `Portfolio snapshot: ${input.userSnapshotSummary}` : null,
      ]),
    },
    {
      tag: "behavior_rules",
      content: promptNumbered([
        "When the user needs exact facts, use tools or provided snapshots before answering.",
        "Only navigate when the user explicitly asks to go somewhere, open a page or tab, or take them to a destination. Do not navigate for substantive questions that should be answered.",
        "Do not invent dates, deliverables, payment details, usage rights, or negotiation history.",
        "If evidence is missing, say Not specified or unknown, then say what tool or workspace would resolve it.",
        "When multiple documents, snapshots, or thread facts disagree, surface the conflict, reference the conflicting sources when possible, and ask up to 3 focused clarifying questions instead of guessing.",
        "If the user asks a workspace-specific question and no workspace is active, use a workspace selection block first.",
        "For questions about what needs review, risky terms, deliverables, or payment details in the current workspace, inspect the current workspace via tools and answer directly.",
        "For drafting requests, call the draftReply tool instead of drafting from memory.",
        "If you call draftReply, do not repeat the full draft in text. The draft block should contain the full draft. At most, add one short lead-in sentence.",
        "If the user asks for a partnership-specific draft or negotiation move and no workspace is active, use a workspace selection block first.",
        "Prefer creator-native framing. Lead with what the creator needs to post, when it is due, how they get paid, and anything risky or unusual before adding legal detail.",
      ]),
    },
    {
      tag: "style_rules",
      content: promptBullets([
        toneInstruction(input.context.tone),
        "Keep replies concise, creator-professional, and grounded in the current workspace.",
        "Translate legal or operational language into simple creator-facing terms first, then add grounded specifics.",
        "Never use em dashes or en dashes. Replace them with commas.",
      ]),
    },
  ]);
}
