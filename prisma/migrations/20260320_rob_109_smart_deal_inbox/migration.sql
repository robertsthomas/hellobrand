CREATE TABLE "EmailDealCandidateMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasonsJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDealCandidateMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDealEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDealEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDealTermSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "patchJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDealTermSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDealCandidateMatch_dealId_threadId_key" ON "EmailDealCandidateMatch"("dealId", "threadId");
CREATE INDEX "EmailDealCandidateMatch_userId_status_updatedAt_idx" ON "EmailDealCandidateMatch"("userId", "status", "updatedAt");
CREATE INDEX "EmailDealCandidateMatch_threadId_idx" ON "EmailDealCandidateMatch"("threadId");

CREATE UNIQUE INDEX "EmailDealEvent_dealId_messageId_category_key" ON "EmailDealEvent"("dealId", "messageId", "category");
CREATE INDEX "EmailDealEvent_userId_dealId_createdAt_idx" ON "EmailDealEvent"("userId", "dealId", "createdAt");
CREATE INDEX "EmailDealEvent_threadId_createdAt_idx" ON "EmailDealEvent"("threadId", "createdAt");

CREATE UNIQUE INDEX "EmailDealTermSuggestion_dealId_messageId_key" ON "EmailDealTermSuggestion"("dealId", "messageId");
CREATE INDEX "EmailDealTermSuggestion_userId_dealId_status_createdAt_idx" ON "EmailDealTermSuggestion"("userId", "dealId", "status", "createdAt");
CREATE INDEX "EmailDealTermSuggestion_threadId_status_createdAt_idx" ON "EmailDealTermSuggestion"("threadId", "status", "createdAt");

ALTER TABLE "EmailDealCandidateMatch"
ADD CONSTRAINT "EmailDealCandidateMatch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealCandidateMatch"
ADD CONSTRAINT "EmailDealCandidateMatch_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealCandidateMatch"
ADD CONSTRAINT "EmailDealCandidateMatch_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealEvent"
ADD CONSTRAINT "EmailDealEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealEvent"
ADD CONSTRAINT "EmailDealEvent_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealEvent"
ADD CONSTRAINT "EmailDealEvent_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealEvent"
ADD CONSTRAINT "EmailDealEvent_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealTermSuggestion"
ADD CONSTRAINT "EmailDealTermSuggestion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealTermSuggestion"
ADD CONSTRAINT "EmailDealTermSuggestion_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealTermSuggestion"
ADD CONSTRAINT "EmailDealTermSuggestion_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDealTermSuggestion"
ADD CONSTRAINT "EmailDealTermSuggestion_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
