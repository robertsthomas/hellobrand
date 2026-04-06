-- CreateTable
CREATE TABLE "FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "message" TEXT,
    "pagePath" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL,
    "dealId" TEXT,
    "requestedFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT NOT NULL,
    "userFollowUpEmailMessageId" TEXT,
    "userFollowUpEmailSentAt" TIMESTAMP(3),
    "supportEmailMessageId" TEXT,
    "supportEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackSubmission_userId_createdAt_idx" ON "FeedbackSubmission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_dealId_createdAt_idx" ON "FeedbackSubmission"("dealId", "createdAt");

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
