ALTER TABLE "AnonymousAnalysisSession"
ADD COLUMN "visitorId" TEXT,
ADD COLUMN "ipHash" TEXT,
ADD COLUMN "fileHash" TEXT;

CREATE INDEX "AnonymousAnalysisSession_visitorId_fileHash_expiresAt_idx"
ON "AnonymousAnalysisSession"("visitorId", "fileHash", "expiresAt");

CREATE INDEX "AnonymousAnalysisSession_visitorId_createdAt_idx"
ON "AnonymousAnalysisSession"("visitorId", "createdAt");

CREATE INDEX "AnonymousAnalysisSession_ipHash_createdAt_idx"
ON "AnonymousAnalysisSession"("ipHash", "createdAt");

CREATE TABLE "AnonymousUploadLedger" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnonymousUploadLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnonymousUploadLedger_visitorId_createdAt_idx"
ON "AnonymousUploadLedger"("visitorId", "createdAt");

CREATE INDEX "AnonymousUploadLedger_ipHash_createdAt_idx"
ON "AnonymousUploadLedger"("ipHash", "createdAt");

CREATE INDEX "AnonymousUploadLedger_visitorId_fileHash_createdAt_idx"
ON "AnonymousUploadLedger"("visitorId", "fileHash", "createdAt");
