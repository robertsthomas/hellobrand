-- Baseline for pre-Prisma-history core tables.
-- This migration should be marked as applied in existing environments that
-- already contain these tables so the shadow database can replay the full chain.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "countersignStatus" TEXT NOT NULL,
    "summary" TEXT,
    "legalDisclaimer" TEXT NOT NULL,
    "nextDeliverableDate" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL,
    "rawText" TEXT,
    "normalizedText" TEXT,
    "documentKind" TEXT NOT NULL,
    "classificationConfidence" DOUBLE PRECISION,
    "sourceType" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSection" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageRange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtractionResult" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "conflicts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtractionEvidence" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "sectionId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "documentId" TEXT,
    "body" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealTerms" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "brandName" TEXT,
    "agencyName" TEXT,
    "creatorName" TEXT,
    "campaignName" TEXT,
    "paymentAmount" DOUBLE PRECISION,
    "currency" TEXT,
    "paymentTerms" TEXT,
    "paymentStructure" TEXT,
    "netTermsDays" INTEGER,
    "paymentTrigger" TEXT,
    "deliverables" JSONB NOT NULL,
    "usageRights" TEXT,
    "usageRightsOrganicAllowed" BOOLEAN,
    "usageRightsPaidAllowed" BOOLEAN,
    "whitelistingAllowed" BOOLEAN,
    "usageDuration" TEXT,
    "usageTerritory" TEXT,
    "usageChannels" JSONB NOT NULL,
    "exclusivity" TEXT,
    "exclusivityApplies" BOOLEAN,
    "exclusivityCategory" TEXT,
    "exclusivityDuration" TEXT,
    "exclusivityRestrictions" TEXT,
    "brandCategory" TEXT,
    "competitorCategories" JSONB NOT NULL,
    "restrictedCategories" JSONB NOT NULL,
    "campaignDateWindow" JSONB,
    "disclosureObligations" JSONB NOT NULL,
    "revisions" TEXT,
    "revisionRounds" INTEGER,
    "termination" TEXT,
    "terminationAllowed" BOOLEAN,
    "terminationNotice" TEXT,
    "terminationConditions" TEXT,
    "governingLaw" TEXT,
    "notes" TEXT,
    "manuallyEditedFields" JSONB NOT NULL DEFAULT '[]',
    "briefData" JSONB,
    "pendingExtraction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealTerms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskFlag" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "evidence" JSONB NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceType" TEXT,
    "sourceMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "inferredRole" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "creatorLegalName" TEXT,
    "businessName" TEXT,
    "contactEmail" TEXT,
    "preferredSignature" TEXT,
    "payoutDetails" TEXT,
    "defaultCurrency" TEXT,
    "reminderLeadDays" INTEGER,
    "conflictAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "accentColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileAuditEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "changedFields" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntakeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "inputSource" TEXT,
    "draftBrandName" TEXT,
    "draftCampaignName" TEXT,
    "draftNotes" TEXT,
    "draftPastedText" TEXT,
    "draftPastedTextTitle" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntakeDocument" (
    "id" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntakeBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntakeBatchGroup" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "intakeSessionId" TEXT,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "documentIds" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeBatchGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Document_dealId_idx" ON "Document"("dealId");
CREATE INDEX "DocumentSection_documentId_chunkIndex_idx" ON "DocumentSection"("documentId", "chunkIndex");
CREATE UNIQUE INDEX "ExtractionResult_documentId_key" ON "ExtractionResult"("documentId");
CREATE INDEX "ExtractionEvidence_documentId_idx" ON "ExtractionEvidence"("documentId");
CREATE INDEX "Summary_dealId_idx" ON "Summary"("dealId");
CREATE UNIQUE INDEX "DealTerms_dealId_key" ON "DealTerms"("dealId");
CREATE INDEX "RiskFlag_dealId_idx" ON "RiskFlag"("dealId");
CREATE INDEX "EmailDraft_dealId_idx" ON "EmailDraft"("dealId");
CREATE UNIQUE INDEX "EmailDraft_dealId_intent_key" ON "EmailDraft"("dealId", "intent");
CREATE INDEX "BrandContact_userId_dealId_idx" ON "BrandContact"("userId", "dealId");
CREATE UNIQUE INDEX "BrandContact_userId_dealId_email_key" ON "BrandContact"("userId", "dealId", "email");
CREATE INDEX "Job_dealId_documentId_idx" ON "Job"("dealId", "documentId");
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE INDEX "ProfileAuditEvent_profileId_createdAt_idx" ON "ProfileAuditEvent"("profileId", "createdAt");
CREATE UNIQUE INDEX "IntakeSession_dealId_key" ON "IntakeSession"("dealId");
CREATE INDEX "IntakeSession_userId_status_idx" ON "IntakeSession"("userId", "status");
CREATE UNIQUE INDEX "IntakeDocument_documentId_key" ON "IntakeDocument"("documentId");
CREATE INDEX "IntakeDocument_intakeSessionId_idx" ON "IntakeDocument"("intakeSessionId");
CREATE UNIQUE INDEX "PaymentRecord_dealId_key" ON "PaymentRecord"("dealId");
CREATE INDEX "IntakeBatch_userId_idx" ON "IntakeBatch"("userId");
CREATE UNIQUE INDEX "IntakeBatchGroup_intakeSessionId_key" ON "IntakeBatchGroup"("intakeSessionId");
CREATE INDEX "IntakeBatchGroup_batchId_idx" ON "IntakeBatchGroup"("batchId");

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSection" ADD CONSTRAINT "DocumentSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractionResult" ADD CONSTRAINT "ExtractionResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractionEvidence" ADD CONSTRAINT "ExtractionEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractionEvidence" ADD CONSTRAINT "ExtractionEvidence_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealTerms" ADD CONSTRAINT "DealTerms_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskFlag" ADD CONSTRAINT "RiskFlag_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandContact" ADD CONSTRAINT "BrandContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandContact" ADD CONSTRAINT "BrandContact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileAuditEvent" ADD CONSTRAINT "ProfileAuditEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeDocument" ADD CONSTRAINT "IntakeDocument_intakeSessionId_fkey" FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeDocument" ADD CONSTRAINT "IntakeDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeBatch" ADD CONSTRAINT "IntakeBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeBatchGroup" ADD CONSTRAINT "IntakeBatchGroup_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IntakeBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeBatchGroup" ADD CONSTRAINT "IntakeBatchGroup_intakeSessionId_fkey" FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
