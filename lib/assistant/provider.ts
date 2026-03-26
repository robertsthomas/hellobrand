import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function assistantProvider(fallbacks: string[] = []) {
  if (!process.env.OPENROUTER_API_KEY) {
    return null;
  }

  return createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    compatibility: "strict",
    headers: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ||
        process.env.INTEGRATIONS_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3011",
      "X-Title": process.env.OPENROUTER_APP_NAME || "HelloBrand"
    },
    ...(fallbacks.length > 0
      ? {
          extraBody: {
            models: fallbacks
          }
        }
      : {})
  });
}
