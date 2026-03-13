import { reprocessDocumentAction } from "@/app/actions";
import type {
  DocumentSectionRecord,
  DocumentRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord,
  SummaryRecord
} from "@/lib/types";
import { humanizeToken } from "@/lib/utils";

export function DocumentsPanel({
  dealId,
  documents,
  documentSections,
  extractionEvidence,
  extractionResults,
  summaries
}: {
  dealId: string;
  documents: DocumentRecord[];
  documentSections: DocumentSectionRecord[];
  extractionEvidence: ExtractionEvidenceRecord[];
  extractionResults: ExtractionResultRecord[];
  summaries: SummaryRecord[];
}) {
  return (
    <section className="rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-panel">
      <div>
        <h2 className="font-serif text-3xl text-ocean">Documents</h2>
        <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
          Every file in the deal workspace is classified, processed, and stored
          with its own extraction output and retry state.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        {documents.map((document) => {
          const extraction = extractionResults.find(
            (result) => result.documentId === document.id
          );
          const summary = summaries.find((entry) => entry.documentId === document.id);
          const documentEvidence = extractionEvidence
            .filter((entry) => entry.documentId === document.id)
            .slice(0, 3);
          const documentSectionTitles = new Map(
            documentSections
              .filter((section) => section.documentId === document.id)
              .map((section) => [section.id, section.title])
          );

          return (
            <article
              key={document.id}
              className="rounded-[1.5rem] border border-black/5 dark:border-white/10 bg-sand/50 dark:bg-white/[0.05] p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
                    {humanizeToken(document.documentKind)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-black/80 dark:text-white/85">
                    {document.fileName}
                  </h3>
                  <p className="mt-2 text-sm text-black/60 dark:text-white/65">
                    Status: {humanizeToken(document.processingStatus)}
                  </p>
                  {document.errorMessage ? (
                    <p className="mt-3 rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay">
                      {document.errorMessage}
                    </p>
                  ) : null}
                </div>

                {document.processingStatus === "failed" ? (
                  <form action={reprocessDocumentAction}>
                    <input type="hidden" name="dealId" value={dealId} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <button className="rounded-full border border-black/10 dark:border-white/12 bg-white dark:bg-white/10 dark:text-white px-4 py-2 text-sm font-semibold text-ink">
                      Retry processing
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] bg-white/80 dark:bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    Extracted highlights
                  </div>
                  <p className="mt-3 text-sm leading-6 text-black/65 dark:text-white/70">
                    {summary?.body ??
                      "This document has not produced a summary yet."}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-white/80 dark:bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    Extraction status
                  </div>
                  <p className="mt-3 text-sm leading-6 text-black/65 dark:text-white/70">
                    {extraction
                      ? `Schema ${extraction.schemaVersion} • ${extraction.model} • ${extraction.confidence ? `${Math.round(extraction.confidence * 100)}% confidence` : "confidence not set"}`
                      : "No extraction result stored yet."}
                  </p>
                  {document.classificationConfidence ? (
                    <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                      Document classification confidence:{" "}
                      {Math.round(document.classificationConfidence * 100)}%
                    </p>
                  ) : null}
                  {extraction?.conflicts.length ? (
                    <div className="mt-3 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-clay">
                        Review conflicts
                      </p>
                      <p className="mt-1 text-xs leading-5 text-black/65 dark:text-white/70">
                        Conflicting extracted fields:{" "}
                        {extraction.conflicts.map(humanizeToken).join(", ")}.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {documentEvidence.length > 0 ? (
                <div className="mt-4 rounded-[1.25rem] bg-white/80 dark:bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    Evidence samples
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {documentEvidence.map((entry) => (
                      <div key={entry.id} className="rounded-2xl bg-sand/50 dark:bg-white/[0.05] px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
                          {documentSectionTitles.get(entry.sectionId ?? "") ??
                            humanizeToken(entry.fieldPath)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-black/60 dark:text-white/65">
                          {entry.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {documents.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 dark:border-white/12 bg-white/70 dark:bg-white/[0.05] p-5 text-sm text-black/60 dark:text-white/65">
            No documents yet. Upload a contract, brief, deck, invoice, or pasted
            email thread to start the workspace.
          </div>
        ) : null}
      </div>
    </section>
  );
}
