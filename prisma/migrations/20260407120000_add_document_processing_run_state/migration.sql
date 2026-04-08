ALTER TABLE "Document"
ADD COLUMN "processingRunId" TEXT,
ADD COLUMN "processingRunStateJson" JSONB,
ADD COLUMN "processingStartedAt" TIMESTAMP(3);
