import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __hellobrand_prisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(process.env.DATABASE_URL
      ? {
          datasources: {
            db: {
              url: buildDatabaseUrl()
            }
          }
        }
      : {})
  });
}

function hasExpectedDelegates(client: PrismaClient) {
  const candidate = client as PrismaClient & Record<string, unknown>;

  return (
    "appSettings" in candidate &&
    "adminCredential" in candidate &&
    "adminSession" in candidate
  );
}

function buildDatabaseUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  // Limit connection pool size to avoid exhausting Supabase session-mode pooler
  const url = new URL(base);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }
  return url.toString();
}

const cachedPrisma = global.__hellobrand_prisma__;

export const prisma =
  cachedPrisma && hasExpectedDelegates(cachedPrisma)
    ? cachedPrisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__hellobrand_prisma__ = prisma;
}
