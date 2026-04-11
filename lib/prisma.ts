import { PrismaClient } from "@prisma/client";

declare global {
  var __hellobrand_prisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  const databaseUrl = buildDatabaseUrl();

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl
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

  // Keep Prisma conservative by default so Next dev/Turbopack workers do not
  // exhaust Supabase's session-mode pooler when the pooled URL is in use.
  const url = new URL(base);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set(
      "connection_limit",
      process.env.PRISMA_CONNECTION_LIMIT?.trim() || "1"
    );
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set(
      "pool_timeout",
      process.env.PRISMA_POOL_TIMEOUT?.trim() || "20"
    );
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
