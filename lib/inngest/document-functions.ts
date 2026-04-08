import { inngest } from "@/lib/inngest/client";

export const documentProcessingFunction = inngest.createFunction(
  {
    id: "document-processing",
    concurrency: 3,
    retries: 2,
    singleton: {
      key: "event.data.documentId",
      mode: "cancel"
    },
    throttle: {
      limit: 10,
      period: "1m"
    },
    onFailure: async ({ event, error }) => {
      const payload = event.data as { documentId?: string; runId?: string } | undefined;
      const documentId = String(payload?.documentId ?? "");
      const runId = String(payload?.runId ?? "");

      if (!documentId || !runId) {
        return { ok: false };
      }

      const { failDocumentProcessingRun, getDocumentPipelineFailedStep } = await import(
        "@/lib/pipeline-steps"
      );

      await failDocumentProcessingRun({
        documentId,
        runId,
        message: error instanceof Error ? error.message : "Document processing failed.",
        failedStep: getDocumentPipelineFailedStep(error)
      });

      return { ok: false, documentId, runId };
    }
  },
  { event: "document/process.requested" },
  async ({ event, step }) => {
    const documentId = String(event.data.documentId ?? "");
    const runId = String(event.data.runId ?? "");

    if (!documentId || !runId) {
      throw new Error("Missing documentId or runId.");
    }

    const pipeline = await import("@/lib/pipeline-steps");

    await step.run("extract_text", () => pipeline.runExtractTextStep(documentId, runId));
    await step.run("classify_document", () =>
      pipeline.runClassifyDocumentStep(documentId, runId)
    );
    await step.run("section_document", () =>
      pipeline.runSectionDocumentStep(documentId, runId)
    );
    await step.run("extract_fields", () =>
      pipeline.runExtractFieldsStep(documentId, runId)
    );
    await step.run("merge_results", () =>
      pipeline.runMergeResultsStep(documentId, runId)
    );
    await step.run("analyze_risks", () =>
      pipeline.runAnalyzeRisksStep(documentId, runId)
    );
    await step.run("generate_summary", () =>
      pipeline.runGenerateSummaryStep(documentId, runId)
    );

    return { ok: true, documentId, runId };
  }
);
