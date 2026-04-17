import { Prisma } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

const DEFAULT_APP_SETTINGS = {
  id: "primary",
  appAccessEnabled: true,
  publicSiteEnabled: true,
  signUpsEnabled: true,
  emailDeliveryEnabled: true,
  updatedByAdminUsername: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
} as const;

export type AppSettingsRecord = {
  id: string;
  appAccessEnabled: boolean;
  publicSiteEnabled: boolean;
  signUpsEnabled: boolean;
  emailDeliveryEnabled: boolean;
  updatedByAdminUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

function toAppSettingsRecord(settings: {
  id: string;
  appAccessEnabled: boolean;
  publicSiteEnabled: boolean;
  signUpsEnabled: boolean;
  emailDeliveryEnabled: boolean;
  updatedByAdminUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AppSettingsRecord {
  return {
    id: settings.id,
    appAccessEnabled: settings.appAccessEnabled,
    publicSiteEnabled: settings.publicSiteEnabled,
    signUpsEnabled: settings.signUpsEnabled,
    emailDeliveryEnabled: settings.emailDeliveryEnabled,
    updatedByAdminUsername: settings.updatedByAdminUsername,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString()
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isDatabaseInitializationError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError;
}

const getAppSettingsCached = cache(async (): Promise<AppSettingsRecord> => {
  if (!process.env.DATABASE_URL) {
    return {
      ...DEFAULT_APP_SETTINGS
    };
  }

  try {
    const existing = await prisma.appSettings.findUnique({
      where: { id: "primary" }
    });

    if (existing) {
      return toAppSettingsRecord(existing);
    }

    const created = await prisma.appSettings.create({
      data: { id: "primary" }
    });

    return toAppSettingsRecord(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.appSettings.findUnique({
        where: { id: "primary" }
      });

      if (existing) {
        return toAppSettingsRecord(existing);
      }
    }

    if (
      process.env.NODE_ENV !== "production" &&
      isDatabaseInitializationError(error)
    ) {
      return {
        ...DEFAULT_APP_SETTINGS
      };
    }

    throw error;
  }
});

export async function getAppSettings(): Promise<AppSettingsRecord> {
  return getAppSettingsCached();
}

export async function updateAppSettings(
  input: Pick<
    AppSettingsRecord,
    "appAccessEnabled" | "publicSiteEnabled" | "signUpsEnabled" | "emailDeliveryEnabled"
  >,
  adminUsername: string
) {
  const settings = await prisma.appSettings.upsert({
    where: { id: "primary" },
    update: {
      ...input,
      updatedByAdminUsername: adminUsername
    },
    create: {
      id: "primary",
      ...input,
      updatedByAdminUsername: adminUsername
    }
  });

  return toAppSettingsRecord(settings);
}
