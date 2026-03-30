import { z } from "zod";

import type { AiGatewayResult, AiTaskKey } from "@/lib/ai/gateway";
import { runOpenRouterTask } from "@/lib/ai/gateway";

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    const match = value.match(/\{[\s\S]*\}$/);
    if (!match) {
      throw new Error("Model did not return valid JSON.");
    }

    return JSON.parse(match[0]) as unknown;
  }
}

type StructuredTaskInput<TSchema extends z.ZodTypeAny> = {
  context: {
    userId?: string | null;
    billingAccountId?: string | null;
    taskKey: AiTaskKey;
    featureKey: string;
    metadata?: Record<string, unknown>;
  };
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  schema: TSchema;
  fallback: z.infer<TSchema>;
  cache?: {
    enabled: boolean;
    userId?: string | null;
    scopeKey: string;
    inputHash: string;
    ttlSeconds: number;
    promptVersion: string;
    routeVersion: string;
  } | null;
};

export async function runStructuredOpenRouterTask<TSchema extends z.ZodTypeAny>(
  input: StructuredTaskInput<TSchema>
): Promise<AiGatewayResult<z.infer<TSchema>> | null> {
  return runOpenRouterTask<z.infer<TSchema>>({
    context: input.context,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    temperature: input.temperature,
    responseFormat: { type: "json_object" },
    cache: input.cache,
    parse: (content) => {
      try {
        const candidate = safeParseJson(content);
        const parsed = input.schema.safeParse(candidate);
        return parsed.success ? parsed.data : input.fallback;
      } catch {
        return input.fallback;
      }
    },
    serialize: (value) => value
  });
}
