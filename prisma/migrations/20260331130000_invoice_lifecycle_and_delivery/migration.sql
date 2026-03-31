-- AlterTable
ALTER TABLE "InvoiceRecord"
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "lastSentThreadId" TEXT,
ADD COLUMN "lastSentMessageId" TEXT,
ADD COLUMN "lastSentAccountId" TEXT,
ADD COLUMN "lastSentToEmail" TEXT;

-- CreateTable
CREATE TABLE "InvoiceDeliveryRecord" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "threadId" TEXT,
    "messageId" TEXT,
    "accountId" TEXT,
    "toEmail" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceDeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceDeliveryRecord_invoiceId_sentAt_idx" ON "InvoiceDeliveryRecord"("invoiceId", "sentAt");

-- CreateIndex
CREATE INDEX "InvoiceDeliveryRecord_dealId_sentAt_idx" ON "InvoiceDeliveryRecord"("dealId", "sentAt");

-- CreateIndex
CREATE INDEX "InvoiceDeliveryRecord_userId_sentAt_idx" ON "InvoiceDeliveryRecord"("userId", "sentAt");

-- Backfill legacy invoice-related payment state to "not_invoiced".
UPDATE "PaymentRecord"
SET "status" = 'not_invoiced'
WHERE "status" = 'invoiced';

UPDATE "Deal"
SET "paymentStatus" = 'not_invoiced'
WHERE "paymentStatus" = 'invoiced';

-- AddForeignKey
ALTER TABLE "InvoiceDeliveryRecord"
ADD CONSTRAINT "InvoiceDeliveryRecord_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "InvoiceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDeliveryRecord"
ADD CONSTRAINT "InvoiceDeliveryRecord_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDeliveryRecord"
ADD CONSTRAINT "InvoiceDeliveryRecord_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
