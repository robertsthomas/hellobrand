import { createHash, randomUUID } from "node:crypto";

import OpenAI from "openai";

import { prisma } from "@/lib/prisma";

export type AiTaskKey =
  | "assistant_chat"
  | "extract_section"
  | "analyze_risks"
  | "generate_summary"
  | "generate_brief"
  | "email_summary"
  | "email_draft"
  | "email_suggestions"
  | "email_action_items";

export type AiRouteClass = "quality" | "speed" | "balanced";
export type AiBudgetDecision = "normal" | "degraded" | "blocked";

export type AiRoutePolicy = {
  taskKey: AiTaskKey;
  featureKey: string;
  routeClass: AiRouteClass;
  primary: string;
  fallbacks: string[];
  maxTokens: number;
  cacheTtlSeconds: number | null;
  cachePromptVersion: string;
  routeVersion: string;
  throttle: boolean;
};

export type AiGatewayResult<T> = {
  data: T;
  usage: AiUsageMetrics;
  resolvedModel: string;
  requestedModel: string;
  cacheHit: boolean;
  budgetDecision: AiBudgetDecision;
};

export type AiUsageMetrics = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type AiCachePolicy = {
  enabled: boolean;
  userId?: string | null;
  scopeKey: string;
  inputHash: string;
  ttlSeconds: number;
  promptVersion: string;
  routeVersion: string;
};

type AiExecutionContext = {
  userId?: string | null;
  billingAccountId?: string | null;
  taskKey: AiTaskKey;
  featureKey: string;
  metadata?: Record<string, unknown>;
};

type AiPreparedExecution = {
  taskKey: AiTaskKey;
  featureKey: string;
  routeClass: AiRouteClass;
  requestedModel: string;
  fallbacks: string[];
  maxTokens: number;
  budgetDecision: AiBudgetDecision;
  cachePromptVersion: string;
  routeVersion: string;
};

type AiUsageEventInput = AiExecutionContext & {
  requestedModel: string;
  resolvedModel: string;
  status: string;
  cacheStatus: string;
  usage: AiUsageMetrics;
  inputHash: string;
  requestKey: string;
};

type RunOpenRouterTaskInput<T> = {
  context: AiExecutionContext;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  responseFormat?: { type: "json_object" };
  cache?: AiCachePolicy | null;
  parse: (content: string) => T;
  serialize: (value: T) => unknown;
};

type Pricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const OPENROUTER_PROVIDER = "openrouter";
const APPROVED_PRODUCTION_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
  "openai/gpt-5.4-mini"
]);

const MODEL_PRICING: Record<string, Pricing> = {
  "google/gemini-3-flash-preview": {
    inputUsdPerMillion: 0.5,
    outputUsdPerMillion: 3
  },
  "google/gemini-2.5-flash": {
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6
  },
  "openai/gpt-5-mini": {
    inputUsdPerMillion: 0.25,
    outputUsdPerMillion: 2
  },
  "openai/gpt-5.4-mini": {
    inputUsdPerMillion: 0.75,
    outputUsdPerMillion: 4.5
  }
};

const TASK_POLICIES: Record<AiTaskKey, AiRoutePolicy> = {
  assistant_chat: {
    taskKey: "assistant_chat",
    featureKey: "assistant_chat",
    routeClass: "balanced",
    primary: "google/gemini-2.5-flash",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: null,
    cachePromptVersion: "assistant.v2",
    routeVersion: "assistant.route.v1",
    throttle: true
  },
  extract_section: {
    taskKey: "extract_section",
    featureKey: "document_analysis",
    routeClass: "speed",
    primary: "google/gemini-3-flash-preview",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    cachePromptVersion: "extract.v2",
    routeVersion: "extract.route.v2",
    throttle: true
  },
  analyze_risks: {
    taskKey: "analyze_risks",
    featureKey: "document_analysis",
    routeClass: "speed",
    primary: "google/gemini-3-flash-preview",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    cachePromptVersion: "risks.v2",
    routeVersion: "risks.route.v2",
    throttle: true
  },
  generate_summary: {
    taskKey: "generate_summary",
    featureKey: "document_analysis",
    routeClass: "speed",
    primary: "google/gemini-3-flash-preview",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    cachePromptVersion: "summary.v2",
    routeVersion: "summary.route.v2",
    throttle: true
  },
  generate_brief: {
    taskKey: "generate_brief",
    featureKey: "brief_generation",
    routeClass: "speed",
    primary: "google/gemini-3-flash-preview",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    cachePromptVersion: "brief.v2",
    routeVersion: "brief.route.v2",
    throttle: true
  },
  email_summary: {
    taskKey: "email_summary",
    featureKey: "premium_inbox",
    routeClass: "speed",
    primary: "google/gemini-2.5-flash",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24 * 7,
    cachePromptVersion: "email.summary.v2",
    routeVersion: "email.summary.route.v1",
    throttle: true
  },
  email_draft: {
    taskKey: "email_draft",
    featureKey: "premium_inbox",
    routeClass: "speed",
    primary: "google/gemini-2.5-flash",
    fallbacks: ["openai/gpt-5.4-mini", "google/gemini-3-flash-preview"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24,
    cachePromptVersion: "email.draft.v2",
    routeVersion: "email.draft.route.v3",
    throttle: true
  },
  email_suggestions: {
    taskKey: "email_suggestions",
    featureKey: "premium_inbox",
    routeClass: "speed",
    primary: "google/gemini-2.5-flash",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24 * 7,
    cachePromptVersion: "email.suggestions.v2",
    routeVersion: "email.suggestions.route.v1",
    throttle: true
  },
  email_action_items: {
    taskKey: "email_action_items",
    featureKey: "premium_inbox",
    routeClass: "speed",
    primary: "google/gemini-2.5-flash",
    fallbacks: ["openai/gpt-5-mini"],
    maxTokens: 4096,
    cacheTtlSeconds: 60 * 60 * 24 * 7,
    cachePromptVersion: "email.action-items.v2",
    routeVersion: "email.action-items.route.v1",
    throttle: true
  }
};

function providerConfig() {
  if (!process.env.OPENROUTER_API_KEY) {
    return null;
  }

  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ||
        process.env.INTEGRATIONS_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3011",
      "X-Title": process.env.OPENROUTER_APP_NAME || "HelloBrand"
    }
  };
}

function client() {
  const config = providerConfig();
  if (!config) {
    return null;
  }

  return new OpenAI(config);
}

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function currentMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function currentDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getBudgets() {
  return {
    premiumSoftCapUsd: parsePositiveNumber(process.env.AI_PREMIUM_SOFT_CAP_USD, 20),
    premiumHardCapUsd: parsePositiveNumber(process.env.AI_PREMIUM_HARD_CAP_USD, 30),
    globalMonthlyCapUsd: parsePositiveNumber(process.env.AI_GLOBAL_MONTHLY_CAP_USD, 500),
    globalDailyCapUsd: parsePositiveNumber(process.env.AI_GLOBAL_DAILY_CAP_USD, 50),
    rpmPremium: parsePositiveNumber(process.env.AI_RPM_PREMIUM, 15),
    tpm10mPremium: parsePositiveNumber(process.env.AI_TPM_10M_PREMIUM, 20000)
  };
}

function parseModelList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function approvedModel(model: string | null | undefined) {
  if (!model) {
    return null;
  }

  if (model.includes("anthropic/")) {
    return null;
  }

  if (process.env.NODE_ENV === "production" && !APPROVED_PRODUCTION_MODELS.has(model)) {
    return null;
  }

  return model;
}

function uniqueModels(models: Array<string | null | undefined>) {
  const next: string[] = [];

  for (const model of models) {
    const safeModel = approvedModel(model);
    if (safeModel && !next.includes(safeModel)) {
      next.push(safeModel);
    }
  }

  return next;
}

function taskEnvPrimary(taskKey: AiTaskKey) {
  switch (taskKey) {
    case "extract_section":
      return process.env.LLM_MODEL_EXTRACT || process.env.OPENROUTER_MODEL_EXTRACT || process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || null;
    case "analyze_risks":
      return process.env.LLM_MODEL_RISKS || process.env.OPENROUTER_MODEL_RISKS || process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || null;
    case "generate_summary":
      return process.env.LLM_MODEL_SUMMARY || process.env.OPENROUTER_MODEL_SUMMARY || process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || null;
    case "generate_brief":
      return process.env.LLM_MODEL_BRIEF || process.env.OPENROUTER_MODEL_BRIEF || process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || null;
    case "email_summary":
      return process.env.OPENROUTER_MODEL_EMAIL_SUMMARY || process.env.LLM_MODEL_SUMMARY || process.env.OPENROUTER_MODEL_SUMMARY || process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || null;
    case "email_draft":
      return process.env.LLM_MODEL_EMAIL_DRAFT || process.env.OPENROUTER_MODEL_EMAIL_DRAFT || null;
    default:
      return process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || null;
  }
}

function taskEnvFallbacks(taskKey: AiTaskKey) {
  switch (taskKey) {
    case "extract_section":
      return uniqueModels([
        ...parseModelList(process.env.LLM_MODEL_EXTRACT_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_EXTRACT_FALLBACKS),
        ...parseModelList(process.env.LLM_MODEL_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS)
      ]);
    case "analyze_risks":
      return uniqueModels([
        ...parseModelList(process.env.LLM_MODEL_RISKS_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_RISKS_FALLBACKS),
        ...parseModelList(process.env.LLM_MODEL_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS)
      ]);
    case "generate_summary":
      return uniqueModels([
        ...parseModelList(process.env.LLM_MODEL_SUMMARY_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_SUMMARY_FALLBACKS),
        ...parseModelList(process.env.LLM_MODEL_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS)
      ]);
    case "generate_brief":
      return uniqueModels([
        ...parseModelList(process.env.LLM_MODEL_BRIEF_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_BRIEF_FALLBACKS),
        ...parseModelList(process.env.LLM_MODEL_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS)
      ]);
    case "email_draft":
      return uniqueModels([
        ...parseModelList(process.env.LLM_MODEL_EMAIL_DRAFT_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_EMAIL_DRAFT_FALLBACKS),
        ...parseModelList(process.env.LLM_MODEL_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS)
      ]);
    default:
      return uniqueModels([
        ...parseModelList(process.env.LLM_MODEL_FALLBACKS),
        ...parseModelList(process.env.OPENROUTER_MODEL_FALLBACKS)
      ]);
  }
}

function cheapestApprovedModel() {
  return "google/gemini-2.5-flash";
}

function routeVersion(taskKey: AiTaskKey, requestedModel: string, fallbacks: string[], decision: AiBudgetDecision) {
  return `${TASK_POLICIES[taskKey].routeVersion}:${decision}:${requestedModel}:${fallbacks.join(",") || "none"}`;
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function usageFromCompletion(response: OpenAI.Chat.Completions.ChatCompletion) {
  const usage = response.usage;
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0
  };
}

function extractTextContent(
  content: OpenAI.Chat.Completions.ChatCompletionMessage["content"] | null | undefined
) {
  if (typeof content === "string") {
    return content;
  }

  if (!content || !Array.isArray(content)) {
    return null;
  }

  const parts = content as Array<{ type?: string; text?: string }>;
  const text = parts
    .map((part) => {
      if (part && typeof part === "object" && "type" in part && part.type === "text") {
        return typeof part.text === "string" ? part.text : "";
      }

      return "";
    })
    .join("")
    .trim();

  return text || null;
}

function estimateCostUsd(model: string, usage: AiUsageMetrics) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return 0;
  }

  return (
    (usage.promptTokens / 1_000_000) * pricing.inputUsdPerMillion +
    (usage.completionTokens / 1_000_000) * pricing.outputUsdPerMillion
  );
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

async function aggregateCost(where: Record<string, unknown>) {
  if (!hasDatabase()) {
    return 0;
  }

  const result = await prisma.aiUsageEvent.aggregate({
    _sum: {
      estimatedCostUsd: true
    },
    where: where as never
  });

  return result._sum.estimatedCostUsd ?? 0;
}

async function evaluateAiExecution(context: AiExecutionContext): Promise<AiPreparedExecution> {
  const basePolicy = TASK_POLICIES[context.taskKey];
  const requestedModel = approvedModel(taskEnvPrimary(context.taskKey)) ?? basePolicy.primary;
  const fallbacks = uniqueModels([...taskEnvFallbacks(context.taskKey), ...basePolicy.fallbacks]).filter((model) => model !== requestedModel);
  const budgets = getBudgets();

  if (!hasDatabase()) {
    return {
      taskKey: context.taskKey,
      featureKey: context.featureKey,
      routeClass: basePolicy.routeClass,
      requestedModel,
      fallbacks,
      maxTokens: basePolicy.maxTokens,
      budgetDecision: "normal",
      cachePromptVersion: basePolicy.cachePromptVersion,
      routeVersion: routeVersion(context.taskKey, requestedModel, fallbacks, "normal")
    };
  }

  const now = new Date();
  const monthStart = currentMonthStart(now);
  const dayStart = currentDayStart(now);

  const [globalDailyCost, globalMonthlyCost, userMonthlyCost, recentRequestCount, recentTokenTotal] = await Promise.all([
    aggregateCost({
      createdAt: { gte: dayStart },
      cacheStatus: { not: "hit" }
    }),
    aggregateCost({
      createdAt: { gte: monthStart },
      cacheStatus: { not: "hit" }
    }),
    context.userId
      ? aggregateCost({
          userId: context.userId,
          createdAt: { gte: monthStart },
          cacheStatus: { not: "hit" }
        })
      : Promise.resolve(0),
    basePolicy.throttle && context.userId
      ? prisma.aiUsageEvent.count({
          where: {
            userId: context.userId,
            createdAt: {
              gte: new Date(now.getTime() - 60_000)
            },
            cacheStatus: { not: "hit" }
          }
        })
      : Promise.resolve(0),
    basePolicy.throttle && context.userId
      ? prisma.aiUsageEvent.aggregate({
          _sum: { totalTokens: true },
          where: {
            userId: context.userId,
            createdAt: {
              gte: new Date(now.getTime() - 10 * 60_000)
            },
            cacheStatus: { not: "hit" }
          }
        }).then((result) => result._sum.totalTokens ?? 0)
      : Promise.resolve(0)
  ]);

  if (
    globalDailyCost >= budgets.globalDailyCapUsd ||
    globalMonthlyCost >= budgets.globalMonthlyCapUsd ||
    recentRequestCount >= budgets.rpmPremium ||
    recentTokenTotal >= budgets.tpm10mPremium ||
    userMonthlyCost >= budgets.premiumHardCapUsd
  ) {
    return {
      taskKey: context.taskKey,
      featureKey: context.featureKey,
      routeClass: basePolicy.routeClass,
      requestedModel,
      fallbacks: [],
      maxTokens: Math.max(120, Math.floor(basePolicy.maxTokens * 0.7)),
      budgetDecision: "blocked",
      cachePromptVersion: basePolicy.cachePromptVersion,
      routeVersion: routeVersion(context.taskKey, requestedModel, [], "blocked")
    };
  }

  if (userMonthlyCost >= budgets.premiumSoftCapUsd) {
    const degradedModel = cheapestApprovedModel();
    return {
      taskKey: context.taskKey,
      featureKey: context.featureKey,
      routeClass: "speed",
      requestedModel: degradedModel,
      fallbacks: [],
      maxTokens: Math.max(120, Math.floor(basePolicy.maxTokens * 0.7)),
      budgetDecision: "degraded",
      cachePromptVersion: basePolicy.cachePromptVersion,
      routeVersion: routeVersion(context.taskKey, degradedModel, [], "degraded")
    };
  }

  return {
    taskKey: context.taskKey,
    featureKey: context.featureKey,
    routeClass: basePolicy.routeClass,
    requestedModel,
    fallbacks,
    maxTokens: basePolicy.maxTokens,
    budgetDecision: "normal",
    cachePromptVersion: basePolicy.cachePromptVersion,
    routeVersion: routeVersion(context.taskKey, requestedModel, fallbacks, "normal")
  };
}

async function getAiCacheEntry(cache: AiCachePolicy, taskKey: AiTaskKey, featureKey: string) {
  if (!hasDatabase() || !cache.enabled) {
    return null;
  }

  return prisma.aiCacheEntry.findUnique({
    where: {
      featureKey_taskKey_scopeKey_inputHash_promptVersion_routeVersion: {
        featureKey,
        taskKey,
        scopeKey: cache.scopeKey,
        inputHash: cache.inputHash,
        promptVersion: cache.promptVersion,
        routeVersion: cache.routeVersion
      }
    }
  });
}

async function upsertAiCacheEntry(input: {
  cache: AiCachePolicy;
  taskKey: AiTaskKey;
  featureKey: string;
  requestedModel: string;
  resolvedModel: string;
  payload: unknown;
  usage: AiUsageMetrics;
  estimatedCostUsd: number;
}) {
  if (!hasDatabase() || !input.cache.enabled) {
    return;
  }

  await prisma.aiCacheEntry.upsert({
    where: {
      featureKey_taskKey_scopeKey_inputHash_promptVersion_routeVersion: {
        featureKey: input.featureKey,
        taskKey: input.taskKey,
        scopeKey: input.cache.scopeKey,
        inputHash: input.cache.inputHash,
        promptVersion: input.cache.promptVersion,
        routeVersion: input.cache.routeVersion
      }
    },
    update: {
      userId: input.cache.userId ?? null,
      requestedModel: input.requestedModel,
      resolvedModel: input.resolvedModel,
      payloadJson: input.payload as never,
      usageJson: input.usage as never,
      estimatedCostUsd: input.estimatedCostUsd,
      expiresAt: new Date(Date.now() + input.cache.ttlSeconds * 1000)
    },
    create: {
      userId: input.cache.userId ?? null,
      featureKey: input.featureKey,
      taskKey: input.taskKey,
      scopeKey: input.cache.scopeKey,
      inputHash: input.cache.inputHash,
      promptVersion: input.cache.promptVersion,
      routeVersion: input.cache.routeVersion,
      requestedModel: input.requestedModel,
      resolvedModel: input.resolvedModel,
      payloadJson: input.payload as never,
      usageJson: input.usage as never,
      estimatedCostUsd: input.estimatedCostUsd,
      expiresAt: new Date(Date.now() + input.cache.ttlSeconds * 1000)
    }
  });
}

export async function recordAiUsageEvent(input: AiUsageEventInput) {
  if (!hasDatabase()) {
    return null;
  }

  return prisma.aiUsageEvent.create({
    data: {
      userId: input.userId ?? null,
      billingAccountId: input.billingAccountId ?? null,
      featureKey: input.featureKey,
      taskKey: input.taskKey,
      provider: OPENROUTER_PROVIDER,
      requestedModel: input.requestedModel,
      resolvedModel: input.resolvedModel,
      status: input.status,
      cacheStatus: input.cacheStatus,
      promptTokens: input.usage.promptTokens,
      completionTokens: input.usage.completionTokens,
      totalTokens: input.usage.totalTokens,
      estimatedCostUsd: estimateCostUsd(input.resolvedModel, input.usage),
      requestKey: input.requestKey,
      inputHash: input.inputHash,
      metadataJson: toJsonValue(input.metadata ?? {})
    }
  });
}

export async function prepareAiStreamExecution(context: AiExecutionContext) {
  return evaluateAiExecution(context);
}

export async function finalizeAiStreamExecution(input: {
  context: AiExecutionContext;
  prepared: AiPreparedExecution;
  usage: AiUsageMetrics;
  resolvedModel: string;
  inputHash: string;
  requestKey?: string;
}) {
  return recordAiUsageEvent({
    ...input.context,
    requestedModel: input.prepared.requestedModel,
    resolvedModel: input.resolvedModel,
    status: "success",
    cacheStatus: "miss",
    usage: input.usage,
    inputHash: input.inputHash,
    requestKey: input.requestKey ?? randomUUID()
  });
}

export function aiCachePolicy(input: {
  userId?: string | null;
  taskKey: AiTaskKey;
  scopeKey: string;
  input: unknown;
}) {
  const policy = TASK_POLICIES[input.taskKey];
  if (!policy.cacheTtlSeconds) {
    return null;
  }

  return {
    enabled: true,
    userId: input.userId ?? null,
    scopeKey: input.scopeKey,
    inputHash: hashValue(input.input),
    ttlSeconds: policy.cacheTtlSeconds,
    promptVersion: policy.cachePromptVersion,
    routeVersion: policy.routeVersion
  } satisfies AiCachePolicy;
}

export function buildAiInputHash(value: unknown) {
  return hashValue(value);
}

export function getAiTaskPolicy(taskKey: AiTaskKey) {
  return TASK_POLICIES[taskKey];
}

export function hasAiClient() {
  return Boolean(client());
}

export async function runOpenRouterTask<T>(input: RunOpenRouterTaskInput<T>): Promise<AiGatewayResult<T> | null> {
  const api = client();
  if (!api) {
    return null;
  }

  const prepared = await evaluateAiExecution(input.context);
  const requestPayload = {
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    taskKey: input.context.taskKey,
    routeVersion: prepared.routeVersion,
    promptVersion: prepared.cachePromptVersion,
    requestedModel: prepared.requestedModel
  };
  const inputHash = buildAiInputHash(requestPayload);

  if (input.cache?.enabled) {
    const cached = await getAiCacheEntry(
      {
        ...input.cache,
        promptVersion: prepared.cachePromptVersion,
        routeVersion: prepared.routeVersion
      },
      input.context.taskKey,
      input.context.featureKey
    );

    if (cached && cached.expiresAt > new Date()) {
      const usage = (cached.usageJson as AiUsageMetrics | null) ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
      await recordAiUsageEvent({
        ...input.context,
        requestedModel: cached.requestedModel,
        resolvedModel: cached.resolvedModel,
        status: "success",
        cacheStatus: "hit",
        usage,
        inputHash,
        requestKey: randomUUID()
      });

      return {
        data: cached.payloadJson as T,
        usage,
        resolvedModel: cached.resolvedModel,
        requestedModel: cached.requestedModel,
        cacheHit: true,
        budgetDecision: prepared.budgetDecision
      };
    }
  }

  if (prepared.budgetDecision === "blocked") {
    // If the primary model is budget-blocked but fallbacks exist in the policy,
    // try the cheapest fallback at reduced tokens before giving up entirely.
    const basePolicy = TASK_POLICIES[input.context.taskKey];
    const cheapFallback = basePolicy.fallbacks[basePolicy.fallbacks.length - 1];

    if (!cheapFallback || cheapFallback === prepared.requestedModel) {
      return null;
    }

    console.warn("[ai-gateway] Budget blocked for", prepared.requestedModel, ", attempting fallback:", cheapFallback);

    try {
      const fallbackResponse = await api.chat.completions.create({
        model: cheapFallback,
        temperature: input.temperature,
        max_completion_tokens: prepared.maxTokens,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ],
        ...(input.responseFormat ? { response_format: input.responseFormat } : {})
      } as never);

      const fallbackContent = extractTextContent(fallbackResponse.choices?.[0]?.message?.content);
      if (fallbackContent) {
        const usage = usageFromCompletion(fallbackResponse);
        const resolvedModel = fallbackResponse.model ?? cheapFallback;
        const data = input.parse(fallbackContent);

        await recordAiUsageEvent({
          ...input.context,
          requestedModel: cheapFallback,
          resolvedModel,
          status: "success",
          cacheStatus: "miss",
          usage,
          inputHash,
          requestKey: randomUUID()
        });

        return {
          data,
          usage,
          resolvedModel,
          requestedModel: cheapFallback,
          cacheHit: false,
          budgetDecision: "blocked"
        };
      }
    } catch {
      // Fallback also failed, return null
    }

    return null;
  }

  const response = await api.chat.completions.create({
    model: prepared.requestedModel,
    temperature: input.temperature,
    max_completion_tokens: prepared.maxTokens,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt }
    ],
    ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
    ...(prepared.fallbacks.length > 0
      ? {
          extra_body: {
            models: prepared.fallbacks
          }
        }
      : {})
  } as never);

  let content = extractTextContent(response.choices?.[0]?.message?.content);
  const finishReason = response.choices?.[0]?.finish_reason;

  if (!content) {
    // If the model hit the token limit, retry with 50% more tokens.
    // If it failed for any other reason, retry once with the same params.
    const hitTokenLimit = finishReason === "length" || (finishReason as string) === "max_output_tokens";
    const retryTokens = hitTokenLimit
      ? Math.floor(prepared.maxTokens * 1.5)
      : prepared.maxTokens;

    console.error("[ai-gateway] Empty response from model:", prepared.requestedModel, "finish_reason:", finishReason, hitTokenLimit ? `(bumping tokens from ${prepared.maxTokens} to ${retryTokens})` : "(retrying with same params)");

    const retry = await api.chat.completions.create({
      model: prepared.requestedModel,
      temperature: input.temperature,
      max_completion_tokens: retryTokens,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt }
      ],
      ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      ...(prepared.fallbacks.length > 0
        ? { extra_body: { models: prepared.fallbacks } }
        : {})
    } as never);
    content = extractTextContent(retry.choices?.[0]?.message?.content);
    if (!content) {
      console.error("[ai-gateway] Retry also returned empty response:", prepared.requestedModel, "finish_reason:", retry.choices?.[0]?.finish_reason);
      return null;
    }
  }

  const usage = usageFromCompletion(response);
  const resolvedModel = response.model ?? prepared.requestedModel;
  const data = input.parse(content);
  const estimatedCostUsd = estimateCostUsd(resolvedModel, usage);
  const requestKey = randomUUID();

  await recordAiUsageEvent({
    ...input.context,
    requestedModel: prepared.requestedModel,
    resolvedModel,
    status: "success",
    cacheStatus: "miss",
    usage,
    inputHash,
    requestKey
  });

  if (input.cache?.enabled) {
    await upsertAiCacheEntry({
      cache: {
        ...input.cache,
        promptVersion: prepared.cachePromptVersion,
        routeVersion: prepared.routeVersion
      },
      taskKey: input.context.taskKey,
      featureKey: input.context.featureKey,
      requestedModel: prepared.requestedModel,
      resolvedModel,
      payload: input.serialize(data),
      usage,
      estimatedCostUsd
    });
  }

  return {
    data,
    usage,
    resolvedModel,
    requestedModel: prepared.requestedModel,
    cacheHit: false,
    budgetDecision: prepared.budgetDecision
  };
}
