-- Repair document pipeline updatedAt defaults after the table-creation migration.
ALTER TABLE "DocumentReviewItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "DocumentRun" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Add Documenso eSignature tracking to deals.
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "esignEnvelopeId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "esignStatus" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "esignUpdatedAt" TIMESTAMP(3);
