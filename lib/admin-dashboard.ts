import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";

import type { AppSettingsRecord } from "@/lib/admin-settings";
import { getAppSettings } from "@/lib/admin-settings";
import { buildClerkProfileSyncPayload } from "@/lib/clerk-profile";
import { prisma } from "@/lib/prisma";
import type { ProfileRecord } from "@/lib/types";

type AiModelInfo = {
  task: string;
  primary: string;
  fallbacks: string[];
  envVar: string | null;
  routeVersion: string;
};

type AiModelConfig = {
  models: AiModelInfo[];
  approvedProductionModels: string[];
};

type AdminDashboardStats = {
  users: number;
  profiles: number;
  deals: number;
  intakeSessions: number;
  emailAccounts: number;
  assistantThreads: number;
  notifications: number;
};

export type AdminManagedUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  dealCount: number;
  emailAccountCount: number;
  notificationCount: number;
  profile: {
    id: string;
    displayName: string | null;
    creatorLegalName: string | null;
    businessName: string | null;
    contactEmail: string | null;
    conflictAlertsEnabled: boolean;
    paymentRemindersEnabled: boolean;
    emailNotificationsEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type AdminDashboardSnapshot = {
  host: string | null;
  environment: string;
  stats: AdminDashboardStats | null;
  appSettings: AppSettingsRecord;
  users: AdminManagedUser[];
  aiModelConfig: AiModelConfig;
};

type AdminUserUpdateInput = {
  displayName: string | null;
  creatorLegalName: string | null;
  businessName: string | null;
  contactEmail: string | null;
  conflictAlertsEnabled: boolean;
  paymentRemindersEnabled: boolean;
  emailNotificationsEnabled: boolean;
};

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeHost(host: string | null) {
  if (!host) {
    return null;
  }

  const normalized = host.trim().toLowerCase();

  if (normalized.startsWith("[")) {
    const endIndex = normalized.indexOf("]");
    return endIndex >= 0 ? normalized.slice(1, endIndex) : normalized;
  }

  return normalized.split(":")[0] ?? null;
}

function toManagedUser(user: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    id: string;
    displayName: string | null;
    creatorLegalName: string | null;
    businessName: string | null;
    contactEmail: string | null;
    conflictAlertsEnabled: boolean;
    paymentRemindersEnabled: boolean;
    emailNotificationsEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  _count: {
    deals: number;
    emailAccounts: number;
    appNotifications: number;
  };
}): AdminManagedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    dealCount: user._count.deals,
    emailAccountCount: user._count.emailAccounts,
    notificationCount: user._count.appNotifications,
    profile: user.profile
      ? {
          id: user.profile.id,
          displayName: user.profile.displayName,
          creatorLegalName: user.profile.creatorLegalName,
          businessName: user.profile.businessName,
          contactEmail: user.profile.contactEmail,
          conflictAlertsEnabled: user.profile.conflictAlertsEnabled,
          paymentRemindersEnabled: user.profile.paymentRemindersEnabled,
          emailNotificationsEnabled: user.profile.emailNotificationsEnabled,
          createdAt: user.profile.createdAt.toISOString(),
          updatedAt: user.profile.updatedAt.toISOString()
        }
      : null
  };
}

async function getAdminRequestHost() {
  const requestHeaders = await headers();

  return normalizeHost(
    requestHeaders.get("x-forwarded-host") ??
      requestHeaders.get("host")
  );
}

async function getAdminDashboardStats(): Promise<AdminDashboardStats | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const [users, profiles, deals, intakeSessions, emailAccounts, assistantThreads, notifications] =
    await Promise.all([
      prisma.user.count(),
      prisma.profile.count(),
      prisma.deal.count(),
      prisma.intakeSession.count(),
      prisma.connectedEmailAccount.count(),
      prisma.assistantThread.count(),
      prisma.appNotification.count()
    ]);

  return {
    users,
    profiles,
    deals,
    intakeSessions,
    emailAccounts,
    assistantThreads,
    notifications
  };
}

async function listAdminManagedUsers() {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const users = await prisma.user.findMany({
    include: {
      profile: {
        select: {
          id: true,
          displayName: true,
          creatorLegalName: true,
          businessName: true,
          contactEmail: true,
          conflictAlertsEnabled: true,
          paymentRemindersEnabled: true,
          emailNotificationsEnabled: true,
          createdAt: true,
          updatedAt: true
        }
      },
      _count: {
        select: {
          deals: true,
          emailAccounts: true,
          appNotifications: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }, { email: "asc" }]
  });

  return users.map(toManagedUser);
}

export async function getAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const [host, stats, appSettings, users] = await Promise.all([
    getAdminRequestHost(),
    getAdminDashboardStats(),
    getAppSettings(),
    listAdminManagedUsers()
  ]);

  return {
    host,
    environment: process.env.NODE_ENV ?? "development",
    stats,
    appSettings,
    users,
    aiModelConfig: getAiModelConfig()
  };
}

const AI_TASKS: Array<{ key: string; envVar: string | null; category?: string }> = [
  { key: "extract_section", envVar: "OPENROUTER_MODEL_EXTRACT" },
  { key: "analyze_risks", envVar: "OPENROUTER_MODEL_RISKS" },
  { key: "generate_summary", envVar: "OPENROUTER_MODEL_CONTENT", category: "OPENROUTER_MODEL_CONTENT" },
  { key: "generate_brief", envVar: "OPENROUTER_MODEL_CONTENT", category: "OPENROUTER_MODEL_CONTENT" },
  { key: "assistant_chat", envVar: null },
  { key: "email_summary", envVar: "OPENROUTER_MODEL_EMAIL", category: "OPENROUTER_MODEL_EMAIL" },
  { key: "email_draft", envVar: "OPENROUTER_MODEL_EMAIL", category: "OPENROUTER_MODEL_EMAIL" },
  { key: "email_suggestions", envVar: "OPENROUTER_MODEL_EMAIL", category: "OPENROUTER_MODEL_EMAIL" },
  { key: "email_action_items", envVar: "OPENROUTER_MODEL_EMAIL", category: "OPENROUTER_MODEL_EMAIL" }
];

const TASK_PRIMARY_DEFAULTS: Record<string, string> = {
  extract_section: "google/gemini-3-flash-preview",
  analyze_risks: "google/gemini-3-flash-preview",
  generate_summary: "google/gemini-3-flash-preview",
  generate_brief: "google/gemini-3-flash-preview",
  assistant_chat: "openai/gpt-5-mini",
  email_summary: "google/gemini-2.5-flash",
  email_draft: "google/gemini-2.5-flash",
  email_suggestions: "google/gemini-2.5-flash",
  email_action_items: "google/gemini-2.5-flash"
};

const TASK_FALLBACK_DEFAULTS: Record<string, string[]> = {
  extract_section: ["openai/gpt-5-mini"],
  analyze_risks: ["openai/gpt-5-mini"],
  generate_summary: ["openai/gpt-5-mini"],
  generate_brief: ["openai/gpt-5-mini"],
  assistant_chat: ["google/gemini-2.5-flash"],
  email_summary: ["openai/gpt-5-mini"],
  email_draft: ["openai/gpt-5.4-mini", "google/gemini-3-flash-preview"],
  email_suggestions: ["openai/gpt-5-mini"],
  email_action_items: ["openai/gpt-5-mini"]
};

const ROUTE_VERSIONS: Record<string, string> = {
  extract_section: "extract.route.v2",
  analyze_risks: "risks.route.v2",
  generate_summary: "summary.route.v2",
  generate_brief: "brief.route.v2",
  assistant_chat: "assistant.route.v2",
  email_summary: "email.summary.route.v1",
  email_draft: "email.draft.route.v3",
  email_suggestions: "email.suggestions.route.v1",
  email_action_items: "email.action-items.route.v1"
};

const APPROVED_PRODUCTION_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
  "openai/gpt-5.4-mini"
];

function getAiModelConfig(): AiModelConfig {
  const globalModel = process.env.OPENROUTER_MODEL;

  const models: AiModelInfo[] = AI_TASKS.map(({ key, envVar }) => {
    const taskModel = envVar ? process.env[envVar] : null;
    const effectiveModel = taskModel ?? globalModel ?? TASK_PRIMARY_DEFAULTS[key] ?? "unknown";

    const taskFallbackKey = envVar;
    const fallbacks = [
      ...(taskFallbackKey ? parseEnvFallbacks(process.env[`${taskFallbackKey}_FALLBACKS`]) : []),
      ...parseEnvFallbacks(process.env.OPENROUTER_MODEL_FALLBACKS),
      ...(TASK_FALLBACK_DEFAULTS[key] ?? [])
    ].filter((m, i, arr) => m !== effectiveModel && arr.indexOf(m) === i);

    return {
      task: key,
      primary: effectiveModel,
      fallbacks,
      envVar: taskModel ? envVar : globalModel ? null : envVar,
      routeVersion: ROUTE_VERSIONS[key] ?? "unknown"
    };
  });

  return { models, approvedProductionModels: APPROVED_PRODUCTION_MODELS };
}

function parseEnvFallbacks(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((m) => m.trim()).filter(Boolean);
}

export async function updateAdminManagedUser(
  userId: string,
  input: AdminUserUpdateInput,
  adminUsername: string
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true
    }
  });

  if (!existing) {
    throw new Error("User not found.");
  }

  const resolvedDisplayName = normalizeNullableString(input.displayName) ?? existing.displayName;
  const resolvedCreatorLegalName = normalizeNullableString(input.creatorLegalName);
  const resolvedBusinessName = normalizeNullableString(input.businessName);
  const resolvedContactEmail = normalizeNullableString(input.contactEmail);

  const previousProfileValues = {
    displayName: existing.profile?.displayName ?? existing.displayName,
    creatorLegalName: existing.profile?.creatorLegalName ?? null,
    businessName: existing.profile?.businessName ?? null,
    contactEmail: existing.profile?.contactEmail ?? existing.email,
    conflictAlertsEnabled: existing.profile?.conflictAlertsEnabled ?? true,
    paymentRemindersEnabled: existing.profile?.paymentRemindersEnabled ?? true,
    emailNotificationsEnabled: existing.profile?.emailNotificationsEnabled ?? true
  };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        displayName: resolvedDisplayName
      }
    });

    const profile = await tx.profile.upsert({
      where: { userId },
      update: {
        displayName: resolvedDisplayName,
        creatorLegalName: resolvedCreatorLegalName,
        businessName: resolvedBusinessName,
        contactEmail: resolvedContactEmail,
        conflictAlertsEnabled: input.conflictAlertsEnabled,
        paymentRemindersEnabled: input.paymentRemindersEnabled,
        emailNotificationsEnabled: input.emailNotificationsEnabled
      },
      create: {
        userId,
        displayName: resolvedDisplayName,
        creatorLegalName: resolvedCreatorLegalName,
        businessName: resolvedBusinessName,
        contactEmail: resolvedContactEmail,
        defaultCurrency: "USD",
        reminderLeadDays: 3,
        conflictAlertsEnabled: input.conflictAlertsEnabled,
        paymentRemindersEnabled: input.paymentRemindersEnabled,
        emailNotificationsEnabled: input.emailNotificationsEnabled
      }
    });

    const nextProfileValues = {
      displayName: profile.displayName,
      creatorLegalName: profile.creatorLegalName,
      businessName: profile.businessName,
      contactEmail: profile.contactEmail,
      conflictAlertsEnabled: profile.conflictAlertsEnabled,
      paymentRemindersEnabled: profile.paymentRemindersEnabled,
      emailNotificationsEnabled: profile.emailNotificationsEnabled
    };

    const changedEntries = Object.entries(nextProfileValues).filter(
      ([key, value]) =>
        JSON.stringify(previousProfileValues[key as keyof typeof previousProfileValues]) !==
        JSON.stringify(value)
    );

    if (changedEntries.length > 0) {
      await tx.profileAuditEvent.create({
        data: {
          profileId: profile.id,
          actorUserId: `admin:${adminUsername}`,
          changedFields: changedEntries.map(([key]) => key),
          snapshot: Object.fromEntries(
            changedEntries.map(([key, value]) => [
              key,
              {
                before: previousProfileValues[key as keyof typeof previousProfileValues],
                after: value
              }
            ])
          )
        }
      });
    }
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        select: {
          id: true,
          displayName: true,
          creatorLegalName: true,
          businessName: true,
          contactEmail: true,
          conflictAlertsEnabled: true,
          paymentRemindersEnabled: true,
          emailNotificationsEnabled: true,
          createdAt: true,
          updatedAt: true
        }
      },
      _count: {
        select: {
          deals: true,
          emailAccounts: true,
          appNotifications: true
        }
      }
    }
  });

  if (!updated) {
    throw new Error("User not found.");
  }

  const managedUser = toManagedUser(updated);

  void syncAdminManagedProfileToClerk(userId, managedUser).catch(() => undefined);

  return managedUser;
}

async function syncAdminManagedProfileToClerk(userId: string, user: AdminManagedUser) {
  const client = await clerkClient();
  const profile = toProfileRecordForClerk(user);

  await client.users.updateUser(userId, buildClerkProfileSyncPayload(profile));
}

export type AdminUserDetail = AdminManagedUser & {
  deals: Array<{
    id: string;
    brandName: string;
    campaignName: string;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  billing: {
    currentPlanTier: string | null;
    currentPlanInterval: string | null;
    currentSubscriptionStatus: string | null;
    currentTrialPlanTier: string | null;
    currentTrialStartedAt: string | null;
    currentTrialEndsAt: string | null;
  } | null;
  onboarding: {
    profileOnboardingCompletedAt: string | null;
    productGuideVersion: number;
  } | null;
};

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  if (!process.env.DATABASE_URL) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        select: {
          id: true,
          displayName: true,
          creatorLegalName: true,
          businessName: true,
          contactEmail: true,
          conflictAlertsEnabled: true,
          paymentRemindersEnabled: true,
          emailNotificationsEnabled: true,
          createdAt: true,
          updatedAt: true
        }
      },
      deals: {
        select: {
          id: true,
          brandName: true,
          campaignName: true,
          status: true,
          paymentStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      },
      billingAccount: {
        select: {
          currentPlanTier: true,
          currentPlanInterval: true,
          currentSubscriptionStatus: true,
          currentTrialPlanTier: true,
          currentTrialStartedAt: true,
          currentTrialEndsAt: true
        }
      },
      onboardingState: {
        select: {
          profileOnboardingCompletedAt: true,
          productGuideVersion: true
        }
      },
      _count: {
        select: {
          deals: true,
          emailAccounts: true,
          appNotifications: true
        }
      }
    }
  });

  if (!user) return null;

  const managed = toManagedUser(user);

  return {
    ...managed,
    deals: user.deals.map((deal) => ({
      id: deal.id,
      brandName: deal.brandName,
      campaignName: deal.campaignName,
      status: deal.status,
      paymentStatus: deal.paymentStatus,
      createdAt: deal.createdAt.toISOString()
    })),
    billing: user.billingAccount
      ? {
          currentPlanTier: user.billingAccount.currentPlanTier,
          currentPlanInterval: user.billingAccount.currentPlanInterval,
          currentSubscriptionStatus: user.billingAccount.currentSubscriptionStatus,
          currentTrialPlanTier: user.billingAccount.currentTrialPlanTier,
          currentTrialStartedAt: user.billingAccount.currentTrialStartedAt?.toISOString() ?? null,
          currentTrialEndsAt: user.billingAccount.currentTrialEndsAt?.toISOString() ?? null
        }
      : null,
    onboarding: user.onboardingState
      ? {
          profileOnboardingCompletedAt:
            user.onboardingState.profileOnboardingCompletedAt?.toISOString() ?? null,
          productGuideVersion: user.onboardingState.productGuideVersion
        }
      : null
  };
}

export async function resetUserOnboarding(userId: string) {
  await prisma.userOnboardingState.upsert({
    where: { userId },
    update: {
      profileOnboardingCompletedAt: null,
      profileOnboardingVersion: 0,
      profileOnboardingStateJson: Prisma.JsonNull,
      productGuideVersion: 0,
      productGuideStateJson: Prisma.JsonNull
    },
    create: {
      userId,
      profileOnboardingCompletedAt: null,
      profileOnboardingVersion: 0,
      profileOnboardingStateJson: Prisma.JsonNull,
      productGuideVersion: 0,
      productGuideStateJson: Prisma.JsonNull
    }
  });
}

export async function deleteUserDeal(userId: string, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId }
  });

  if (!deal) {
    throw new Error("Deal not found or does not belong to this user.");
  }

  await prisma.deal.delete({ where: { id: dealId } });
}

export async function updateUserPlan(
  userId: string,
  planTier: "free" | "basic" | "premium",
  subscriptionStatus: string
) {
  await prisma.billingAccount.upsert({
    where: { userId },
    update: {
      currentPlanTier: planTier,
      currentSubscriptionStatus: subscriptionStatus as never,
      lastSyncedAt: new Date()
    },
    create: {
      userId,
      provider: "stripe",
      currentPlanTier: planTier,
      currentSubscriptionStatus: subscriptionStatus as never,
      lastSyncedAt: new Date()
    }
  });
}

export async function grantUserTrial(
  userId: string,
  planTier: "basic" | "premium",
  durationDays: number
) {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const billingAccount = await prisma.billingAccount.upsert({
    where: { userId },
    update: {
      currentTrialPlanTier: planTier,
      currentTrialStartedAt: startsAt,
      currentTrialEndsAt: endsAt,
      currentPlanTier: planTier,
      currentSubscriptionStatus: "trialing",
      lastSyncedAt: new Date()
    },
    create: {
      userId,
      provider: "stripe",
      currentTrialPlanTier: planTier,
      currentTrialStartedAt: startsAt,
      currentTrialEndsAt: endsAt,
      currentPlanTier: planTier,
      currentSubscriptionStatus: "trialing",
      lastSyncedAt: new Date()
    }
  });

  await prisma.billingTrialLedger.create({
    data: {
      billingAccountId: billingAccount.id,
      planTier,
      source: "admin_grant",
      status: "active",
      startedAt: startsAt,
      endsAt
    }
  });
}

// fallow-ignore-next-line complexity
function toProfileRecordForClerk(user: AdminManagedUser): ProfileRecord {
  return {
    id: user.profile?.id ?? `profile-${user.id}`,
    userId: user.id,
    displayName: user.profile?.displayName ?? user.displayName,
    creatorLegalName: user.profile?.creatorLegalName ?? null,
    businessName: user.profile?.businessName ?? null,
    contactEmail: user.profile?.contactEmail ?? user.email,
    timeZone: null,
    preferredSignature: user.profile?.displayName ?? user.displayName,
    payoutDetails: null,
    defaultCurrency: "USD",
    reminderLeadDays: 3,
    conflictAlertsEnabled: user.profile?.conflictAlertsEnabled ?? true,
    paymentRemindersEnabled: user.profile?.paymentRemindersEnabled ?? true,
    emailNotificationsEnabled: user.profile?.emailNotificationsEnabled ?? true,
    accentColor: null,
    createdAt: user.profile?.createdAt ?? user.createdAt,
    updatedAt: user.profile?.updatedAt ?? user.updatedAt
  };
}
