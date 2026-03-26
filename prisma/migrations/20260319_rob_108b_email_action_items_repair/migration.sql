-- Repair migration for EmailActionItem, which exists in the datamodel but was
-- never captured in the original Prisma migration history.

CREATE TABLE IF NOT EXISTS "EmailActionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "urgency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailActionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailActionItem_userId_dealId_status_createdAt_idx"
ON "EmailActionItem"("userId", "dealId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "EmailActionItem_userId_status_dueDate_idx"
ON "EmailActionItem"("userId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "EmailActionItem_threadId_idx"
ON "EmailActionItem"("threadId");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailActionItem_dealId_messageId_action_key"
ON "EmailActionItem"("dealId", "messageId", "action");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'EmailActionItem_userId_fkey'
    ) THEN
        ALTER TABLE "EmailActionItem"
        ADD CONSTRAINT "EmailActionItem_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'EmailActionItem_dealId_fkey'
    ) THEN
        ALTER TABLE "EmailActionItem"
        ADD CONSTRAINT "EmailActionItem_dealId_fkey"
        FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'EmailActionItem_threadId_fkey'
    ) THEN
        ALTER TABLE "EmailActionItem"
        ADD CONSTRAINT "EmailActionItem_threadId_fkey"
        FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'EmailActionItem_messageId_fkey'
    ) THEN
        ALTER TABLE "EmailActionItem"
        ADD CONSTRAINT "EmailActionItem_messageId_fkey"
        FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
