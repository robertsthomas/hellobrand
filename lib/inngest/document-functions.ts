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

    await step.run("extract_text", async () => {
      const stepResult = await pipeline.runExtractTextStep(documentId, runId);
      const result = stepResult.result;
      return {
        parser: result?._debug?.parser ?? null,
        extractedChars: result?.rawText?.length ?? 0,
        pageCount: result?._debug?.pageCount ?? null
      };
    });
    await step.run("classify_document", async () => {
      const stepResult = await pipeline.runClassifyDocumentStep(documentId, runId);
      const result = stepResult.result;
      return {
        documentKind: result?.documentKind ?? null,
        confidence: result?.confidence ?? null
      };
    });
    await step.run("section_document", async () => {
      const stepResult = await pipeline.runSectionDocumentStep(documentId, runId);
      const result = stepResult.result;
      return {
        sectionCount: Array.isArray(result) ? result.length : 0
      };
    });
    await step.run("extract_fields", async () => {
      const stepResult = await pipeline.runExtractFieldsStep(documentId, runId);
      const result = stepResult.result;
      return {
        evidenceCount: Array.isArray(result?.evidence) ? result.evidence.length : 0,
        confidence: result?.confidence ?? null
      };
    });
    await step.run("merge_results", async () => {
      await pipeline.runMergeResultsStep(documentId, runId);
      return { ok: true };
    });
    await step.run("analyze_risks", async () => {
      const stepResult = await pipeline.runAnalyzeRisksStep(documentId, runId);
      const result = stepResult.result;
      return {
        riskCount: Array.isArray(result) ? result.length : 0
      };
    });
    await step.run("generate_summary", async () => {
      const stepResult = await pipeline.runGenerateSummaryStep(documentId, runId);
      const result = stepResult.result;
      return {
        summaryVersion: result?.currentSummary?.version ?? null
      };
    });

    return { ok: true, documentId, runId };
  }
);
