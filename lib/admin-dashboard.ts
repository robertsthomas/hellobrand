import { clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";

import type { AppSettingsRecord } from "@/lib/admin-settings";
import { getAppSettings } from "@/lib/admin-settings";
import { buildClerkProfileSyncPayload } from "@/lib/clerk-profile";
import { prisma } from "@/lib/prisma";
import type { ProfileRecord } from "@/lib/types";

export type AdminDashboardStats = {
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

export async function getAdminRequestHost() {
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

export async function listAdminManagedUsers() {
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
    users
  };
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

function toProfileRecordForClerk(user: AdminManagedUser): ProfileRecord {
  return {
    id: user.profile?.id ?? `profile-${user.id}`,
    userId: user.id,
    displayName: user.profile?.displayName ?? user.displayName,
    creatorLegalName: user.profile?.creatorLegalName ?? null,
    businessName: user.profile?.businessName ?? null,
    contactEmail: user.profile?.contactEmail ?? user.email,
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
