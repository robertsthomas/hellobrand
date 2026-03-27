-- CreateTable
CREATE TABLE "InvoiceRecord" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "draftSavedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "currency" TEXT,
    "subtotal" DOUBLE PRECISION,
    "notes" TEXT,
    "billToJson" JSONB NOT NULL,
    "issuerJson" JSONB NOT NULL,
    "lineItemsJson" JSONB NOT NULL,
    "pdfDocumentId" TEXT,
    "manualNumberOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReminderTouchpoint" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "sendOn" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceReminderTouchpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRecord_dealId_key" ON "InvoiceRecord"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRecord_userId_invoiceNumber_key" ON "InvoiceRecord"("userId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceRecord_userId_status_updatedAt_idx" ON "InvoiceRecord"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReminderTouchpoint_dealId_offsetDays_key" ON "InvoiceReminderTouchpoint"("dealId", "offsetDays");

-- CreateIndex
CREATE INDEX "InvoiceReminderTouchpoint_userId_status_sendOn_idx" ON "InvoiceReminderTouchpoint"("userId", "status", "sendOn");

-- CreateIndex
CREATE INDEX "InvoiceReminderTouchpoint_dealId_status_sendOn_idx" ON "InvoiceReminderTouchpoint"("dealId", "status", "sendOn");

-- AddForeignKey
ALTER TABLE "InvoiceRecord" ADD CONSTRAINT "InvoiceRecord_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRecord" ADD CONSTRAINT "InvoiceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminderTouchpoint" ADD CONSTRAINT "InvoiceReminderTouchpoint_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminderTouchpoint" ADD CONSTRAINT "InvoiceReminderTouchpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
