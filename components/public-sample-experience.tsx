"use client";

import { useEffect, useRef } from "react";

import { PublicContractBreakdown } from "@/components/public-contract-breakdown";
import { PublicFunnelLink } from "@/components/public-funnel-link";
import { SAMPLE_CONTRACT_BREAKDOWN } from "@/lib/public-sample-contract";
import { trackPublicFunnelEvent } from "@/lib/public-funnel-events";

const SAMPLE_CONTRACT_PREVIEW_URL =
  "/sample-documents/northstar-skin-spring-glow-campaign-contract.pdf";

export function PublicSampleExperience() {
  const trackedDepthRef = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (trackedDepthRef.current) {
        return;
      }

      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) {
        return;
      }

      const progress = window.scrollY / total;
      if (progress >= 0.35) {
        trackedDepthRef.current = true;
        trackPublicFunnelEvent("sample_scroll_depth", {
          progress
        });
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#fcfaf7] dark:bg-[#0f1115]">
      <PublicContractBreakdown
        breakdown={SAMPLE_CONTRACT_BREAKDOWN}
        eyebrow="Sample contract"
        title="See the contract breakdown before you upload your own."
        description="This is the exact kind of plain-English output HelloBrand should give a creator before anything gets signed."
        sourceDocument={{
          statusLabel: "Current document being analyzed",
          fileName: SAMPLE_CONTRACT_BREAKDOWN.sourceFileName,
          description:
            "This is the full Northstar Skin Spring Glow campaign agreement hosted directly in the app for side-by-side review.",
          previewUrl: SAMPLE_CONTRACT_PREVIEW_URL,
          buttonLabel: "Open source contract"
        }}
        actions={
          <>
            <PublicFunnelLink
              href="/upload"
              eventName="sample_upload_cta_clicked"
              className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/92"
            >
              Upload My Contract
            </PublicFunnelLink>
            <PublicFunnelLink
              href="/"
              eventName="landing_sample_cta_clicked"
              payload={{ location: "sample_back_home" }}
              className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-6 text-sm font-semibold text-foreground transition hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]"
            >
              Back to home
            </PublicFunnelLink>
          </>
        }
        stickyAction={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Try it with your own contract
              </p>
              <p className="text-sm text-muted-foreground">
                Upload a contract or brief and get the full breakdown instantly.
              </p>
            </div>
            <PublicFunnelLink
              href="/upload"
              eventName="sample_upload_cta_clicked"
              payload={{ location: "sample_sticky" }}
              className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/92"
            >
              Upload contract
            </PublicFunnelLink>
          </div>
        }
      />
    </div>
  );
}
