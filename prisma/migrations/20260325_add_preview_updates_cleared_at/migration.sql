ALTER TABLE "EmailThreadPreviewState"
ADD COLUMN IF NOT EXISTS "previewUpdatesClearedAt" TIMESTAMP(3);
