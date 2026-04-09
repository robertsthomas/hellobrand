CREATE TABLE "DocumentRun" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "stepStateJson" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentArtifact" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "processor" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentFieldEvidence" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "snippet" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sectionId" TEXT,
  "artifactId" TEXT,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentFieldEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentReviewItem" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "suggestedValue" JSONB,
  "currentValue" JSONB,
  "sectionId" TEXT,
  "artifactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentRun_documentId_createdAt_idx" ON "DocumentRun"("documentId", "createdAt");
CREATE INDEX "DocumentRun_documentId_updatedAt_idx" ON "DocumentRun"("documentId", "updatedAt");
CREATE INDEX "DocumentArtifact_documentId_runId_createdAt_idx" ON "DocumentArtifact"("documentId", "runId", "createdAt");
CREATE INDEX "DocumentArtifact_runId_step_kind_idx" ON "DocumentArtifact"("runId", "step", "kind");
CREATE INDEX "DocumentFieldEvidence_documentId_fieldPath_createdAt_idx" ON "DocumentFieldEvidence"("documentId", "fieldPath", "createdAt");
CREATE INDEX "DocumentFieldEvidence_runId_fieldPath_createdAt_idx" ON "DocumentFieldEvidence"("runId", "fieldPath", "createdAt");
CREATE INDEX "DocumentReviewItem_documentId_status_createdAt_idx" ON "DocumentReviewItem"("documentId", "status", "createdAt");
CREATE INDEX "DocumentReviewItem_runId_status_createdAt_idx" ON "DocumentReviewItem"("runId", "status", "createdAt");

ALTER TABLE "DocumentRun"
  ADD CONSTRAINT "DocumentRun_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentArtifact"
  ADD CONSTRAINT "DocumentArtifact_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentArtifact_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DocumentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentFieldEvidence"
  ADD CONSTRAINT "DocumentFieldEvidence_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentFieldEvidence_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DocumentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentFieldEvidence_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "DocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentFieldEvidence_artifactId_fkey"
  FOREIGN KEY ("artifactId") REFERENCES "DocumentArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentReviewItem"
  ADD CONSTRAINT "DocumentReviewItem_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentReviewItem_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DocumentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentReviewItem_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "DocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentReviewItem_artifactId_fkey"
  FOREIGN KEY ("artifactId") REFERENCES "DocumentArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
