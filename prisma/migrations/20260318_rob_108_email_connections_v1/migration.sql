CREATE TABLE "ConnectedEmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectedEmailAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "participantsJson" JSONB NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "isContractRelated" BOOLEAN NOT NULL DEFAULT false,
    "aiSummary" TEXT,
    "aiSummaryUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "internetMessageId" TEXT,
    "fromJson" JSONB NOT NULL,
    "toJson" JSONB NOT NULL,
    "ccJson" JSONB NOT NULL,
    "bccJson" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "direction" TEXT NOT NULL,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "rawStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "providerAttachmentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSyncState" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerCursor" TEXT,
    "providerSubscriptionId" TEXT,
    "subscriptionExpiresAt" TIMESTAMP(3),
    "lastHistoryId" TEXT,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSyncState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealEmailLink" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "linkSource" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEmailLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectedEmailAccount_userId_provider_providerAccountId_key" ON "ConnectedEmailAccount"("userId", "provider", "providerAccountId");
CREATE INDEX "ConnectedEmailAccount_userId_provider_status_idx" ON "ConnectedEmailAccount"("userId", "provider", "status");
CREATE UNIQUE INDEX "EmailThread_accountId_providerThreadId_key" ON "EmailThread"("accountId", "providerThreadId");
CREATE INDEX "EmailThread_accountId_lastMessageAt_idx" ON "EmailThread"("accountId", "lastMessageAt");
CREATE UNIQUE INDEX "EmailMessage_threadId_providerMessageId_key" ON "EmailMessage"("threadId", "providerMessageId");
CREATE INDEX "EmailMessage_threadId_receivedAt_idx" ON "EmailMessage"("threadId", "receivedAt");
CREATE UNIQUE INDEX "EmailAttachment_messageId_providerAttachmentId_key" ON "EmailAttachment"("messageId", "providerAttachmentId");
CREATE INDEX "EmailAttachment_messageId_idx" ON "EmailAttachment"("messageId");
CREATE UNIQUE INDEX "EmailSyncState_accountId_key" ON "EmailSyncState"("accountId");
CREATE UNIQUE INDEX "DealEmailLink_dealId_threadId_key" ON "DealEmailLink"("dealId", "threadId");
CREATE INDEX "DealEmailLink_threadId_idx" ON "DealEmailLink"("threadId");

ALTER TABLE "ConnectedEmailAccount"
ADD CONSTRAINT "ConnectedEmailAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailThread"
ADD CONSTRAINT "EmailThread_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ConnectedEmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailMessage"
ADD CONSTRAINT "EmailMessage_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailAttachment"
ADD CONSTRAINT "EmailAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailSyncState"
ADD CONSTRAINT "EmailSyncState_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ConnectedEmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealEmailLink"
ADD CONSTRAINT "DealEmailLink_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealEmailLink"
ADD CONSTRAINT "DealEmailLink_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
