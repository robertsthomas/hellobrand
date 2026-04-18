import type { AssistantTrigger } from "@/lib/types";
import type { DeliverableItem, RiskFlagRecord, DisclosureObligation } from "@/lib/types/deals";

type Suggestion = { label: string; trigger: AssistantTrigger };

function overdueDeliverables(items: DeliverableItem[]): DeliverableItem[] {
  const now = new Date();
  return items.filter(
    (item) => item.dueDate && new Date(item.dueDate) < now && item.status !== "completed"
  );
}

function pendingDeliverables(items: DeliverableItem[]): DeliverableItem[] {
  return items.filter((item) => !item.status || item.status === "pending");
}

function deliverablesMissingDates(items: DeliverableItem[]): DeliverableItem[] {
  return items.filter((item) => !item.dueDate);
}

function deliverablesMissingQuantity(items: DeliverableItem[]): DeliverableItem[] {
  return items.filter((item) => item.quantity === null || item.quantity === undefined);
}

export function buildDeliverableSuggestions(
  dealId: string,
  deliverables: DeliverableItem[]
): Suggestion[] {
  if (deliverables.length === 0) {
    return [
      {
        label: "Ask brand for deliverables",
        trigger: {
          kind: "deliverable",
          sourceId: dealId,
          label: "Ask brand for deliverables",
          prompt:
            "Draft a concise creator-professional email asking the brand to confirm the deliverables, timeline, and approval flow for this partnership because the workspace does not show a reliable deliverables list yet.",
        },
      },
    ];
  }

  const overdue = overdueDeliverables(deliverables);
  const noDates = deliverablesMissingDates(deliverables);
  const noQuantity = deliverablesMissingQuantity(deliverables);
  const names = deliverables
    .slice(0, 4)
    .map((item) => item.title)
    .join(", ");

  const suggestions: Suggestion[] = [];

  if (overdue.length > 0) {
    const overdueNames = overdue
      .slice(0, 3)
      .map((item) => `${item.title} (due ${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "?"})`)
      .join(", ");

    suggestions.push({
      label: `Follow up on overdue item${overdue.length > 1 ? "s" : ""}`,
      trigger: {
        kind: "deliverable",
        sourceId: dealId,
        label: "Follow up on overdue deliverables",
        prompt: `Draft a concise creator-professional follow-up email about overdue deliverables. These items are past due: ${overdueNames}. Ask the brand for an updated timeline and confirm whether the deliverables are still needed.`,
      },
    });
  }

  if (noDates.length > 0) {
    const missingNames = noDates.slice(0, 3).map((item) => item.title).join(", ");

    suggestions.push({
      label: "Clarify deadlines",
      trigger: {
        kind: "deliverable",
        sourceId: dealId,
        label: "Clarify deadlines",
        prompt: `Draft a concise creator-professional email asking the brand to confirm deadlines for these deliverables that have no due date yet: ${missingNames}. Ask for production timelines, approval windows, and posting dates.`,
      },
    });
  }

  if (noQuantity.length > 0 && suggestions.length < 2) {
    const missingNames = noQuantity.slice(0, 3).map((item) => item.title).join(", ");

    suggestions.push({
      label: "Confirm quantities",
      trigger: {
        kind: "deliverable",
        sourceId: dealId,
        label: "Confirm quantities",
        prompt: `Draft a concise creator-professional email asking the brand to confirm the quantities needed for these deliverables: ${missingNames}. Keep it short and direct.`,
      },
    });
  }

  if (pendingDeliverables(deliverables).length > 0 && suggestions.length < 2) {
    suggestions.push({
      label: "Confirm deliverables",
      trigger: {
        kind: "deliverable",
        sourceId: dealId,
        label: "Confirm deliverables",
        prompt: `Draft a concise creator-professional email confirming the current deliverables for this partnership. Use these deliverables as the starting point: ${names}. Ask the brand to correct anything that is off.`,
      },
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      label: "Confirm deliverables",
      trigger: {
        kind: "deliverable",
        sourceId: dealId,
        label: "Confirm deliverables",
        prompt: `Draft a concise creator-professional email confirming the current deliverables for this partnership. Use these deliverables as the starting point: ${names}. Ask the brand to correct anything that is off.`,
      },
    });
  }

  return suggestions.slice(0, 3);
}

export function buildRiskFlagSuggestions(
  dealId: string,
  flags: RiskFlagRecord[]
): Suggestion[] {
  if (flags.length === 0) {
    return [];
  }

  const leadFlag = flags[0];
  const suggestions: Suggestion[] = [];

  suggestions.push({
    label: `Negotiate: ${leadFlag.title}`,
    trigger: {
      kind: "risk_flag",
      sourceId: leadFlag.id,
      label: `Negotiate: ${leadFlag.title}`,
      prompt: [
        `Draft a creator-professional negotiation email for this partnership that addresses this watchout: ${leadFlag.title}.`,
        leadFlag.detail ? `Context: ${leadFlag.detail}.` : "",
        leadFlag.suggestedAction
          ? `Use this as the primary ask: ${leadFlag.suggestedAction}.`
          : "Ask for a concrete revision or clarification.",
        "Keep it grounded in the saved workspace facts and avoid inventing prior agreements.",
      ]
        .filter(Boolean)
        .join(" "),
    },
  });

  if (flags.length > 1) {
    const otherTitles = flags
      .slice(1, 4)
      .map((f) => f.title)
      .join(", ");

    suggestions.push({
      label: `Address all ${flags.length} watchouts`,
      trigger: {
        kind: "risk_flag",
        sourceId: leadFlag.id,
        label: `Address all watchouts`,
        prompt: [
          `Draft a creator-professional email addressing ${flags.length} watchouts in this partnership.`,
          `Primary concern: ${leadFlag.title}. ${leadFlag.detail ?? ""}`,
          `Additional watchouts: ${otherTitles}.`,
          "Propose concrete next steps for each concern. Keep it grounded in the saved workspace facts.",
        ].join(" "),
      },
    });
  }

  return suggestions;
}

export function buildDisclosureSuggestions(
  dealId: string,
  obligations: DisclosureObligation[]
): Suggestion[] {
  if (obligations.length === 0) {
    return [];
  }

  const titles = obligations
    .slice(0, 3)
    .map((o) => o.title)
    .join(", ");

  return [
    {
      label: "Clarify approval flow",
      trigger: {
        kind: "approval",
        sourceId: dealId,
        label: "Clarify approvals",
        prompt: `Draft a concise creator-professional email clarifying the approval and disclosure workflow for this partnership. Ask the brand to confirm review timing, mandatory approvals, and any non-negotiable disclosure requirements. Focus on: ${titles}.`,
      },
    },
  ];
}
