import { inngest } from "@/lib/inngest/client";
import { processDocumentById } from "@/lib/deals";

export const processContractFunction = inngest.createFunction(
  { id: "process-deal-document" },
  { event: "documents/process.requested" },
  async ({ event, step }) => {
    const documentId = String(event.data.documentId ?? "");

    if (!documentId) {
      throw new Error("Missing documentId.");
    }

    const aggregate = await step.run("process-document", async () =>
      processDocumentById(documentId)
    );

    return {
      ok: true,
      documentId,
      dealId: aggregate?.deal.id ?? null
    };
  }
);
