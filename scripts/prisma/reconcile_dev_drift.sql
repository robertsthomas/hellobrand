-- Repair already-applied migration drift in long-lived dev databases.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS "EmailThreadPreviewState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "previewUpdatesSeenAt" TIMESTAMP(3),
    "actionItemsSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThreadPreviewState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailThreadPreviewState_userId_threadId_key"
ON "EmailThreadPreviewState"("userId", "threadId");

CREATE INDEX IF NOT EXISTS "EmailThreadPreviewState_userId_updatedAt_idx"
ON "EmailThreadPreviewState"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "EmailThreadPreviewState_threadId_idx"
ON "EmailThreadPreviewState"("threadId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'EmailThreadPreviewState_userId_fkey'
    ) THEN
        ALTER TABLE "EmailThreadPreviewState"
        ADD CONSTRAINT "EmailThreadPreviewState_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'EmailThreadPreviewState_threadId_fkey'
    ) THEN
        ALTER TABLE "EmailThreadPreviewState"
        ADD CONSTRAINT "EmailThreadPreviewState_threadId_fkey"
        FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
