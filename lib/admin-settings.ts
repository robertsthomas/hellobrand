import { prisma } from "@/lib/prisma";

export const DEFAULT_APP_SETTINGS = {
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

export async function getAppSettings(): Promise<AppSettingsRecord> {
  if (!process.env.DATABASE_URL) {
    return {
      ...DEFAULT_APP_SETTINGS
    };
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "primary" },
    update: {},
    create: { id: "primary" }
  });

  return toAppSettingsRecord(settings);
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
