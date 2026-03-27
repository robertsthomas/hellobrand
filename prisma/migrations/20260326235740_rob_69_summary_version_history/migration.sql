-- CreateEnum
CREATE TYPE "SummaryType" AS ENUM ('legal', 'plain_language', 'short');

-- CreateEnum
CREATE TYPE "SummarySource" AS ENUM ('analysis', 'simplification');

-- AlterTable
ALTER TABLE "Summary"
ADD COLUMN     "summaryType" "SummaryType",
ADD COLUMN     "source" "SummarySource",
ADD COLUMN     "parentSummaryId" TEXT,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT false;

-- Backfill workspace summaries while keeping intake-only records out of the active flow
UPDATE "Summary"
SET
  "summaryType" = 'legal',
  "source" = 'analysis'
WHERE "version" NOT LIKE 'intake-normalized:%';

-- Mark the latest workspace summary in each deal as current
UPDATE "Summary"
SET "isCurrent" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("dealId") "id"
  FROM "Summary"
  WHERE "summaryType" IS NOT NULL
  ORDER BY "dealId", "createdAt" DESC
);

-- CreateIndex
CREATE INDEX "Summary_dealId_isCurrent_idx" ON "Summary"("dealId", "isCurrent");

-- CreateIndex
CREATE INDEX "Summary_dealId_summaryType_createdAt_idx" ON "Summary"("dealId", "summaryType", "createdAt");
