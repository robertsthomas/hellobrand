-- AlterTable
ALTER TABLE "EmailThreadDraft" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailThreadNote" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "timeZone" TEXT;
