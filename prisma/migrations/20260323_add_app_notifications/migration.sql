CREATE TABLE "AppNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "sessionId" TEXT,
  "dealId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "readAt" TIMESTAMP(3),
  "clearedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppNotification_userId_dedupeKey_key"
ON "AppNotification"("userId", "dedupeKey");

CREATE INDEX "AppNotification_userId_status_createdAt_idx"
ON "AppNotification"("userId", "status", "createdAt");

CREATE INDEX "AppNotification_userId_readAt_createdAt_idx"
ON "AppNotification"("userId", "readAt", "createdAt");

CREATE INDEX "AppNotification_userId_clearedAt_createdAt_idx"
ON "AppNotification"("userId", "clearedAt", "createdAt");

CREATE INDEX "AppNotification_sessionId_status_createdAt_idx"
ON "AppNotification"("sessionId", "status", "createdAt");

CREATE INDEX "AppNotification_dealId_status_createdAt_idx"
ON "AppNotification"("dealId", "status", "createdAt");

ALTER TABLE "AppNotification"
ADD CONSTRAINT "AppNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotification"
ADD CONSTRAINT "AppNotification_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
