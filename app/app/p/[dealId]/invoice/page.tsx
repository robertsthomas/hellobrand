import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Suspense } from "react";

import { generateInvoiceDraftAction } from "@/app/actions";
import { AssistantTriggerButton } from "@/components/assistant-trigger-button";
import { InvoiceEditorFullPage } from "@/components/invoice-editor-full-page";
import { SubmitButton } from "@/components/submit-button";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getCachedDealForViewer } from "@/lib/cached-data";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { listInvoiceDeliveriesForViewer } from "@/lib/invoices";
import { listEmailAccountsForViewer, listLinkedEmailThreadsForViewerDeal } from "@/lib/email/service";
import { deriveWorkspaceTitleFromFileNames } from "@/lib/workspace-labels";

export default function InvoiceEditorPage({
  params
}: {
  params: Promise<{ dealId: string }>;
}) {
  return (
    <Suspense fallback={<InvoiceEditorSkeleton />}>
      <InvoiceEditorContent params={params} />
    </Suspense>
  );
}

async function InvoiceEditorContent({
  params
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const viewer = await requireViewer();
  const entitlements = await getViewerEntitlements(viewer);
  const aggregate = await getCachedDealForViewer(viewer, dealId);

  if (!aggregate) {
    notFound();
  }

  const { deal, documents, terms } = aggregate;
  const normalized = buildNormalizedIntakeRecord(aggregate);
  const displayLabels = getDisplayDealLabels({
    brandName: normalized?.brandName ?? deal.brandName,
    campaignName: normalized?.contractTitle ?? deal.campaignName
  });
  const displayCampaignName =
    displayLabels.campaignName ??
    normalized?.contractTitle ??
    deriveWorkspaceTitleFromFileNames(documents.map((d) => d.fileName)) ??
    deal.campaignName;

  const hasPremiumInbox = entitlements.features.premium_inbox;
  const [linkedEmailThreads, emailAccounts, invoiceDeliveries] = hasPremiumInbox
    ? await Promise.all([
        listLinkedEmailThreadsForViewerDeal(viewer, dealId),
        listEmailAccountsForViewer(viewer),
        listInvoiceDeliveriesForViewer(viewer, dealId)
      ])
    : [[], [], []];

  const invoiceDocuments = documents.filter((d) => d.documentKind === "invoice");
  const invoice = aggregate.invoiceRecord ?? null;

  const backHref = invoice
    ? `/app/p/${deal.id}?tab=invoices`
    : `/app/p/${deal.id}?tab=deliverables`;

  const paymentTriggerPrompt =
    deal.paymentStatus === "late" || deal.paymentStatus === "awaiting_payment" || deal.paymentStatus === "invoiced"
      ? "Draft a concise creator-professional payment follow-up email for this partnership."
      : `Draft a concise creator-professional email asking the brand to confirm payment timing. Current terms: ${terms?.paymentTerms ?? "not fully clear"}.`;

  // No invoice yet: show generation prompt
  if (!invoice) {
    return (
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </Link>

          <div className="flex flex-col items-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
              Generate a workspace invoice
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">
              HelloBrand will prefill the invoice from your workspace amount, dates, and
              deliverables. Review it, edit anything you need, and finalize when ready.
            </p>
            <form action={generateInvoiceDraftAction} className="mt-6">
              <input type="hidden" name="dealId" value={deal.id} />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <SubmitButton
                  pendingLabel="Generating..."
                  className="inline-flex items-center justify-center bg-primary px-6 py-3 text-sm font-semibold text-white"
                >
                  Generate invoice
                </SubmitButton>
                <AssistantTriggerButton
                  label="Clarify payment timing"
                  trigger={{
                    kind: "payment",
                    sourceId: deal.id,
                    label: "Clarify payment timing",
                    prompt: paymentTriggerPrompt
                  }}
                />
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Invoice exists: show full editor
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {displayCampaignName}
        </Link>

        <InvoiceEditorFullPage
          dealId={deal.id}
          invoice={invoice}
          invoiceDeliveries={invoiceDeliveries}
          invoiceDocuments={invoiceDocuments}
          paymentStatus={deal.paymentStatus}
          paymentTerms={terms?.paymentTerms ?? null}
          linkedThreads={linkedEmailThreads}
          hasPremiumInbox={hasPremiumInbox}
        />
      </div>
    </div>
  );
}

function InvoiceEditorSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-5 w-40 bg-black/[0.04]" />
        <div className="h-10 w-64 bg-black/[0.04]" />
        <div className="grid gap-4 md:grid-cols-4">
          <div className="h-20 bg-black/[0.04] md:col-span-2" />
          <div className="h-20 bg-black/[0.04]" />
          <div className="h-20 bg-black/[0.04]" />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-64 bg-black/[0.04]" />
          <div className="h-64 bg-black/[0.04]" />
        </div>
        <div className="h-40 bg-black/[0.04]" />
      </div>
    </div>
  );
}
