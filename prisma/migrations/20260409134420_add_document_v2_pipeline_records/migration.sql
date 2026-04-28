-- This migration originally ran before the tables existed in a fresh migration chain.
-- Keep it safe for shadow database creation; a later repair migration applies the intended changes.
ALTER TABLE IF EXISTS "DocumentReviewItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE IF EXISTS "DocumentRun" ALTER COLUMN "updatedAt" DROP DEFAULT;
