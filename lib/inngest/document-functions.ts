import { inngest } from "@/lib/inngest/client";

export const documentProcessingFunction = inngest.createFunction(
  {
    id: "document-processing",
    concurrency: 3,
    retries: 2,
    throttle: {
      limit: 10,
      period: "1m"
    }
  },
  { event: "document/process.requested" },
  async ({ event, step }) => {
    const documentId = String(event.data.documentId ?? "");

    if (!documentId) {
      throw new Error("Missing documentId.");
    }

    const result = await step.run("process-document", async () => {
      const { processDocumentById } = await import("@/lib/deals");
      return processDocumentById(documentId);
    });

    return { ok: true, documentId };
  }
);
