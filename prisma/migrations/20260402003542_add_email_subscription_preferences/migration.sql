-- CreateEnum
CREATE TYPE "EmailSubscriptionCategory" AS ENUM ('product_updates');

-- CreateTable
CREATE TABLE "EmailSubscriptionPreference" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" "EmailSubscriptionCategory" NOT NULL,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSubscriptionPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSubscriptionPreference_category_isSubscribed_idx" ON "EmailSubscriptionPreference"("category", "isSubscribed");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSubscriptionPreference_email_category_key" ON "EmailSubscriptionPreference"("email", "category");
