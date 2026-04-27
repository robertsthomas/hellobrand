import type { AssistantClientContext } from "@/lib/types";

interface AssistantSuggestedPrompt {
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

  if (context.tab === "concepts") {
    return [
      {
        id: "concepts-brainstorm",
        label: "Brainstorm concepts",
        description: "Get help brainstorming creative directions for this campaign.",
        prompt: "Based on the campaign brief and brand context, what creative directions should I explore for my content?"
      },
      {
        id: "concepts-platform",
        label: "Platform strategy",
        description: "Adapt your concepts for specific platforms and formats.",
        prompt: "How should my creative concepts differ across platforms (TikTok, Instagram, YouTube) based on the deliverables in this deal?"
      },
      {
        id: "concepts-messaging",
        label: "Messaging fit",
        description: "Check how brand messaging can integrate naturally into your content.",
        prompt: "How can I weave the brand's key messaging points into my content in a way that feels authentic and not like an ad read?"
      }
    ];
  }

  if (context.pathname.startsWith("/app/inbox")) {
    return [
      {
        id: "inbox-summary",
        label: "Inbox summary",
        description: "Get a quick overview of what needs attention in your inbox.",
        prompt: "What's the current state of my inbox and which threads need my attention first?"
      },
      {
        id: "inbox-draft",
        label: "Draft a reply",
        description: "Turn a selected thread into a creator-professional response.",
        prompt: "Help me draft a concise, professional reply for the most urgent thread in my inbox."
      },
      {
        id: "inbox-followup",
        label: "Follow-up tracker",
        description: "Track which threads need follow-ups and when.",
        prompt: "Which threads in my inbox are waiting on a response from the brand side, and what should I follow up on?"
      }
    ];
  }

  if (context.pathname.startsWith("/app/analytics")) {
    return [
      {
        id: "analytics-summary",
        label: "Portfolio summary",
        description: "Get a high-level view of your partnership performance.",
        prompt: "Give me a summary of my partnership portfolio performance, including earnings trends and deal activity."
      },
      {
        id: "analytics-insights",
        label: "Key insights",
        description: "Surface the most important patterns in your data.",
        prompt: "What are the most important trends or patterns I should know about from my partnership data?"
      },
      {
        id: "analytics-improvement",
        label: "Growth opportunities",
        description: "Identify areas to improve your partnership workflow.",
        prompt: "Based on my portfolio data, where are the biggest opportunities to improve my partnership workflow or earnings?"
      }
    ];
  }

  if (context.pathname.startsWith("/app/intake")) {
    return [
      {
        id: "intake-help",
        label: "Intake guidance",
        description: "Get help setting up a new workspace.",
        prompt: "What should I know about setting up a new workspace, and what information does the extraction pipeline look for?"
      },
      {
        id: "intake-tips",
        description: "Best practices for uploading contracts.",
        label: "Upload tips",
        prompt: "What are the best practices for uploading contracts to get the most accurate extraction?"
      },
      {
        id: "intake-next",
        label: "What happens next",
        description: "Understand the extraction and workspace creation flow.",
        prompt: "What happens after I upload a contract, and how long does extraction take?"
      }
    ];
  }

  if (context.pathname.startsWith("/app/settings")) {
    return [
      {
        id: "settings-profile",
        label: "Profile setup",
        description: "Make sure your profile is configured for the best assistant experience.",
        prompt: "What profile settings should I configure to get the most out of the assistant?"
      },
      {
        id: "settings-billing",
        label: "Plan and features",
        description: "Understand what features are available on your current plan.",
        prompt: "What features do I have access to on my current plan, and what would an upgrade give me?"
      },
      {
        id: "settings-notifications",
        label: "Notification setup",
        description: "Configure alerts for the things that matter most.",
        prompt: "Which notification settings should I enable to stay on top of my partnerships without getting overwhelmed?"
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
