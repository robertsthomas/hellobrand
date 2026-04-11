/**
 * This file sections normalized text into smaller extraction chunks.
 * It owns the fallback sectioning pass and persists the section list for later steps.
 */
import { splitIntoSections } from "@/lib/analysis/fallback";
import { logDocumentPipeline } from "@/lib/document-pipeline-shared";
import { getRepository } from "@/lib/repository";
import { saveArtifact } from "@/lib/pipeline/artifacts";
import { assertCurrentRun, executePipelineStep } from "@/lib/pipeline/run-state";

export async function runSectionDocumentStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "section_document" }, async ({ document }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const sections = splitIntoSections(document.normalizedText, document.documentKind);

    logDocumentPipeline("info", "sections_created", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      documentKind: document.documentKind,
      sectionCount: sections.length,
      normalizedChars: document.normalizedText.length,
      runId
    });

    await assertCurrentRun(document.id, runId);
    await getRepository().replaceDocumentSections(document.id, sections);

    await saveArtifact({
      documentId: document.id,
      runId,
      step: "section_document",
      kind: "sections",
      processor: "fallback_sectioner",
      payload: {
        sectionCount: sections.length,
        sections
      }
    });

    return sections;
  });
}
