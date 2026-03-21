CREATE TYPE "PlanTier" AS ENUM ('basic', 'standard', 'premium');

CREATE TYPE "BillingProvider" AS ENUM ('stripe');

CREATE TYPE "BillingInterval" AS ENUM ('month', 'year');

CREATE TYPE "BillingSubscriptionStatus" AS ENUM (
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);

CREATE TYPE "BillingTrialStatus" AS ENUM (
    'granted',
    'active',
    'converted',
    'expired',
    'canceled',
    'revoked'
);

CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'stripe',
    "billingEmail" TEXT,
    "stripeCustomerId" TEXT,
    "currentPlanTier" "PlanTier",
    "currentPlanInterval" "BillingInterval",
    "currentSubscriptionStatus" "BillingSubscriptionStatus",
    "currentTrialPlanTier" "PlanTier",
    "currentTrialStartedAt" TIMESTAMP(3),
    "currentTrialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'stripe',
    "planTier" "PlanTier" NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "latestInvoiceId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingTrialLedger" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "billingSubscriptionId" TEXT,
    "planTier" "PlanTier" NOT NULL,
    "source" TEXT NOT NULL,
    "status" "BillingTrialStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingTrialLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingUsageLedger" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingUsageLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingAccount_userId_key" ON "BillingAccount"("userId");
CREATE UNIQUE INDEX "BillingAccount_stripeCustomerId_key" ON "BillingAccount"("stripeCustomerId");
CREATE INDEX "BillingAccount_currentPlanTier_currentSubscriptionStatus_idx" ON "BillingAccount"("currentPlanTier", "currentSubscriptionStatus");

CREATE UNIQUE INDEX "BillingSubscription_stripeSubscriptionId_key" ON "BillingSubscription"("stripeSubscriptionId");
CREATE INDEX "BillingSubscription_billingAccountId_status_createdAt_idx" ON "BillingSubscription"("billingAccountId", "status", "createdAt");
CREATE INDEX "BillingSubscription_stripeCustomerId_idx" ON "BillingSubscription"("stripeCustomerId");

CREATE INDEX "BillingTrialLedger_billingAccountId_planTier_status_idx" ON "BillingTrialLedger"("billingAccountId", "planTier", "status");
CREATE INDEX "BillingTrialLedger_billingSubscriptionId_idx" ON "BillingTrialLedger"("billingSubscriptionId");
CREATE INDEX "BillingTrialLedger_endsAt_idx" ON "BillingTrialLedger"("endsAt");

CREATE UNIQUE INDEX "BillingUsageLedger_billingAccountId_featureKey_windowKey_key" ON "BillingUsageLedger"("billingAccountId", "featureKey", "windowKey");
CREATE INDEX "BillingUsageLedger_billingAccountId_periodEnd_idx" ON "BillingUsageLedger"("billingAccountId", "periodEnd");

ALTER TABLE "BillingAccount"
ADD CONSTRAINT "BillingAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingSubscription"
ADD CONSTRAINT "BillingSubscription_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingTrialLedger"
ADD CONSTRAINT "BillingTrialLedger_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingTrialLedger"
ADD CONSTRAINT "BillingTrialLedger_billingSubscriptionId_fkey"
FOREIGN KEY ("billingSubscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingUsageLedger"
ADD CONSTRAINT "BillingUsageLedger_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
