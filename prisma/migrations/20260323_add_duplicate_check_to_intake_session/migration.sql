-- AlterTable
ALTER TABLE "IntakeSession" ADD COLUMN "duplicateCheckStatus" TEXT,
ADD COLUMN "duplicateMatchJson" JSONB;
