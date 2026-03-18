import { z } from "zod";

import {
  createAssistantDraftBlock,
  createAssistantNavigationBlock
} from "@/lib/assistant/blocks";
import { buildAssistantHref } from "@/lib/assistant/app-manual";
import { buildWorkspaceSelectionBlock } from "@/lib/assistant/server-blocks";
import { replaceDashesWithCommas } from "@/lib/assistant/text";
import { getDealForViewer, listDealAggregatesForViewer } from "@/lib/deals";
import { generateEmailDraft } from "@/lib/email/generate";
import { getProfileForViewer } from "@/lib/profile";
import { ensureAssistantSnapshot } from "@/lib/assistant/snapshots";
import type {
  AssistantClientContext,
  AssistantMessageRecord,
  DraftIntent,
  Viewer
} from "@/lib/types";

function safeIntent(value: string | null | undefined): DraftIntent | null {
  const valid: DraftIntent[] = [
    "clarify-clause",
    "request-faster-payment",
    "limit-usage-rights",
    "clarify-deadline",
    "payment-reminder",
    "request-contract-revisions",
    "confirm-deliverables",
    "confirm-revised-brief"
  ];

  return value && valid.includes(value as DraftIntent) ? (value as DraftIntent) : null;
}

function buildGenericDraft(subjectBase: string, recipient: string, focus: string, sender: string) {
  return {
    subject: `${subjectBase} follow-up`,
    body: `Hi ${recipient},\n\nI’m following up on ${focus}. I’d like to make sure we’re aligned on the current terms and next steps before moving forward.\n\nIf helpful, I can send proposed wording or a clean summary of what I’m asking to revise.\n\nBest,\n${sender}`
  };
}

function lastUserPrompt(messages: AssistantMessageRecord[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content.trim() || null;
}

export function buildAssistantTools(input: {
  viewer: Viewer;
  threadDealId: string | null;
  persistedMessages: AssistantMessageRecord[];
  context: AssistantClientContext;
}) {
  const activeUserPrompt = lastUserPrompt(input.persistedMessages);

  return {
    getDealSnapshot: {
      description: "Look up the current deal snapshot or another specific deal by id.",
      inputSchema: z.object({
        dealId: z.string().optional()
      }),
      execute: async ({ dealId }: { dealId?: string }) => {
        const targetDealId = dealId ?? input.threadDealId;

        if (!targetDealId) {
          return { error: "No deal is currently selected." };
        }

        const snapshot = await ensureAssistantSnapshot(input.viewer, "deal", targetDealId);
        return snapshot?.payload ?? { error: "Deal snapshot not found." };
      }
    },
    searchDeals: {
      description: "Search the viewer's deal portfolio by brand or campaign name.",
      inputSchema: z.object({
        query: z.string().min(1)
      }),
      execute: async ({ query }: { query: string }) => {
        const lower = query.toLowerCase();
        const aggregates = await listDealAggregatesForViewer(input.viewer);

        return aggregates
          .filter((aggregate) => {
            return (
              aggregate.deal.brandName.toLowerCase().includes(lower) ||
              aggregate.deal.campaignName.toLowerCase().includes(lower)
            );
          })
          .slice(0, 5)
          .map((aggregate) => ({
            dealId: aggregate.deal.id,
            brandName: aggregate.deal.brandName,
            campaignName: aggregate.deal.campaignName,
            status: aggregate.deal.status,
            paymentStatus: aggregate.deal.paymentStatus,
            riskCount: aggregate.riskFlags.length
          }));
      }
    },
    listWorkspaces: {
      description: "Present recent or matching workspaces as a clickable selection block.",
      inputSchema: z.object({
        reason: z.string().min(1),
        prompt: z.string().optional(),
        query: z.string().optional(),
        tab: z.string().optional()
      }),
      execute: async ({
        reason,
        prompt,
        query,
        tab
      }: {
        reason: string;
        prompt?: string;
        query?: string;
        tab?: string;
      }) =>
        buildWorkspaceSelectionBlock({
          viewer: input.viewer,
          prompt: prompt ?? activeUserPrompt,
          query,
          tab: tab ?? "overview",
          title: "Choose a workspace",
          description: reason
        })
    },
    getDealEvidence: {
      description: "Retrieve evidence snippets and risk details for a deal field or risk category.",
      inputSchema: z.object({
        dealId: z.string().optional(),
        field: z.string().min(1)
      }),
      execute: async ({ dealId, field }: { dealId?: string; field: string }) => {
        const targetDealId = dealId ?? input.threadDealId;

        if (!targetDealId) {
          return buildWorkspaceSelectionBlock({
            viewer: input.viewer,
            prompt: activeUserPrompt ?? `Show me the evidence for ${field}`,
            tab: input.context.tab ?? "overview",
            title: "Which workspace should I use?",
            description: "This evidence request needs a specific workspace. Pick one and I’ll continue there."
          });
        }

        const aggregate = await getDealForViewer(input.viewer, targetDealId);
        if (!aggregate) {
          return { error: "Deal not found." };
        }

        return {
          field,
          snippets: aggregate.extractionEvidence
            .filter((entry) => entry.fieldPath.toLowerCase().includes(field.toLowerCase()))
            .slice(0, 5)
            .map((entry) => ({
              snippet: entry.snippet,
              fieldPath: entry.fieldPath,
              confidence: entry.confidence
            })),
          matchingRisks: aggregate.riskFlags
            .filter((flag) => flag.category.includes(field.toLowerCase()))
            .map((flag) => ({
              title: flag.title,
              severity: flag.severity,
              suggestedAction: flag.suggestedAction,
              evidence: flag.evidence
            }))
        };
      }
    },
    navigateTo: {
      description: "Create a validated navigation target inside HelloBrand.",
      inputSchema: z.object({
        target: z.string().min(1),
        label: z.string().min(1),
        dealId: z.string().optional()
      }),
      execute: async ({
        target,
        label,
        dealId
      }: {
        target: string;
        label: string;
        dealId?: string;
      }) => {
        const href = buildAssistantHref(target, {
          dealId: dealId ?? input.threadDealId
        });

        return href
          ? createAssistantNavigationBlock({ href, label })
          : { error: "Invalid route target." };
      }
    },
    draftReply: {
      description: "Draft a creator-professional reply grounded in the current deal.",
      inputSchema: z.object({
        dealId: z.string().optional(),
        intent: z.string().optional(),
        focus: z.string().min(1),
        recipient: z.string().optional()
      }),
      execute: async ({
        dealId,
        intent,
        focus,
        recipient
      }: {
        dealId?: string;
        intent?: string;
        focus: string;
        recipient?: string;
      }) => {
        const targetDealId = dealId ?? input.threadDealId;

        if (!targetDealId) {
          return buildWorkspaceSelectionBlock({
            viewer: input.viewer,
            prompt: activeUserPrompt ?? focus,
            tab: "emails",
            title: "Which workspace should I draft for?",
            description: "This draft needs a specific workspace. Pick one and I’ll continue in that deal’s email context."
          });
        }

        const aggregate = await getDealForViewer(input.viewer, targetDealId);
        if (!aggregate) {
          return { error: "Deal not found." };
        }

        const profile = process.env.DATABASE_URL
          ? await getProfileForViewer(input.viewer).catch(() => null)
          : null;
        const sender =
          profile?.preferredSignature?.trim() ||
          profile?.displayName?.trim() ||
          input.viewer.displayName;
        const validIntent = safeIntent(intent);
        const draft = validIntent
          ? generateEmailDraft(aggregate, validIntent, sender)
          : buildGenericDraft(
              aggregate.deal.campaignName || aggregate.deal.brandName,
              recipient || `${aggregate.deal.brandName} team`,
              focus,
              sender
            );

        return createAssistantDraftBlock({
          label: replaceDashesWithCommas(focus),
          subject: replaceDashesWithCommas(draft.subject),
          body: replaceDashesWithCommas(draft.body)
        });
      }
    }
  };
}
