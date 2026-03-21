CREATE TYPE "BillingWebhookEventStatus" AS ENUM (
    'pending',
    'processing',
    'processed',
    'ignored',
    'failed'
);

CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT,
    "provider" "BillingProvider" NOT NULL DEFAULT 'stripe',
    "stripeEventId" TEXT NOT NULL,
    "stripeEventType" TEXT NOT NULL,
    "apiVersion" TEXT,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "status" "BillingWebhookEventStatus" NOT NULL DEFAULT 'pending',
    "processingRuns" INTEGER NOT NULL DEFAULT 0,
    "lastReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingWebhookEvent_stripeEventId_key" ON "BillingWebhookEvent"("stripeEventId");
CREATE INDEX "BillingWebhookEvent_billingAccountId_createdAt_idx" ON "BillingWebhookEvent"("billingAccountId", "createdAt");
CREATE INDEX "BillingWebhookEvent_status_updatedAt_idx" ON "BillingWebhookEvent"("status", "updatedAt");

ALTER TABLE "BillingWebhookEvent"
ADD CONSTRAINT "BillingWebhookEvent_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
