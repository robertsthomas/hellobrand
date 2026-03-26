-- Align legacy assistant/email migrations with the current Prisma schema.
-- Older SQL migrations created DEFAULT CURRENT_TIMESTAMP on several
-- `updatedAt` columns, but the datamodel uses `@updatedAt` without a DB-level
-- default. This migration removes those legacy defaults.

ALTER TABLE "AssistantThread"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "AssistantMessage"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "AssistantContextSnapshot"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ConnectedEmailAccount"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "EmailThread"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "EmailMessage"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "EmailSyncState"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "EmailThreadPreviewState"
ALTER COLUMN "updatedAt" DROP DEFAULT;
