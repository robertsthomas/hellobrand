import { uploadDocumentsAction } from "@/app/actions";
import type { DocumentRecord } from "@/lib/types";
import { humanizeToken } from "@/lib/utils";

export function UploadContractForm({
  dealId,
  documents
}: {
  dealId: string;
  documents: DocumentRecord[];
}) {
  const latestDocument = documents[0] ?? null;

  return (
    <form
      action={uploadDocumentsAction}
      className="rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-panel"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-serif text-3xl text-ocean">Add documents</h2>
          <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
            Upload contracts, deliverables briefs, decks, invoices, or paste an
            email thread. HelloBrand classifies each document and extracts the
            parts creators need most.
          </p>
          {latestDocument ? (
            <p className="mt-3 text-sm text-black/60 dark:text-white/65">
              Latest upload:{" "}
              <span className="font-semibold">{latestDocument.fileName}</span>{" "}
              <span className="text-black/45 dark:text-white/45">
                ({humanizeToken(latestDocument.documentKind)})
              </span>
            </p>
          ) : null}
        </div>
        <div className="rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-semibold capitalize text-black/65 dark:text-white/70">
          {latestDocument?.processingStatus ?? "no documents"}
        </div>
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Files
            <input
              className="block w-full rounded-[1.5rem] border border-dashed border-black/20 dark:border-white/15 bg-sand/40 dark:bg-white/[0.04] px-4 py-4 text-sm"
              type="file"
              name="documents"
              multiple
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            />
          </label>
          <p className="text-xs text-black/45 dark:text-white/45">
            Text-based PDFs and DOCX files work best. Image-only scans may fail
            and will be flagged for manual review.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
            Paste anything from the brand
            <textarea
              className="min-h-32 rounded-[1.5rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-4 text-sm"
              name="pastedText"
              placeholder="Paste a contract excerpt, email thread, brief, deliverables notes, or any other plain-text context here."
            />
          </label>
          <p className="text-xs text-black/45 dark:text-white/45">
            Paste whatever you have. HelloBrand will organize contract terms,
            email clarifications, and brand notes during analysis.
          </p>
        </div>
      </div>

      <button className="mt-5 rounded-full bg-clay px-5 py-3 text-sm font-semibold text-white">
        Process documents
      </button>

      {documents.some((document) => document.errorMessage) ? (
        <div className="mt-4 grid gap-2">
          {documents
            .filter((document) => document.errorMessage)
            .map((document) => (
              <p
                key={document.id}
                className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay"
              >
                {document.fileName}: {document.errorMessage}
              </p>
            ))}
        </div>
      ) : null}
    </form>
  );
}
