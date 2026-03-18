import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import { assistantMessageText, assistantRecordsToUIMessages } from "@/lib/assistant/messages";
import { buildAssistantPrompt } from "@/lib/assistant/prompt";
import { assistantProvider } from "@/lib/assistant/provider";
import { ensureAssistantSnapshot } from "@/lib/assistant/snapshots";
import { buildAssistantTools } from "@/lib/assistant/tools";
import { replaceDashesWithCommas } from "@/lib/assistant/text";
import { getRepository } from "@/lib/repository";
import type {
  AssistantClientContext,
  AssistantMessageRecord,
  AssistantScope,
  AssistantThreadRecord,
  Viewer
} from "@/lib/types";

async function persistAssistantMessages(input: {
  viewerId: string;
  threadId: string;
  repository: ReturnType<typeof getRepository>;
  messages: UIMessage[];
}) {
  let latestSummary: string | null = null;

  for (const message of input.messages) {
    if (message.role !== "assistant") {
      continue;
    }

    const content = replaceDashesWithCommas(assistantMessageText(message.parts));
    await input.repository.saveAssistantMessage(input.viewerId, input.threadId, {
      id: message.id,
      role: "assistant",
      content,
      parts: message.parts
    });

    if (content.trim().length > 0) {
      latestSummary = content.slice(0, 280);
    }
  }

  if (latestSummary) {
    await input.repository.updateAssistantThread(input.viewerId, input.threadId, {
      summary: latestSummary
    });
  }
}

export async function streamAssistantResponse(input: {
  viewer: Viewer;
  thread: AssistantThreadRecord;
  persistedMessages: AssistantMessageRecord[];
  context: AssistantClientContext;
  scope: AssistantScope;
}) {
  const provider = assistantProvider();

  if (!provider) {
    throw new Error("No assistant model provider configured.");
  }

  const repository = getRepository();
  const userSnapshot = await ensureAssistantSnapshot(input.viewer, "user");
  const dealSnapshot =
    input.scope === "deal" && input.thread.dealId
      ? await ensureAssistantSnapshot(input.viewer, "deal", input.thread.dealId)
      : null;
  const uiMessages = assistantRecordsToUIMessages(input.persistedMessages);
  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: provider.chat("anthropic/claude-sonnet-4.6", {
      user: input.viewer.id,
      provider: {
        allow_fallbacks: true,
        data_collection: "deny",
        zdr: true
      },
      cache_control: {
        type: "ephemeral",
        ttl: "5m"
      }
    }),
    system: buildAssistantPrompt({
      scope: input.scope,
      context: input.context,
      snapshotSummary: dealSnapshot?.summary ?? null,
      userSnapshotSummary: userSnapshot?.summary ?? null
    }),
    messages: modelMessages,
    temperature: 0.2,
    stopWhen: stepCountIs(5),
    tools: buildAssistantTools({
      viewer: input.viewer,
      threadDealId: input.thread.dealId,
      persistedMessages: input.persistedMessages,
      context: input.context
    })
  });

  return result.toUIMessageStreamResponse({
    originalMessages: uiMessages,
    onFinish: async ({ messages }) => {
      await persistAssistantMessages({
        viewerId: input.viewer.id,
        threadId: input.thread.id,
        repository,
        messages
      });
    }
  });
}
