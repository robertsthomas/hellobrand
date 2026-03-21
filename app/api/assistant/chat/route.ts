import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireApiViewer } from "@/lib/auth";
import { assistantMessageText } from "@/lib/assistant/messages";
import { streamAssistantResponse } from "@/lib/assistant/runtime";
import { replaceDashesWithCommas } from "@/lib/assistant/text";
import {
  assertViewerHasFeature,
  assertViewerWithinUsageLimit,
  recordViewerUsage
} from "@/lib/billing/entitlements";
import { getRepository } from "@/lib/repository";
import { assistantChatRequestSchema } from "@/lib/validation";
import { fail } from "@/lib/http";

function lastUserMessage(messages: UIMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user") ?? null;
}

function fallbackAssistantStream(
  message: string,
  options?: { originalMessages?: UIMessage[] }
) {
  const normalizedMessage = replaceDashesWithCommas(message);

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: options?.originalMessages,
      execute: ({ writer }) => {
        const textId = crypto.randomUUID();
        writer.write({ type: "start" });
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: normalizedMessage });
        writer.write({ type: "text-end", id: textId });
        writer.write({ type: "finish", finishReason: "error" });
      }
    })
  });
}

function formatAssistantError(error: unknown) {
  if (error instanceof ZodError) {
    return "I ran into a request validation issue before I could answer. Please try again.";
  }

  return error instanceof Error ? error.message : "Could not stream assistant response.";
}

export async function POST(request: NextRequest) {
  let rawBody: unknown = null;

  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "assistant_chat");
    await assertViewerWithinUsageLimit(viewer, "assistant_messages_monthly");
    rawBody = await request.json();
    const input = assistantChatRequestSchema.parse(rawBody);
    const repository = getRepository();
    const thread = await repository.getAssistantThread(viewer.id, input.threadId);

    if (!thread) {
      return fail("Assistant thread not found.", 404);
    }

    const incomingMessages = input.messages as UIMessage[];
    const incomingUserMessage = lastUserMessage(incomingMessages);

    if (!incomingUserMessage) {
      return fail("No user message provided.", 400);
    }

    const persistedMessages = await repository.listAssistantMessages(viewer.id, thread.id);
    const alreadySaved = persistedMessages.some((message) => message.id === incomingUserMessage.id);

    if (!alreadySaved) {
      const content = assistantMessageText(incomingUserMessage.parts);
      await repository.saveAssistantMessage(viewer.id, thread.id, {
        id: incomingUserMessage.id,
        role: "user",
        content,
        parts: incomingUserMessage.parts
      });
    }

    const nextMessages = await repository.listAssistantMessages(viewer.id, thread.id);

    try {
      const response = await streamAssistantResponse({
        viewer,
        thread,
        persistedMessages: nextMessages,
        context: input.context,
        scope: input.scope
      });
      await recordViewerUsage(viewer, "assistant_messages_monthly");
      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not stream assistant response.";

      return fallbackAssistantStream(
        `I ran into a backend issue before I could answer: ${message}`,
        {
          originalMessages: input.messages as UIMessage[]
        }
      );
    }
  } catch (error) {
    const message = formatAssistantError(error);
    const originalMessages =
      rawBody &&
      typeof rawBody === "object" &&
      Array.isArray((rawBody as Record<string, unknown>).messages)
        ? ((rawBody as Record<string, unknown>).messages as UIMessage[])
        : undefined;

    if (message === "Unauthorized") {
      return fail(message, 401);
    }

    return fallbackAssistantStream(message, { originalMessages });
  }
}
