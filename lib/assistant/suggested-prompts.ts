import type { AssistantClientContext } from "@/lib/types";

export interface AssistantSuggestedPrompt {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

function normalizeLocation(value: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getAssistantLocationLabel(location: string | null) {
  const normalized = normalizeLocation(location);

  if (!normalized) {
    return null;
  }

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, 2).join(", ");
}

function locationPhrase(location: string | null) {
  const label = getAssistantLocationLabel(location);
  return label ? `based in ${label}` : "in my current market";
}

function genericPrompts(): AssistantSuggestedPrompt[] {
  return [
    {
      id: "generic-risks",
      label: "Contract risks",
      description: "Spot the biggest contract issues and what to push back on.",
      prompt: "What are the biggest risks I should review in this workspace, and what should I push back on first?"
    },
    {
      id: "generic-payment",
      label: "Payment questions",
      description: "Pressure-test payment timing, invoices, and follow-up language.",
      prompt: "What payment, invoice, or approval questions should I clarify before I move forward?"
    },
    {
      id: "generic-draft",
      label: "Draft a reply",
      description: "Turn the current workspace into a concise creator-professional response.",
      prompt: "Draft a concise creator-professional reply based on the current workspace and flag anything I should clarify first."
    }
  ];
}

export function buildAssistantSuggestedPrompts(
  context: AssistantClientContext
): AssistantSuggestedPrompt[] {
  const location = locationPhrase(context.profileLocation);

  if (context.tab === "risks" || context.tab === "terms") {
    return [
      {
        id: "terms-local-risks",
        label: "Local contract risks",
        description: "Check venue, governing law, and practical leverage from where you are.",
        prompt: `What contract clauses should I double-check as a creator ${location}, especially venue, governing law, and enforcement risk?`
      },
      {
        id: "terms-local-payment",
        label: "Local payment setup",
        description: "Pressure-test payout, tax, and invoice assumptions tied to your location.",
        prompt: `What payment, tax, or invoicing details should I clarify because I am a creator ${location}?`
      },
      {
        id: "terms-local-logistics",
        label: "Shipping and travel",
        description: "Catch assumptions around travel, product delivery, or on-site production.",
        prompt: `Are there any shipping, travel, or in-person production assumptions in this deal that I should clarify as someone ${location}?`
      }
    ];
  }

  if (context.tab === "invoices" || context.pathname.startsWith("/app/payments")) {
    return [
      {
        id: "payments-local-checklist",
        label: "Invoice checklist",
        description: "Build a clean payment checklist for your location and workflow.",
        prompt: `Give me a practical invoice and payment checklist for a creator ${location}, based on what is in this workspace.`
      },
      {
        id: "payments-local-followup",
        label: "Payment follow-up",
        description: "Draft a payment nudge that matches the workspace facts.",
        prompt: `Draft a concise payment follow-up that makes sense for a creator ${location} and stays grounded in this workspace.`
      },
      {
        id: "payments-local-flags",
        label: "Tax and payout flags",
        description: "Flag payout structure, currency, and tax questions worth resolving now.",
        prompt: `What payout, currency, or tax-related questions should I resolve early because I am ${location}?`
      }
    ];
  }

  if (context.tab === "deliverables" || context.tab === "brief") {
    return [
      {
        id: "deliverables-local-logistics",
        label: "Production logistics",
        description: "Surface timing, travel, and delivery assumptions tied to your location.",
        prompt: `What production, travel, or shipping assumptions should I clarify for this campaign as a creator ${location}?`
      },
      {
        id: "deliverables-local-questions",
        label: "Clarifying questions",
        description: "Generate brand-facing questions around local execution details.",
        prompt: `Draft a short list of clarifying questions about local logistics, shipping, or scheduling for someone ${location}.`
      },
      {
        id: "deliverables-local-timeline",
        label: "Timeline risks",
        description: "Check whether dates and dependencies are realistic from where you are.",
        prompt: `Do the deliverable dates and campaign timing still look realistic for a creator ${location}, and what should I ask to tighten up?`
      }
    ];
  }

  if (context.profileLocation) {
    return [
      {
        id: "location-general-risks",
        label: "Local contract risks",
        description: "Review the workspace through the lens of your saved location.",
        prompt: `What should I keep in mind for creator contracts and negotiations as someone ${location}?`
      },
      {
        id: "location-general-payment",
        label: "Local payment questions",
        description: "Make sure payment and invoicing expectations line up with your setup.",
        prompt: `What payment, invoice, or tax questions should I ask because I am a creator ${location}?`
      },
      {
        id: "location-general-logistics",
        label: "Local campaign logistics",
        description: "Catch assumptions around travel, shipping, and on-site work.",
        prompt: `What campaign logistics should I confirm early if this partnership needs shipping, travel, or in-person work and I am ${location}?`
      }
    ];
  }

  return genericPrompts();
}
