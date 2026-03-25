-- CreateTable
CREATE TABLE "EmailThreadReplySuggestionCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "threadVersion" TEXT NOT NULL,
    "suggestionsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailThreadReplySuggestionCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailThreadReplySuggestionCache_userId_threadId_threadVersion_key"
ON "EmailThreadReplySuggestionCache"("userId", "threadId", "threadVersion");

-- CreateIndex
CREATE INDEX "EmailThreadReplySuggestionCache_userId_threadId_updatedAt_idx"
ON "EmailThreadReplySuggestionCache"("userId", "threadId", "updatedAt");

-- AddForeignKey
ALTER TABLE "EmailThreadReplySuggestionCache"
ADD CONSTRAINT "EmailThreadReplySuggestionCache_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThreadReplySuggestionCache"
ADD CONSTRAINT "EmailThreadReplySuggestionCache_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
