-- DropForeignKey
ALTER TABLE "EmailThreadReplySuggestionCache"
DROP CONSTRAINT "EmailThreadReplySuggestionCache_threadId_fkey";

-- DropForeignKey
ALTER TABLE "EmailThreadReplySuggestionCache"
DROP CONSTRAINT "EmailThreadReplySuggestionCache_userId_fkey";

-- DropTable
DROP TABLE "EmailThreadReplySuggestionCache";

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "billingAccountId" TEXT,
    "featureKey" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "resolvedModel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cacheStatus" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requestKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCacheEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "featureKey" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "routeVersion" TEXT NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "resolvedModel" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "usageJson" JSONB,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageEvent_userId_createdAt_idx" ON "AiUsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_billingAccountId_createdAt_idx" ON "AiUsageEvent"("billingAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_featureKey_taskKey_createdAt_idx" ON "AiUsageEvent"("featureKey", "taskKey", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_taskKey_createdAt_idx" ON "AiUsageEvent"("taskKey", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_requestKey_idx" ON "AiUsageEvent"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiCacheEntry_featureKey_taskKey_scopeKey_inputHash_promptVersion_routeVersion_key"
ON "AiCacheEntry"("featureKey", "taskKey", "scopeKey", "inputHash", "promptVersion", "routeVersion");

-- CreateIndex
CREATE INDEX "AiCacheEntry_userId_taskKey_updatedAt_idx" ON "AiCacheEntry"("userId", "taskKey", "updatedAt");

-- CreateIndex
CREATE INDEX "AiCacheEntry_taskKey_expiresAt_idx" ON "AiCacheEntry"("taskKey", "expiresAt");

-- CreateIndex
CREATE INDEX "AiCacheEntry_expiresAt_idx" ON "AiCacheEntry"("expiresAt");

-- AddForeignKey
ALTER TABLE "AiUsageEvent"
ADD CONSTRAINT "AiUsageEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent"
ADD CONSTRAINT "AiUsageEvent_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCacheEntry"
ADD CONSTRAINT "AiCacheEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
