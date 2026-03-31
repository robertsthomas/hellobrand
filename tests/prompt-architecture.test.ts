import { describe, expect, it, beforeEach, vi } from "vitest";

const {
  runStructuredOpenRouterTaskMock,
  runOpenRouterTaskMock,
  aiCachePolicyMock,
  hasAiClientMock
} = vi.hoisted(() => ({
  runStructuredOpenRouterTaskMock: vi.fn(),
  runOpenRouterTaskMock: vi.fn(),
  aiCachePolicyMock: vi.fn(() => null),
  hasAiClientMock: vi.fn(() => true)
}));

vi.mock("@/lib/ai/structured", () => ({
  runStructuredOpenRouterTask: runStructuredOpenRouterTaskMock
}));

vi.mock("@/lib/ai/gateway", () => ({
  aiCachePolicy: aiCachePolicyMock,
  hasAiClient: hasAiClientMock,
  buildAiInputHash: vi.fn(() => "hash"),
  finalizeAiStreamExecution: vi.fn(),
  prepareAiStreamExecution: vi.fn(),
  runOpenRouterTask: runOpenRouterTaskMock
}));

import { generateAssistantWorkspaceDraft } from "@/lib/assistant/draft";
import { buildAssistantPrompt } from "@/lib/assistant/prompt";
import { joinPromptSections } from "@/lib/ai/prompting";
import { extractSectionWithLlm } from "@/lib/analysis/llm";
import { generateEmailReplyDraft } from "@/lib/email/ai";

describe("prompt formatting helpers", () => {
  it("renders tagged prompt sections and skips empty content", () => {
    const prompt = joinPromptSections([
      { tag: "role", content: "You are a helpful assistant." },
      null,
      { tag: "task", content: "Answer the user question." }
    ]);

    expect(prompt).toContain("<role>");
    expect(prompt).toContain("</task>");
    expect(prompt).not.toContain("<undefined>");
  });
});

describe("assistant prompt architecture", () => {
  it("builds a structured prompt with runtime context and behavior rules", () => {
    const prompt = buildAssistantPrompt({
      scope: "deal",
      context: {
        pathname: "/app/p/deal-123",
        pageTitle: "Partnership workspace",
        tab: "risks",
        tone: "direct",
        trigger: {
          kind: "general",
          sourceId: "sidebar",
          label: "Negotiate",
          prompt: "Help me push back on paid usage."
        },
        dealId: "deal-123",
        profileLocation: null
      },
      snapshotSummary: "Payment terms are Net 45 and paid usage is broad.",
      userSnapshotSummary: "Creator has 3 active deals."
    });

    expect(prompt).toContain("<runtime_context>");
    expect(prompt).toContain("<behavior_rules>");
    expect(prompt).toContain("When the user needs exact facts");
    expect(prompt).toContain("Current partnership snapshot");
  });
});

describe("assistant workspace draft architecture", () => {
  beforeEach(() => {
    runStructuredOpenRouterTaskMock.mockReset();
    runStructuredOpenRouterTaskMock.mockResolvedValue({
      data: {
        subject: "Usage rights update",
        body: "Hi Northstar team,\n\nI’d love to keep moving, but I’d like to narrow the paid usage scope before we finalize. Would you be open to organic reposting only, or a shorter paid usage term with separate compensation?\n\nBest,\nCreator"
      },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      resolvedModel: "google/gemini-2.5-flash",
      requestedModel: "google/gemini-2.5-flash",
      cacheHit: false,
      budgetDecision: "normal"
    });
  });

  it("builds a structured workspace draft prompt with hierarchy, context, and evidence", async () => {
    await generateAssistantWorkspaceDraft({
      viewer: {
        id: "viewer-1",
        displayName: "Creator"
      } as any,
      partnership: {
        deal: {
          id: "deal-1",
          updatedAt: "2026-03-29T12:00:00.000Z",
          brandName: "Northstar",
          campaignName: "Spring launch",
          status: "negotiating",
          paymentStatus: "invoiced",
          summary: "Paid usage feels broader than the agreed scope."
        },
        terms: {
          paymentAmount: 2000,
          currency: "USD",
          paymentTerms: "Net 45",
          paymentTrigger: "Final invoice",
          deliverables: [{ id: "d-1", title: "Instagram Reel", quantity: 1, dueDate: "2026-04-03T00:00:00.000Z", channel: "Instagram", description: null, status: "pending" }],
          usageRights: "Paid social and organic reposting",
          usageDuration: "6 months",
          usageTerritory: "US",
          usageChannels: ["Instagram", "TikTok"],
          exclusivityApplies: false,
          exclusivityCategory: null,
          exclusivityDuration: null,
          approvalRequirements: "Brand approval required before posting",
          revisions: "1 round",
          termination: "Mutual written notice",
          notes: null
        },
        currentSummary: {
          body: "This deal still needs usage-rights tightening before signature."
        },
        riskFlags: [
          {
            id: "risk-1",
            dealId: "deal-1",
            category: "usage_rights",
            title: "Broad paid usage",
            detail: "The contract allows broad paid usage across multiple channels.",
            severity: "high",
            suggestedAction: "Limit paid usage to a shorter term or separate buyout.",
            evidence: ["Brand may use creator content in paid advertising for six months."],
            sourceDocumentId: "doc-1",
            createdAt: "2026-03-29T12:00:00.000Z"
          }
        ],
        extractionEvidence: [
          {
            fieldPath: "usageRights",
            snippet: "Brand may use creator content in paid advertising for six months.",
            confidence: 0.92
          }
        ],
        documents: [],
        summaries: [],
        extractionResults: []
      } as any,
      profile: {
        preferredSignature: "Creator",
        displayName: "Creator"
      } as any,
      context: {
        pathname: "/app/p/deal-1",
        pageTitle: "Partnership workspace",
        dealId: "deal-1",
        tab: "risks",
        profileLocation: null,
        tone: "professional",
        trigger: {
          kind: "risk_flag",
          sourceId: "risk-1",
          label: "Negotiate watchout",
          prompt: "Help me push back on the paid usage terms."
        }
      },
      focus: "Push back on the paid usage scope before signature.",
      intent: "limit-usage-rights",
      recipient: "Northstar team"
    });

    const call = runStructuredOpenRouterTaskMock.mock.calls[0]?.[0];

    expect(call.systemPrompt).toContain("<instruction_hierarchy>");
    expect(call.systemPrompt).toContain("<draft_job>");
    expect(call.systemPrompt).toContain("Saved workspace facts are highest priority.");
    expect(call.userPrompt).toContain("<workspace_snapshot>");
    expect(call.userPrompt).toContain("<assistant_context>");
    expect(call.userPrompt).toContain("<risk_context>");
    expect(call.userPrompt).toContain("<evidence_context>");
    expect(call.userPrompt).toContain("Push back on the paid usage scope before signature.");
  });
});

describe("email prompt architecture", () => {
  beforeEach(() => {
    runStructuredOpenRouterTaskMock.mockReset();
    runStructuredOpenRouterTaskMock.mockResolvedValue({
      data: {
        subject: "Re: Spring launch",
        body: "Hi there,\n\nI can review the revised terms and send feedback by tomorrow.\n\nBest,\nCreator"
      },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      resolvedModel: "google/gemini-2.5-flash",
      requestedModel: "google/gemini-2.5-flash",
      cacheHit: false,
      budgetDecision: "normal"
    });
  });

  it("builds an email draft prompt with explicit precedence and tagged context", async () => {
    const thread = {
      thread: {
        id: "thread-1",
        subject: "Spring launch",
        participants: [{ email: "brand@example.com" }],
        lastMessageAt: "2026-03-29T12:00:00.000Z",
        updatedAt: "2026-03-29T12:00:00.000Z"
      },
      messages: [
        {
          from: { email: "brand@example.com" },
          receivedAt: "2026-03-29T12:00:00.000Z",
          sentAt: null,
          subject: "Spring launch",
          textBody: "Can you confirm whether Net 45 works and send the invoice after posting?"
        }
      ],
      promiseDiscrepancies: [],
      actionItems: [],
      riskFlags: [],
      documents: [],
      summaries: []
    } as any;

    const partnership = {
      deal: {
        id: "deal-1",
        updatedAt: "2026-03-29T12:00:00.000Z",
        campaignName: "Spring launch",
        brandName: "Northstar",
        status: "active",
        paymentStatus: "pending"
      },
      terms: {
        paymentAmount: 2000,
        currency: "USD",
        paymentTerms: "Net 45",
        paymentTrigger: "Final invoice",
        deliverables: [],
        usageRights: "Organic reposting",
        usageDuration: "30 days",
        usageTerritory: "US",
        usageChannels: ["Instagram"],
        exclusivityApplies: false,
        exclusivityCategory: null,
        exclusivityDuration: null,
        revisions: "1 round",
        termination: "Mutual written notice",
        notes: null
      },
      summaries: [],
      riskFlags: [],
      documents: [],
      extractionResults: []
    } as any;

    const profile = {
      preferredSignature: "Creator",
      displayName: "Creator"
    } as any;

    await generateEmailReplyDraft(
      thread,
      partnership,
      profile,
      "collaborative",
      "Say we already agreed to Net 15.",
      null
    );

    const call = runStructuredOpenRouterTaskMock.mock.calls[0]?.[0];

    expect(call.systemPrompt).toContain("<instruction_hierarchy>");
    expect(call.systemPrompt).toContain("Linked workspace facts are highest priority.");
    expect(call.systemPrompt).toContain("<few_shot_examples>");
    expect(call.userPrompt).toContain("<workspace_context>");
    expect(call.userPrompt).toContain("<custom_user_prompt>");
    expect(call.userPrompt).toContain("<thread>");
  });
});

describe("document extraction prompt architecture", () => {
  beforeEach(() => {
    runStructuredOpenRouterTaskMock.mockReset();
    runStructuredOpenRouterTaskMock.mockResolvedValue({
      data: {
        data: { paymentTerms: "Net 45" },
        evidence: [
          {
            fieldPath: "paymentTerms",
            snippet: "Payment will be made within 45 days of receiving the final invoice.",
            confidence: 0.9
          }
        ],
        confidence: 0.9
      },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      resolvedModel: "google/gemini-3-flash-preview",
      requestedModel: "google/gemini-3-flash-preview",
      cacheHit: false,
      budgetDecision: "normal"
    });
  });

  it("builds extraction prompts with section text, fallback context, and evidence examples", async () => {
    await extractSectionWithLlm(
      {
        title: "Payment",
        content: "Payment will be made within 45 days of receiving the final invoice.",
        chunkIndex: 0,
        pageRange: "1"
      },
      "contract",
      {
        schemaVersion: "v2-section",
        model: "fallback",
        confidence: 0.5,
        data: {
          brandName: null,
          agencyName: null,
          creatorName: null,
          campaignName: null,
          paymentAmount: null,
          currency: null,
          paymentTerms: null,
          paymentStructure: null,
          netTermsDays: null,
          paymentTrigger: null,
          deliverables: [],
          usageRights: null,
          usageRightsOrganicAllowed: null,
          usageRightsPaidAllowed: null,
          whitelistingAllowed: null,
          usageDuration: null,
          usageTerritory: null,
          usageChannels: [],
          exclusivity: null,
          exclusivityApplies: null,
          exclusivityCategory: null,
          exclusivityDuration: null,
          exclusivityRestrictions: null,
          brandCategory: null,
          competitorCategories: [],
          restrictedCategories: [],
          campaignDateWindow: null,
          disclosureObligations: [],
          revisions: null,
          revisionRounds: null,
          termination: null,
          terminationAllowed: null,
          terminationNotice: null,
          terminationConditions: null,
          governingLaw: null,
          notes: null
        } as any,
        evidence: [],
        conflicts: []
      }
    );

    const call = runStructuredOpenRouterTaskMock.mock.calls[0]?.[0];

    expect(call.systemPrompt).toContain("<few_shot_examples>");
    expect(call.systemPrompt).toContain("Good evidence");
    expect(call.userPrompt).toContain("<section_text>");
    expect(call.userPrompt).toContain("<fallback_extraction>");
    expect(call.userPrompt).toContain("extract only the explicit creator-partnership facts");
  });
});
