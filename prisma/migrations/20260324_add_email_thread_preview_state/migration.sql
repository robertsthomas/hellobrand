CREATE TABLE "EmailThreadPreviewState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "previewUpdatesSeenAt" TIMESTAMP(3),
    "actionItemsSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailThreadPreviewState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailThreadPreviewState_userId_threadId_key"
ON "EmailThreadPreviewState"("userId", "threadId");

CREATE INDEX "EmailThreadPreviewState_userId_updatedAt_idx"
ON "EmailThreadPreviewState"("userId", "updatedAt");

CREATE INDEX "EmailThreadPreviewState_threadId_idx"
ON "EmailThreadPreviewState"("threadId");

ALTER TABLE "EmailThreadPreviewState"
ADD CONSTRAINT "EmailThreadPreviewState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailThreadPreviewState"
ADD CONSTRAINT "EmailThreadPreviewState_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
