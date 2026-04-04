import { FileText } from "lucide-react";
import type { ReactNode } from "react";

export function InvoiceGenerationEmptyState({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/40" />
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
        Generate a workspace invoice
      </h1>
      <p className="mt-3 max-w-lg text-sm text-muted-foreground">
        HelloBrand will prefill the invoice from your workspace amount, dates, and
        deliverables. Review it, edit anything you need, and finalize when ready.
      </p>
      {children}
    </div>
  );
}
