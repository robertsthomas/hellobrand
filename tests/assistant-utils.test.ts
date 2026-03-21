import { describe, expect, test } from "vitest";

import {
  assistantPageTitle,
  buildAssistantHref,
  isValidAssistantTab
} from "@/lib/assistant/app-manual";
import { assistantMessageText, assistantRecordToUIMessage } from "@/lib/assistant/messages";

describe("assistant app manual helpers", () => {
  test("builds valid partnership tab hrefs", () => {
    expect(buildAssistantHref("deal-tab:risks", { dealId: "deal-123" })).toBe(
      "/app/deals/deal-123?tab=risks"
    );
  });

  test("rejects invalid partnership tabs", () => {
    expect(buildAssistantHref("deal-tab:not-real", { dealId: "deal-123" })).toBeNull();
    expect(isValidAssistantTab("not-real")).toBe(false);
  });

  test("maps route titles from the app shell", () => {
    expect(assistantPageTitle("/app/payments")).toBe("Payments");
    expect(assistantPageTitle("/app/deals/demo-deal")).toBe("Partnership workspace");
  });
});

describe("assistant message helpers", () => {
  test("extracts text from ai sdk message parts", () => {
    expect(
      assistantMessageText([
        { type: "text", text: "Hello" },
        { type: "text", text: "world" },
        { type: "tool-draftReply", state: "output-available", output: { subject: "x" } }
      ])
    ).toBe("Hello\nworld");
  });

  test("returns empty text for unknown parts", () => {
    expect(assistantMessageText([{ type: "tool-searchDeals" }])).toBe("");
  });

  test("preserves tool parts when restoring a saved assistant message", () => {
    const message = assistantRecordToUIMessage({
      id: "assistant-1",
      threadId: "thread-1",
      role: "assistant",
      content: "",
      parts: [
        {
          type: "tool-listWorkspaces",
          toolCallId: "tool-1",
          state: "output-available",
          input: { reason: "Pick a workspace" },
          output: {
            type: "workspace-list",
            title: "Choose a workspace",
            description: "Pick the right workspace.",
            prompt: "Draft a reply",
            workspaces: []
          }
        }
      ],
      createdAt: "2026-03-18T12:00:00.000Z",
      updatedAt: "2026-03-18T12:00:00.000Z"
    });

    expect(message.parts).toEqual([
      {
        type: "tool-listWorkspaces",
        toolCallId: "tool-1",
        state: "output-available",
        input: { reason: "Pick a workspace" },
        output: {
          type: "workspace-list",
          title: "Choose a workspace",
          description: "Pick the right workspace.",
          prompt: "Draft a reply",
          workspaces: []
        }
      }
    ]);
  });
});
