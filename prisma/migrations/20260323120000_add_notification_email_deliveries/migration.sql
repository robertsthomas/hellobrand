ALTER TABLE "Profile"
ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "NotificationEmailDelivery" (
  "id" TEXT NOT NULL,
  "appNotificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationEmailDelivery_appNotificationId_key"
ON "NotificationEmailDelivery"("appNotificationId");

CREATE INDEX "NotificationEmailDelivery_userId_status_createdAt_idx"
ON "NotificationEmailDelivery"("userId", "status", "createdAt");

ALTER TABLE "NotificationEmailDelivery"
ADD CONSTRAINT "NotificationEmailDelivery_appNotificationId_fkey"
FOREIGN KEY ("appNotificationId") REFERENCES "AppNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationEmailDelivery"
ADD CONSTRAINT "NotificationEmailDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
