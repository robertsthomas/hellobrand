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
  const buildRequest = (sysPrompt: string) =>
    runOpenRouterTask<z.infer<TSchema>>({
      context: input.context,
      systemPrompt: sysPrompt,
      userPrompt: input.userPrompt,
      temperature: input.temperature,
      responseFormat: { type: "json_object" },
      cache: input.cache,
      parse: (content) => {
        try {
          const candidate = safeParseJson(content);
          const parsed = input.schema.safeParse(candidate);
          if (!parsed.success) {
            console.warn("[structured] Zod parse failed", {
              task: input.context.taskKey,
              feature: input.context.featureKey,
              errors: parsed.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`
              ),
              rawPreview: JSON.stringify(candidate).slice(0, 300),
            });
            return { value: input.fallback, parseFailed: true };
          }
          return { value: parsed.data, parseFailed: false };
        } catch (error) {
          console.warn("[structured] JSON parse failed", {
            task: input.context.taskKey,
            feature: input.context.featureKey,
            error: error instanceof Error ? error.message : "Unknown JSON error",
          });
          return { value: input.fallback, parseFailed: true };
        }
      },
      serialize: (wrapped) => (wrapped as { value: z.infer<TSchema> }).value,
    });

  const firstResult = await buildRequest(input.systemPrompt);

  if (!firstResult) {
    return null;
  }

  const wrappedData = firstResult.data as unknown as {
    value: z.infer<TSchema>;
    parseFailed: boolean;
  };
  if (!wrappedData?.parseFailed) {
    return {
      ...firstResult,
      data: wrappedData.value,
    } as AiGatewayResult<z.infer<TSchema>>;
  }

  console.info("[structured] Retrying with schema reminder", {
    task: input.context.taskKey,
    feature: input.context.featureKey,
  });

  const schemaReminder = [
    "",
    "<schema_reminder>",
    "Your previous response could not be parsed. Return valid JSON matching this exact schema:",
    JSON.stringify(
      Object.keys(
        (input.schema as unknown as z.ZodObject<Record<string, z.ZodTypeAny>>).shape ?? {}
      )
    ),
    "All string fields must be strings, all numeric fields must be numbers, all arrays must be arrays.",
    "Do not include comments, trailing commas, or non-JSON text.",
    "</schema_reminder>",
  ].join("\n");

  const retryResult = await buildRequest(input.systemPrompt + schemaReminder);

  if (!retryResult) {
    return {
      ...firstResult,
      data: wrappedData.value,
    } as AiGatewayResult<z.infer<TSchema>>;
  }

  const retryWrapped = retryResult.data as unknown as {
    value: z.infer<TSchema>;
    parseFailed: boolean;
  };
  return {
    ...retryResult,
    data: retryWrapped?.parseFailed ? wrappedData.value : retryWrapped.value,
  } as AiGatewayResult<z.infer<TSchema>>;
}
