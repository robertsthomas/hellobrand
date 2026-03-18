CREATE TABLE "AssistantThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT,
    "scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantContextSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantContextSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantThread_userId_updatedAt_idx" ON "AssistantThread"("userId", "updatedAt");
CREATE INDEX "AssistantThread_dealId_updatedAt_idx" ON "AssistantThread"("dealId", "updatedAt");
CREATE INDEX "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");
CREATE INDEX "AssistantContextSnapshot_dealId_scope_idx" ON "AssistantContextSnapshot"("dealId", "scope");

CREATE UNIQUE INDEX "AssistantContextSnapshot_userId_key_key" ON "AssistantContextSnapshot"("userId", "key");

ALTER TABLE "AssistantThread"
ADD CONSTRAINT "AssistantThread_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantThread"
ADD CONSTRAINT "AssistantThread_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantMessage"
ADD CONSTRAINT "AssistantMessage_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantContextSnapshot"
ADD CONSTRAINT "AssistantContextSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantContextSnapshot"
ADD CONSTRAINT "AssistantContextSnapshot_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
