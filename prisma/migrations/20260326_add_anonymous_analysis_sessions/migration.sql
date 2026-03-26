CREATE TABLE "AnonymousAnalysisSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "storagePath" TEXT,
    "rawText" TEXT,
    "normalizedText" TEXT NOT NULL,
    "analysisJson" JSONB NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "claimedByUserId" TEXT,
    "claimedDealId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousAnalysisSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnonymousAnalysisSession_token_key" ON "AnonymousAnalysisSession"("token");
CREATE INDEX "AnonymousAnalysisSession_expiresAt_idx" ON "AnonymousAnalysisSession"("expiresAt");
CREATE INDEX "AnonymousAnalysisSession_claimedAt_expiresAt_idx" ON "AnonymousAnalysisSession"("claimedAt", "expiresAt");
