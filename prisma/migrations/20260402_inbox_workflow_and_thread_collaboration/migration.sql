ALTER TABLE "EmailThread"
ADD COLUMN "workflowState" TEXT NOT NULL DEFAULT 'unlinked',
ADD COLUMN "draftUpdatedAt" TIMESTAMP(3);

ALTER TABLE "DealEmailLink"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'reference';

CREATE TABLE "EmailThreadDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailThreadDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailThreadNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailThreadNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailThreadDraft_userId_threadId_key" ON "EmailThreadDraft"("userId", "threadId");
CREATE INDEX "EmailThreadDraft_threadId_updatedAt_idx" ON "EmailThreadDraft"("threadId", "updatedAt");
CREATE INDEX "EmailThreadNote_threadId_createdAt_idx" ON "EmailThreadNote"("threadId", "createdAt");
CREATE INDEX "EmailThreadNote_userId_threadId_createdAt_idx" ON "EmailThreadNote"("userId", "threadId", "createdAt");
CREATE INDEX "EmailThread_accountId_workflowState_lastMessageAt_idx" ON "EmailThread"("accountId", "workflowState", "lastMessageAt");
CREATE INDEX "DealEmailLink_threadId_role_idx" ON "DealEmailLink"("threadId", "role");
CREATE UNIQUE INDEX "DealEmailLink_one_primary_per_thread_idx"
ON "DealEmailLink"("threadId")
WHERE "role" = 'primary';

ALTER TABLE "EmailThreadDraft"
ADD CONSTRAINT "EmailThreadDraft_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailThreadDraft"
ADD CONSTRAINT "EmailThreadDraft_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailThreadNote"
ADD CONSTRAINT "EmailThreadNote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailThreadNote"
ADD CONSTRAINT "EmailThreadNote_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH ranked_links AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "threadId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS link_rank
  FROM "DealEmailLink"
)
UPDATE "DealEmailLink" AS link
SET "role" = CASE WHEN ranked_links.link_rank = 1 THEN 'primary' ELSE 'reference' END
FROM ranked_links
WHERE ranked_links."id" = link."id";

UPDATE "EmailThread" AS thread
SET "workflowState" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "DealEmailLink" AS link
    WHERE link."threadId" = thread."id"
      AND link."role" = 'primary'
  ) THEN 'needs_review'
  ELSE 'unlinked'
END;
