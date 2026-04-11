/**
 * Pipeline artifact persistence and evidence resolution helpers.
 */
import { getRepository } from "@/lib/repository";
import type {
  DocumentArtifactKind,
  DocumentEvidenceSourceType,
  DocumentReviewItemReason,
  DocumentReviewItemRecord,
  DocumentSectionRecord,
  ExtractionPipelineResult,
  FieldEvidence,
  JobType,
  Viewer
} from "@/lib/types";

export function asArtifactPayload(value: unknown): Record<string, unknown> | null {
  if (value == null) {
    return null;
  }

  const normalized = JSON.parse(JSON.stringify(value)) as unknown;
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    return normalized as Record<string, unknown>;
  }

  return { value: normalized };
}

export function getEvidenceSourceType(entry: FieldEvidence): DocumentEvidenceSourceType {
  if (!entry.sectionKey) {
    return "document";
  }

  return entry.sectionKey.startsWith("section:") ? "section" : "vendor_entity";
}

export function resolveSectionId(
  sections: DocumentSectionRecord[],
  sectionKey: string | null | undefined
) {
  if (!sectionKey?.startsWith("section:")) {
    return null;
  }

  return (
    sections.find((section) => `section:${section.chunkIndex}` === sectionKey)?.id ?? null
  );
}

export function buildReviewItems(input: {
  extraction: ExtractionPipelineResult;
  sections: DocumentSectionRecord[];
  artifactId: string | null;
}) {
  const items: Omit<
    DocumentReviewItemRecord,
    "id" | "documentId" | "runId" | "createdAt" | "updatedAt"
  >[] = [];
  const seen = new Set<string>();

  function addReviewItem(
    fieldPath: string,
    reason: DocumentReviewItemReason,
    detail: string,
    confidence: number | null,
    sectionId: string | null
  ) {
    const key = `${fieldPath}:${reason}:${sectionId ?? "none"}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      fieldPath,
      status: "open",
      reason,
      title:
        reason === "conflict"
          ? `Review conflicting ${fieldPath}`
          : `Review low-confidence ${fieldPath}`,
      detail,
      confidence,
      suggestedValue:
        fieldPath in input.extraction.data
          ? (input.extraction.data as Record<string, unknown>)[fieldPath]
          : null,
      currentValue: null,
      sectionId,
      artifactId: input.artifactId
    });
  }

  for (const evidence of input.extraction.evidence ?? []) {
    const confidence = evidence.confidence;
    if (typeof confidence === "number" && confidence >= 0.65) {
      continue;
    }

    addReviewItem(
      evidence.fieldPath,
      "low_confidence",
      evidence.snippet
        ? `Extraction evidence for ${evidence.fieldPath} had low confidence: ${evidence.snippet}`
        : `Extraction evidence for ${evidence.fieldPath} had low confidence.`,
      confidence ?? null,
      resolveSectionId(input.sections, evidence.sectionKey)
    );
  }

  for (const fieldPath of input.extraction.conflicts ?? []) {
    addReviewItem(
      fieldPath,
      "conflict",
      `Multiple competing values were detected for ${fieldPath}.`,
      input.extraction.confidence,
      null
    );
  }

  return items;
}

export async function saveArtifact(input: {
  documentId: string;
  runId: string;
  step: JobType;
  kind: DocumentArtifactKind;
  processor?: string | null;
  payload: unknown;
}) {
  return getRepository().createDocumentArtifact({
    documentId: input.documentId,
    runId: input.runId,
    step: input.step,
    kind: input.kind,
    processor: input.processor ?? null,
    payload: asArtifactPayload(input.payload)
  });
}

export async function saveObservabilityArtifact(input: {
  documentId: string;
  runId: string;
  step: JobType;
  processor?: string | null;
  payload: Record<string, unknown>;
}) {
  try {
    await saveArtifact({
      documentId: input.documentId,
      runId: input.runId,
      step: input.step,
      kind: "observability",
      processor: input.processor ?? null,
      payload: input.payload
    });
  } catch {
    // Observability writes should not fail the pipeline.
  }
}

export async function queueAssistantSnapshotRefresh(viewer: Viewer, dealId?: string | null) {
  const { refreshAssistantSnapshotsForViewer } = await import("@/lib/assistant/snapshots");
  await refreshAssistantSnapshotsForViewer(viewer, { dealId });
}
