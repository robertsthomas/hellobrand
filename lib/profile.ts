import { clerkClient } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { parseProfileMetadata, type ProfileMetadata } from "@/lib/profile-metadata";
import type { ProfileAuditRecord, ProfileRecord, Viewer } from "@/lib/types";

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
  preferredSignature: string | null;
  payoutDetails: string | null;
  defaultCurrency: string | null;
  reminderLeadDays: number | null;
  conflictAlertsEnabled: boolean;
  paymentRemindersEnabled: boolean;
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
    preferredSignature: profile.preferredSignature,
    payoutDetails: profile.payoutDetails,
    defaultCurrency: profile.defaultCurrency,
    reminderLeadDays: profile.reminderLeadDays,
    conflictAlertsEnabled: profile.conflictAlertsEnabled,
    paymentRemindersEnabled: profile.paymentRemindersEnabled,
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

export async function getProfileForViewer(viewer: Viewer) {
  const existing = await prisma.profile.findUnique({
    where: { userId: viewer.id }
  });

  if (existing) {
    return toProfileRecord(existing);
  }

  const created = await prisma.profile.create({
    data: {
      userId: viewer.id,
      displayName: viewer.displayName,
      contactEmail: viewer.email,
      defaultCurrency: "USD",
      reminderLeadDays: 3,
      conflictAlertsEnabled: true,
      paymentRemindersEnabled: true
    }
  });

  const record = toProfileRecord(created);

  // Sync initial profile to Clerk
  void syncProfileToClerk(viewer.id, record).catch(() => undefined);

  return record;
}

export async function updateProfileForViewer(
  viewer: Viewer,
  patch: {
    displayName: string | null;
    creatorLegalName: string | null;
    businessName: string | null;
    contactEmail: string | null;
    preferredSignature: string | null;
    payoutDetails: string | null;
    defaultCurrency?: string | null;
    reminderLeadDays?: number | null;
    conflictAlertsEnabled?: boolean;
    paymentRemindersEnabled?: boolean;
    accentColor?: string | null;
  }
) {
  const existing = await prisma.profile.findUnique({
    where: { userId: viewer.id }
  });

  const normalizedPatch = {
    displayName: normalizeNullableString(patch.displayName),
    creatorLegalName: normalizeNullableString(patch.creatorLegalName),
    businessName: normalizeNullableString(patch.businessName),
    contactEmail: normalizeNullableString(patch.contactEmail),
    preferredSignature: normalizeNullableString(patch.preferredSignature),
    payoutDetails: normalizeNullableString(patch.payoutDetails),
    defaultCurrency: normalizeCurrency(patch.defaultCurrency),
    reminderLeadDays: patch.reminderLeadDays ?? existing?.reminderLeadDays ?? 3,
    conflictAlertsEnabled:
      patch.conflictAlertsEnabled ?? existing?.conflictAlertsEnabled ?? true,
    paymentRemindersEnabled:
      patch.paymentRemindersEnabled ?? existing?.paymentRemindersEnabled ?? true,
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
    preferredSignature: existing?.preferredSignature ?? null,
    payoutDetails: existing?.payoutDetails ?? null,
    defaultCurrency: existing?.defaultCurrency ?? "USD",
    reminderLeadDays: existing?.reminderLeadDays ?? 3,
    conflictAlertsEnabled: existing?.conflictAlertsEnabled ?? true,
    paymentRemindersEnabled: existing?.paymentRemindersEnabled ?? true,
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
  const metadata = parseProfileMetadata(profile.payoutDetails).metadata;

  const generalHandles = metadata.socialHandles
    .filter((h) => !h.dealContext && h.handle.trim())
    .map((h) => ({ platform: h.platform, handle: h.handle, audience: h.audienceLabel }));

  // Public metadata: visible from frontend, used for display
  const publicMetadata: Record<string, unknown> = {
    displayName: profile.displayName,
    businessName: profile.businessName,
    bio: metadata.bio,
    location: metadata.location,
    primaryPlatform: metadata.primaryPlatform,
    contentCategory: metadata.contentCategory,
    socialHandles: generalHandles,
    defaultCurrency: profile.defaultCurrency,
    profileUpdatedAt: profile.updatedAt
  };

  // Private metadata: server-only, never exposed to browser
  const privateMetadata: Record<string, unknown> = {
    creatorLegalName: profile.creatorLegalName,
    contactEmail: profile.contactEmail,
    preferredSignature: profile.preferredSignature,
    taxId: metadata.taxId,
    rateCardUrl: metadata.rateCardUrl,
    payoutNotes: metadata.payoutNotes,
    reminderLeadDays: profile.reminderLeadDays,
    conflictAlertsEnabled: profile.conflictAlertsEnabled,
    paymentRemindersEnabled: profile.paymentRemindersEnabled
  };

  // Update Clerk user profile + metadata
  await client.users.updateUser(userId, {
    firstName: profile.displayName?.split(/\s+/)[0] ?? undefined,
    lastName: profile.displayName?.split(/\s+/).slice(1).join(" ") || undefined,
    publicMetadata,
    privateMetadata
  });
}
