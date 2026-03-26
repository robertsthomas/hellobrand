-- AlterTable
ALTER TABLE "AiCacheEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "AiCacheEntry_featureKey_taskKey_scopeKey_inputHash_promptVersio" RENAME TO "AiCacheEntry_featureKey_taskKey_scopeKey_inputHash_promptVe_key";
