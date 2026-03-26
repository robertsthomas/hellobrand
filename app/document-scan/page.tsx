import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DocumentScanShowcase } from "@/components/document-scan-showcase";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Document Scan Demo | HelloBrand",
  description: "Animated document scan and AI summary demo.",
  alternates: {
    canonical: "/document-scan"
  },
  openGraph: {
    title: "Document Scan Demo | HelloBrand",
    description: "Animated document scan and AI summary demo.",
    url: absoluteUrl("/document-scan"),
    siteName: "HelloBrand",
    type: "website"
  }
};

export default function DocumentScanPage() {
  return (
    <main className="min-h-screen bg-[#f7f2ea] px-5 py-6 text-foreground sm:px-6 lg:px-8 dark:bg-[#0f1412]">
      <div className="mx-auto max-w-[1240px]">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70 dark:text-[#8ec6b1]/80">
            Prototype
          </p>
          <h1 className="mt-3 max-w-[14ch] text-[2.2rem] font-bold leading-[0.95] tracking-[-0.05em] text-[#1a2634] sm:text-[3rem] dark:text-[#eef2f5]">
            Document scan to AI summary animation
          </h1>
          <p className="mt-4 max-w-[56ch] text-sm leading-6 text-[#5d6876] sm:text-base dark:text-[#aab3bf]">
            Dedicated test page for the upload, scan, and summary motion sequence.
          </p>
        </div>

        <div className="mt-8">
          <DocumentScanShowcase />
        </div>
      </div>
    </main>
  );
}
