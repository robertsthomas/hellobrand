/**
 * Business logic helpers, shared types, and constants for the inbox workspace.
 * No React, no hooks — pure functions and data definitions.
 */
import type {
  EmailActionItemRecord,
  EmailParticipant,
  EmailThreadListItem,
  NegotiationStance,
  ProfileRecord,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

export type PreviewUpdateEntry = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
  href?: string;
  ctaLabel?: string;
};

export type DraftPromptSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export type DraftPromptSuggestionCacheEntry = {
  version: string;
  suggestions: DraftPromptSuggestion[];
};

type ThreadCopilotInsightCacheEntry = {
  risks: RiskSuggestion[];
  documents: DocumentSuggestion[];
};

export type RiskSuggestion = {
  id: string;
  label: string;
  detail: string;
};

export type DocumentSuggestion = {
  id: string;
  fileName: string;
  documentKind: string;
};

export type ThreadInvoiceAttachment = {
  dealId: string;
  documentId: string;
  fileName: string;
  invoiceNumber: string;
  status: string;
};

export const DRAFT_REFINEMENT_OPTIONS = {
  length: [
    {
      label: "Shorter",
      instruction:
        "Revise the current draft to be materially shorter and tighter while preserving the same intent and asks. Cut roughly 25 to 40 percent of the length, remove repetition, and keep only the strongest points."
    },
    {
      label: "Longer",
      instruction:
        "Revise the current draft to be materially longer and more detailed while preserving the same intent and asks. Expand it by roughly 30 to 60 percent, add 2 to 4 meaningful sentences, and make the added detail specific and useful rather than filler."
    }
  ],
  tone: [
    {
      label: "Formal",
      instruction:
        "Revise the current draft to sound noticeably more formal and polished while keeping the same message. Use more precise business language, tighten casual phrasing, and make the tonal shift obvious."
    },
    {
      label: "Relaxed",
      instruction:
        "Revise the current draft to sound noticeably more relaxed and conversational while keeping it professional. Soften stiff phrasing and make the tone shift obvious."
    },
    {
      label: "Warm",
      instruction:
        "Revise the current draft to feel noticeably warmer and more personable while keeping the same core message. Add more human warmth and appreciation so the change is easy to feel."
    }
  ],
  focus: [
    {
      label: "Clarify asks",
      instruction:
        "Revise the current draft to focus much more clearly on the questions or clarifications you need from the brand. Make the asks explicit, easy to scan, and hard to miss."
    },
    {
      label: "Protect terms",
      instruction:
        "Revise the current draft to focus much more on protecting boundaries, scope, timing, and commercial terms. Make the protection of the creator's position noticeably stronger."
    },
    {
      label: "Close next steps",
      instruction:
        "Revise the current draft to end with much clearer next steps and a stronger call to action. The close should feel noticeably more decisive and action-oriented."
    }
  ]
} as const;

export const DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY =
  "hellobrand:inbox:draft-prompt-suggestions";
export const THREAD_ACTION_BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60";
export const INBOX_SIGNATURE_BANNER_DISMISS_KEY =
  "hellobrand:inbox:signature-banner:dismissed";

export function buildActionItemReplyPrompt(item: EmailActionItemRecord) {
  const contextLines = [
    `Draft an email reply that addresses this action item: ${item.action}.`,
    item.dueDate ? `Target due date: ${formatDate(item.dueDate)}.` : null,
    item.sourceText ? `Relevant email context: "${item.sourceText}".` : null,
    `Use the linked workspace context for tone and facts, answer the request directly, and do not invent missing details.`
  ].filter(Boolean);

  return contextLines.join(" ");
}

export function isLegacyThreadSummary(value: string | null | undefined) {
  const summary = value?.trim();
  if (!summary) {
    return false;
  }

  if (summary.length > 700) {
    return true;
  }

  return [
    "what they are asking you to do",
    "what the other side is committing",
    "unresolved or not specified in the thread",
    "suggested next steps for you"
  ].some((marker) => summary.toLowerCase().includes(marker));
}

export function threadSearchText(item: EmailThreadListItem) {
  return [
    item.thread.subject,
    item.thread.snippet,
    item.account.emailAddress,
    item.account.provider,
    ...item.thread.participants.flatMap((participant) => [
      participant.name ?? "",
      participant.email,
    ]),
    ...item.links.map((link) => link.campaignName),
  ]
    .join(" ")
    .toLowerCase();
}

export function cleanWorkspaceText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function removeReplyPrefixes(subject: string) {
  return cleanWorkspaceText(subject.replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/gi, ""));
}

function stripWorkspaceSuffixes(subject: string) {
  return cleanWorkspaceText(
    removeReplyPrefixes(subject).replace(/\b(partnership|collaboration|campaign)\b/gi, "")
  );
}

function inferBrandNameFromParticipant(participant: EmailParticipant | null | undefined) {
  if (!participant) {
    return null;
  }

  const participantName = cleanWorkspaceText((participant.name ?? "").replace(/[<>]/g, ""));
  if (participantName && !participantName.includes("@")) {
    return participantName;
  }

  const domain = participant.email.split("@")[1] ?? "";
  const root = domain.split(".")[0] ?? "";
  if (!root) {
    return null;
  }

  return root
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function inferWorkspaceDraftFromThread(item: EmailThreadListItem) {
  const externalParticipant =
    item.thread.participants.find(
      (participant) =>
        participant.email.toLowerCase() !== item.account.emailAddress.toLowerCase()
    ) ?? item.thread.participants[0] ?? null;
  const brandName = (inferBrandNameFromParticipant(externalParticipant) ?? "Inbox lead").slice(
    0,
    120
  );
  const cleanedSubject = stripWorkspaceSuffixes(item.thread.subject);
  const campaignName =
    (cleanedSubject.length >= 2 ? cleanedSubject : `${brandName} partnership`).slice(0, 120);

  return {
    brandName,
    campaignName,
    notes: `Created from inbox thread: ${item.thread.subject}`.slice(0, 5000)
  };
}

export function latestUpdatedAt(items: Array<{ updatedAt: string }>) {
  return items.reduce<string | null>((latest, item) => {
    if (!latest || item.updatedAt > latest) {
      return item.updatedAt;
    }

    return latest;
  }, null);
}

export function missingReplySignatureFields(profile: ProfileRecord | null) {
  if (!profile) {
    return ["creator name", "business name or handle", "default sign-off"];
  }

  return [
    !profile.creatorLegalName?.trim() && "creator name",
    !profile.businessName?.trim() && "business name or handle",
    !profile.preferredSignature?.trim() && "default sign-off"
  ].filter(Boolean) as string[];
}

export function hasUnseenPreviewSection(latestAt: string | null, seenAt: string | null | undefined) {
  if (!latestAt) {
    return false;
  }

  return !seenAt || latestAt > seenAt;
}

export function isPreviewSectionCleared(latestAt: string | null, clearedAt: string | null | undefined) {
  if (!latestAt || !clearedAt) {
    return false;
  }

  return latestAt <= clearedAt;
}

export function normalizePreviewUpdateBody(body: string) {
  return cleanWorkspaceText(body).toLowerCase();
}

export function combineEventUpdateTitles(titles: string[]) {
  const uniqueTitles = Array.from(new Set(titles));
  if (uniqueTitles.length <= 1) {
    return uniqueTitles[0] ?? "Email update";
  }

  const labels = uniqueTitles.map((title) => {
    switch (title) {
      case "Action requested from the creator":
        return "asks";
      case "Usage rights or exclusivity update":
        return "usage rights";
      case "Deliverable-related update":
        return "deliverables";
      case "Timeline or scheduling update":
        return "timeline";
      case "Payment-related update":
        return "payment";
      case "Approval status update":
        return "approval";
      case "New attachment added to linked thread":
        return "attachments";
      default:
        return title.toLowerCase();
    }
  });

  if (labels.length === 2) {
    return `Email mentions ${labels[0]} and ${labels[1]}`;
  }

  return `Email mentions ${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

export function loadDraftPromptSuggestionCache() {
  if (typeof window === "undefined") {
    return {} as Record<string, DraftPromptSuggestionCacheEntry>;
  }

  try {
    const raw = window.sessionStorage.getItem(DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY);
    if (!raw) {
      return {} as Record<string, DraftPromptSuggestionCacheEntry>;
    }

    const parsed = JSON.parse(raw) as Record<
      string,
      Partial<DraftPromptSuggestionCacheEntry> | undefined
    >;

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        return (
          Boolean(value?.version) &&
          Array.isArray(value?.suggestions)
        );
      })
    ) as Record<string, DraftPromptSuggestionCacheEntry>;
  } catch {
    return {} as Record<string, DraftPromptSuggestionCacheEntry>;
  }
}

function stancePromptSuggestion(stance: NegotiationStance | ""): DraftPromptSuggestion {
  switch (stance) {
    case "firm":
      return {
        id: "tone-firm",
        label: "Keep it direct",
        prompt:
          "Write the reply in a firm, direct tone. Protect our current position, avoid unnecessary concessions, and only make commitments already supported by the linked workspace context.",
      };
    case "exploratory":
      return {
        id: "tone-exploratory",
        label: "Lead with questions",
        prompt:
          "Write the reply in an exploratory tone. Ask clarifying questions where the thread or workspace context is incomplete, and avoid locking in details that are not yet confirmed.",
      };
    case "collaborative":
    default:
      return {
        id: "tone-collaborative",
        label: "Keep it balanced",
        prompt:
          "Write the reply in a collaborative tone. Keep it constructive, move the conversation forward, and align the response with the linked workspace context and current thread.",
      };
  }
}

export function sanitizeEmailHtml(html: string) {
  if (typeof window === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const blockedSelectors = [
    "script",
    "style",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "link",
    "meta",
    "base"
  ];

  for (const selector of blockedSelectors) {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  }

  document.querySelectorAll("img").forEach((node) => node.remove());

// fallow-ignore-next-line complexity
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "href") {
        if (!/^(https?:|mailto:|tel:|#)/i.test(value)) {
          element.removeAttribute(attribute.name);
        } else if (element.tagName.toLowerCase() === "a") {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noreferrer noopener");
        }
        continue;
      }

      if (name === "src") {
        if (!/^https?:/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
    }
  });

  return document.body.innerHTML.trim();
}
