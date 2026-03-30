import { prisma } from "@/lib/prisma";

const EMAIL_NOTIFICATIONS_DEFAULT_ENABLED_ROLLOUT_AT = new Date(
  "2026-03-30T00:00:00.000Z"
);

type StoredEmailNotificationPreference = {
  id?: string | null;
  emailNotificationsEnabled?: boolean | null;
  createdAt?: Date | string | null;
};

type ProfileAuditDelegate = {
  findMany: (args: unknown) => Promise<Array<{ changedFields: unknown }>>;
};

function getProfileAuditDelegate() {
  return (prisma as typeof prisma & {
    profileAuditEvent?: ProfileAuditDelegate;
  }).profileAuditEvent;
}

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function resolveEmailNotificationsEnabled(
  profile: StoredEmailNotificationPreference | null | undefined
) {
  if (!profile) {
    return true;
  }

  if (profile.emailNotificationsEnabled) {
    return true;
  }

  if (!profile.id) {
    return true;
  }

  const createdAt = toDate(profile.createdAt);
  if (createdAt && createdAt >= EMAIL_NOTIFICATIONS_DEFAULT_ENABLED_ROLLOUT_AT) {
    return false;
  }

  const profileAuditEvent = getProfileAuditDelegate();
  if (!profileAuditEvent) {
    return true;
  }

  const auditEvents = await profileAuditEvent.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 25
  });

  const hasExplicitPreference = auditEvents.some((event) => {
    if (!Array.isArray(event.changedFields)) {
      return false;
    }

    return event.changedFields.map(String).includes("emailNotificationsEnabled");
  });

  return !hasExplicitPreference;
}
