import type { AnonymousDealBreakdown } from "@/lib/types";

export const SAMPLE_CONTRACT_BREAKDOWN: AnonymousDealBreakdown = {
  brandName: "Northstar Skin",
  contractTitle: "Northstar Skin Spring Glow Campaign",
  contractSummary:
    "This agreement covers a Spring Glow campaign with Northstar Skin. The brand expects three TikTok posts and two Instagram stories, with the last delivery due by March 30. Payment is listed at $2,500 and the contract gives the brand broad rights without a strong late-payment remedy.",
  paymentAmount: 2500,
  currency: "USD",
  paymentSummary: "Paid within 60 days after the final approved post.",
  deliverables: [
    {
      id: "sample-deliverable-1",
      title: "TikTok post",
      dueDate: "2026-03-18",
      channel: "TikTok",
      quantity: 3,
      status: "pending",
      description: "Three creator-owned TikTok videos for the Spring Glow campaign.",
      source: "Deliverables section"
    },
    {
      id: "sample-deliverable-2",
      title: "Instagram story",
      dueDate: "2026-03-30",
      channel: "Instagram",
      quantity: 2,
      status: "pending",
      description: "Two supporting story frames tied to the campaign launch window.",
      source: "Deliverables section"
    }
  ],
  riskFlags: [
    {
      id: "sample-risk-1",
      title: "Perpetual usage rights",
      detail:
        "The brand can keep using the content forever without additional compensation or a defined end date.",
      severity: "high",
      suggestedAction: "Ask for a fixed usage term or added compensation for extended usage."
    },
    {
      id: "sample-risk-2",
      title: "No late payment leverage",
      detail:
        "Payment is due within 60 days, but the contract does not include a fee, interest, or enforcement language if the payment slips.",
      severity: "medium",
      suggestedAction: "Add a firmer invoice timeline and a late-payment escalation path."
    }
  ],
  documentKind: "contract",
  sourceFileName: "sample-brand-deal.pdf"
};
