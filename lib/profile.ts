import { clerkClient } from "@clerk/nextjs/server";

import { buildClerkProfileSyncPayload } from "@/lib/clerk-profile";
import { resolveEmailNotificationsEnabled } from "@/lib/email-notification-preference";
import { prisma } from "@/lib/prisma";
import type { ProfileAuditRecord, ProfileRecord, Viewer } from "@/lib/types";

function buildFileBackedProfile(viewer: Viewer): ProfileRecord {
  const now = new Date().toISOString();

  return {
    id: `profile-${viewer.id}`,
    userId: viewer.id,
    displayName: viewer.displayName,
    creatorLegalName: null,
    businessName: null,
    contactEmail: viewer.email,
    timeZone: null,
    preferredSignature: viewer.displayName,
    payoutDetails: null,
    defaultCurrency: "USD",
    reminderLeadDays: 3,
    conflictAlertsEnabled: true,
    paymentRemindersEnabled: true,
    emailNotificationsEnabled: true,
    accentColor: null,
    createdAt: now,
    updatedAt: now
  };
}

function getProfileAuditDelegate() {
  return (prisma as typeof prisma & {
    profileAuditEvent?: {
      create: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown[]>;
    };
  }).profileAuditEvent;
}

function toProfileRecord(profile: {
  id: string;
  userId: string;
  displayName: string | null;
  creatorLegalName: string | null;
  businessName: string | null;
  contactEmail: string | null;
  timeZone: string | null;
  preferredSignature: string | null;
  payoutDetails: string | null;
  defaultCurrency: string | null;
  reminderLeadDays: number | null;
  conflictAlertsEnabled: boolean;
  paymentRemindersEnabled: boolean;
  emailNotificationsEnabled: boolean;
  accentColor?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProfileRecord {
  return {
    id: profile.id,
    userId: profile.userId,
    displayName: profile.displayName,
    creatorLegalName: profile.creatorLegalName,
    businessName: profile.businessName,
    contactEmail: profile.contactEmail,
    timeZone: profile.timeZone,
    preferredSignature: profile.preferredSignature,
    payoutDetails: profile.payoutDetails,
    defaultCurrency: profile.defaultCurrency,
    reminderLeadDays: profile.reminderLeadDays,
    conflictAlertsEnabled: profile.conflictAlertsEnabled,
    paymentRemindersEnabled: profile.paymentRemindersEnabled,
    emailNotificationsEnabled: profile.emailNotificationsEnabled,
    accentColor: profile.accentColor ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = normalizeNullableString(value);
  return normalized ? normalized.toUpperCase() : "USD";
}

function normalizeTimeZone(value: string | null | undefined) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(new Date());
    return normalized;
  } catch {
    return null;
  }
}

function toProfileAuditRecord(event: {
  id: string;
  profileId: string;
  actorUserId: string;
  changedFields: unknown;
  snapshot: unknown;
  createdAt: Date;
}): ProfileAuditRecord {
  return {
    id: event.id,
    profileId: event.profileId,
    actorUserId: event.actorUserId,
    changedFields: Array.isArray(event.changedFields)
      ? event.changedFields.map(String)
      : [],
    snapshot:
      event.snapshot && typeof event.snapshot === "object" && !Array.isArray(event.snapshot)
        ? (event.snapshot as Record<string, { before: unknown; after: unknown }>)
        : {},
    createdAt: event.createdAt.toISOString()
  };
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function getProfileForViewer(viewer: Viewer) {
  if (!process.env.DATABASE_URL) {
    return buildFileBackedProfile(viewer);
  }

  const existing = await prisma.profile.findUnique({
    where: { userId: viewer.id }
  });

  if (existing) {
    const emailNotificationsEnabled = await resolveEmailNotificationsEnabled({
      id: existing.id,
      emailNotificationsEnabled: existing.emailNotificationsEnabled,
      createdAt: existing.createdAt
    });

    if (emailNotificationsEnabled !== existing.emailNotificationsEnabled) {
      const upgraded = await prisma.profile.update({
        where: { id: existing.id },
        data: { emailNotificationsEnabled }
      });

      const record = toProfileRecord(upgraded);
      void syncProfileToClerk(viewer.id, record).catch(() => undefined);
      return record;
    }

    return toProfileRecord(existing);
  }

  let created;

  try {
    created = await prisma.profile.create({
      data: {
        userId: viewer.id,
        displayName: viewer.displayName,
        contactEmail: viewer.email,
        timeZone: null,
        defaultCurrency: "USD",
        reminderLeadDays: 3,
        conflictAlertsEnabled: true,
        paymentRemindersEnabled: true,
        emailNotificationsEnabled: true
      }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentProfile = await prisma.profile.findUnique({
      where: { userId: viewer.id }
    });

    if (!concurrentProfile) {
      throw error;
    }

    return toProfileRecord(concurrentProfile);
  }

  const record = toProfileRecord(created);

  // Sync initial profile to Clerk
  void syncProfileToClerk(viewer.id, record).catch(() => undefined);

  return record;
}

// fallow-ignore-next-line complexity
export async function updateProfileForViewer(
  viewer: Viewer,
  patch: {
    displayName: string | null;
    creatorLegalName: string | null;
    businessName: string | null;
    contactEmail: string | null;
    timeZone?: string | null;
    preferredSignature: string | null;
    payoutDetails: string | null;
    defaultCurrency?: string | null;
    reminderLeadDays?: number | null;
    conflictAlertsEnabled?: boolean;
    paymentRemindersEnabled?: boolean;
    emailNotificationsEnabled?: boolean;
    accentColor?: string | null;
  }
) {
  const existing = await prisma.profile.findUnique({
    where: { userId: viewer.id }
  });

  const existingEmailNotificationsEnabled = await resolveEmailNotificationsEnabled(
    existing
      ? {
          id: existing.id,
          emailNotificationsEnabled: existing.emailNotificationsEnabled,
          createdAt: existing.createdAt
        }
      : null
  );

  const normalizedPatch = {
    displayName: normalizeNullableString(patch.displayName),
    creatorLegalName: normalizeNullableString(patch.creatorLegalName),
    businessName: normalizeNullableString(patch.businessName),
    contactEmail: normalizeNullableString(patch.contactEmail),
    timeZone:
      patch.timeZone !== undefined ? normalizeTimeZone(patch.timeZone) : (existing?.timeZone ?? null),
    preferredSignature: normalizeNullableString(patch.preferredSignature),
    payoutDetails: normalizeNullableString(patch.payoutDetails),
    defaultCurrency: normalizeCurrency(patch.defaultCurrency),
    reminderLeadDays: patch.reminderLeadDays ?? existing?.reminderLeadDays ?? 3,
    conflictAlertsEnabled:
      patch.conflictAlertsEnabled ?? existing?.conflictAlertsEnabled ?? true,
    paymentRemindersEnabled:
      patch.paymentRemindersEnabled ?? existing?.paymentRemindersEnabled ?? true,
    emailNotificationsEnabled:
      patch.emailNotificationsEnabled ?? existingEmailNotificationsEnabled,
    accentColor: patch.accentColor !== undefined ? patch.accentColor : (existing?.accentColor ?? null)
  };

  const profile = await prisma.profile.upsert({
    where: { userId: viewer.id },
    update: normalizedPatch,
    create: {
      userId: viewer.id,
      ...normalizedPatch
    }
  });

  const previousValues = {
    displayName: existing?.displayName ?? null,
    creatorLegalName: existing?.creatorLegalName ?? null,
    businessName: existing?.businessName ?? null,
    contactEmail: existing?.contactEmail ?? null,
    timeZone: existing?.timeZone ?? null,
    preferredSignature: existing?.preferredSignature ?? null,
    payoutDetails: existing?.payoutDetails ?? null,
    defaultCurrency: existing?.defaultCurrency ?? "USD",
    reminderLeadDays: existing?.reminderLeadDays ?? 3,
    conflictAlertsEnabled: existing?.conflictAlertsEnabled ?? true,
    paymentRemindersEnabled: existing?.paymentRemindersEnabled ?? true,
    emailNotificationsEnabled: existingEmailNotificationsEnabled,
    accentColor: existing?.accentColor ?? null
  };

  const changedEntries = Object.entries(normalizedPatch).filter(
    ([key, value]) =>
      JSON.stringify(previousValues[key as keyof typeof previousValues]) !==
      JSON.stringify(value)
  );

  if (changedEntries.length > 0) {
    const profileAuditEvent = getProfileAuditDelegate();

    if (profileAuditEvent) {
      await profileAuditEvent.create({
        data: {
          profileId: profile.id,
          actorUserId: viewer.id,
          changedFields: changedEntries.map(([key]) => key),
          snapshot: Object.fromEntries(
            changedEntries.map(([key, value]) => [
              key,
              {
                before: previousValues[key as keyof typeof previousValues],
                after: value
              }
            ])
          )
        }
      });
    }
  }

  if (normalizedPatch.displayName?.trim()) {
    await prisma.user.update({
      where: { id: viewer.id },
      data: { displayName: normalizedPatch.displayName.trim() }
    });
  }

  // Sync to Clerk metadata in the background
  void syncProfileToClerk(viewer.id, toProfileRecord(profile)).catch(() => undefined);

  return toProfileRecord(profile);
}

export async function listProfileAuditForViewer(viewer: Viewer, limit = 8) {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const profileAuditEvent = getProfileAuditDelegate();
  if (!profileAuditEvent) {
    return [];
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: viewer.id },
    select: { id: true }
  });

  if (!profile) {
    return [];
  }

  const events = await profileAuditEvent.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return events.map(toProfileAuditRecord);
}

/* ------------------------------------------------------------------ */
/*  Clerk metadata sync                                                */
/* ------------------------------------------------------------------ */

async function syncProfileToClerk(userId: string, profile: ProfileRecord) {
  const client = await clerkClient();
  await client.users.updateUser(userId, buildClerkProfileSyncPayload(profile));
}
