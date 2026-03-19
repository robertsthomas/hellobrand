import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __hellobrand_prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__hellobrand_prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(process.env.DATABASE_URL
      ? {
          datasources: {
            db: {
              url: process.env.DATABASE_URL
            }
          }
        }
      : {})
  });

if (process.env.NODE_ENV !== "production") {
  global.__hellobrand_prisma__ = prisma;
}
