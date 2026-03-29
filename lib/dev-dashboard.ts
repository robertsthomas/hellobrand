import { auth, clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";

import { getClerkMetadataDisplayName } from "@/lib/clerk-profile";
import { DEFAULT_E2E_VIEWER } from "@/lib/e2e-auth";
import { prisma } from "@/lib/prisma";

export type DevDashboardViewer = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export type DevDashboardDatabaseSummary = {
  users: number;
  profiles: number;
  onboardingStates: number;
  deals: number;
  documents: number;
  intakeSessions: number;
  emailAccounts: number;
  assistantThreads: number;
  billingAccounts: number;
  billingWebhookEvents: number;
};

export type DevDashboardSnapshot = {
  host: string | null;
  environment: string;
  databaseConfigured: boolean;
  database: DevDashboardDatabaseSummary | null;
  clerkUserCount: number | null;
};

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
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

export function isLocalDevelopmentHost(host: string | null) {
  const normalizedHost = normalizeHost(host);

  return (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  );
}

export function isLocalDevelopmentRequest(host: string | null) {
  return process.env.NODE_ENV !== "production" && isLocalDevelopmentHost(host);
}

export async function getRequestHost() {
  const requestHeaders = await headers();

  return (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host")
  );
}

export async function getDevDashboardViewerFromSession(): Promise<DevDashboardViewer | null> {
  const session = await auth();

  if (!session.userId) {
    return process.env.NODE_ENV !== "production"
      ? {
          id: DEFAULT_E2E_VIEWER.id,
          email: DEFAULT_E2E_VIEWER.email,
          displayName: DEFAULT_E2E_VIEWER.displayName
        }
      : null;
  }

  const claims = (session.sessionClaims as Record<string, unknown> | undefined) ?? null;
  return {
    id: session.userId,
    email: firstString(
      claims?.email,
      claims?.primaryEmailAddress,
      claims?.primary_email_address,
      claims?.["email_address"]
    ),
    displayName: firstString(
      getClerkMetadataDisplayName(claims),
      claims?.fullName,
      claims?.full_name,
      [claims?.firstName, claims?.lastName].filter(Boolean).join(" "),
      [claims?.first_name, claims?.last_name].filter(Boolean).join(" "),
      claims?.username
    )
  };
}

async function getDatabaseSummary(): Promise<DevDashboardDatabaseSummary | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const [
    users,
    profiles,
    onboardingStates,
    deals,
    documents,
    intakeSessions,
    emailAccounts,
    assistantThreads,
    billingAccounts,
    billingWebhookEvents
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.userOnboardingState.count(),
    prisma.deal.count(),
    prisma.document.count(),
    prisma.intakeSession.count(),
    prisma.connectedEmailAccount.count(),
    prisma.assistantThread.count(),
    prisma.billingAccount.count(),
    prisma.billingWebhookEvent.count()
  ]);

  return {
    users,
    profiles,
    onboardingStates,
    deals,
    documents,
    intakeSessions,
    emailAccounts,
    assistantThreads,
    billingAccounts,
    billingWebhookEvents
  };
}

async function getClerkUserCount() {
  try {
    const client = await clerkClient();
    return await client.users.getCount();
  } catch {
    return null;
  }
}

export async function getDevDashboardSnapshot(): Promise<DevDashboardSnapshot> {
  const host = await getRequestHost();
  const [database, clerkUserCount] = await Promise.all([
    getDatabaseSummary(),
    getClerkUserCount()
  ]);

  return {
    host,
    environment: process.env.NODE_ENV ?? "development",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    database,
    clerkUserCount
  };
}

export async function resetViewerOnboardingState(userId: string) {
  if (!process.env.DATABASE_URL) {
    return { changed: false };
  }

  const result = await prisma.userOnboardingState.deleteMany({
    where: { userId }
  });

  return { changed: result.count > 0 };
}

export async function resetViewerGuideState(userId: string) {
  if (!process.env.DATABASE_URL) {
    return { changed: false };
  }

  const existing = await prisma.userOnboardingState.findUnique({
    where: { userId },
    select: {
      id: true,
      profileOnboardingCompletedAt: true,
      profileOnboardingVersion: true,
      profileOnboardingStateJson: true
    }
  });

  await prisma.userOnboardingState.upsert({
    where: { userId },
    update: {
      productGuideVersion: { increment: 1 },
      productGuideStateJson: {
        dismissedStepIds: [],
        completedStepIds: []
      }
    },
    create: {
      userId,
      profileOnboardingCompletedAt: existing?.profileOnboardingCompletedAt ?? null,
      profileOnboardingVersion: existing?.profileOnboardingVersion ?? 0,
      profileOnboardingStateJson: existing?.profileOnboardingStateJson ?? undefined,
      productGuideVersion: 1,
      productGuideStateJson: {
        dismissedStepIds: [],
        completedStepIds: []
      }
    }
  });

  return { changed: true, created: !existing };
}

export async function clearDevelopmentDatabase() {
  if (!process.env.DATABASE_URL) {
    return {
      cleared: false,
      before: null,
      after: null
    };
  }

  const before = await getDatabaseSummary();

  await prisma.$transaction(async (tx) => {
    await tx.billingWebhookEvent.deleteMany({});
    await tx.user.deleteMany({});
  });

  const after = await getDatabaseSummary();

  return {
    cleared: true,
    before,
    after
  };
}

export async function clearClerkUsers(currentUserId: string) {
  const client = await clerkClient();
  let deletedCount = 0;
  let deletedCurrentUser = false;

  while (true) {
    const { data } = await client.users.getUserList({
      limit: 100,
      offset: 0
    });

    if (data.length === 0) {
      break;
    }

    for (const user of data) {
      if (user.id === currentUserId) {
        deletedCurrentUser = true;
      }

      await client.users.deleteUser(user.id);
      deletedCount += 1;
    }
  }

  return {
    deletedCount,
    deletedCurrentUser
  };
}
