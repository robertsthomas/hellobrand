import type { DealAggregate, DraftIntent } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const intentCopy: Record<
  DraftIntent,
  {
    subject: (deal: DealAggregate) => string;
    body: (deal: DealAggregate) => string;
  }
> = {
  "clarify-clause": {
    subject: (deal) => `${deal.deal.brandName} agreement clarification`,
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nThanks for sending over the agreement for ${deal.deal.campaignName}. I’m reviewing the current draft and wanted to clarify one clause before moving forward. Could you confirm how the current language is intended to work in practice?\n\nI’d especially appreciate clarity around:\n- usage rights and where the content can run\n- payment timing and approval milestones\n- any exclusivity limitations tied to the campaign\n\nOnce I have that context, I should be able to move quickly on next steps.\n\nBest,\nCreator`
  },
  "request-faster-payment": {
    subject: () => "Payment terms adjustment request",
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nThanks again for sending the agreement. I noticed the payment terms are currently ${deal.terms?.paymentTerms ?? "noted in the contract"}. Would you be open to revising them to Net 15 so the payment timing better aligns with production and posting?\n\nEverything else looks close, and I’d be happy to keep moving once we align on timing.\n\nBest,\nCreator`
  },
  "limit-usage-rights": {
    subject: () => "Usage rights adjustment",
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nI’m excited about ${deal.deal.campaignName}. Before signing, I wanted to revisit the usage-rights section. The current draft appears to include ${deal.terms?.usageRights ?? "broad usage rights"}, and I’d love to narrow that to organic reposting only or agree on a shorter paid usage window with separate compensation if ads are needed.\n\nIf helpful, I can suggest a revised clause.\n\nBest,\nCreator`
  },
  "clarify-deadline": {
    subject: () => "Deliverable timeline clarification",
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nThanks for sharing the agreement. I’m reviewing the deliverable timeline and wanted to confirm the posting schedule. I currently have the next due date as ${formatDate(deal.deal.nextDeliverableDate)}. Can you confirm whether that is the final deadline and whether there is flexibility if approvals run long?\n\nI want to make sure we’re aligned before I lock in production timing.\n\nBest,\nCreator`
  },
  "payment-reminder": {
    subject: () => "Payment follow-up",
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nI wanted to follow up on the payment for ${deal.deal.campaignName}. I currently have the deal value recorded as ${formatCurrency(
        deal.terms?.paymentAmount ?? null,
        deal.terms?.currency ?? "USD"
      )}, and I wanted to check whether there is anything else you need from me to complete payment.\n\nThanks so much,\nCreator`
  },
  "request-contract-revisions": {
    subject: () => "Requested revisions to agreement",
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nThanks again for the draft agreement. I reviewed everything and have a few revisions I’d like to request before signing, especially around ${deal.terms?.usageRights ?? "usage rights"} and ${deal.terms?.paymentTerms ?? "payment timing"}.\n\nIf you’d like, I can send exact redlines or revised wording for the sections that need tightening.\n\nBest,\nCreator`
  },
  "confirm-deliverables": {
    subject: () => "Deliverables confirmation",
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nBefore I move into production, I wanted to confirm that I’m working from the right deliverables list for ${deal.deal.campaignName}. I currently have:\n${(deal.terms?.deliverables ?? [])
        .map((item) => `- ${item.quantity ?? "TBD"} ${item.title} due ${formatDate(item.dueDate)}`)
        .join("\n") || "- Deliverables still being confirmed"}\n\nPlease let me know if anything should be adjusted.\n\nBest,\nCreator`
  },
  "confirm-revised-brief": {
    subject: () => "Revised brief received",
    body: (deal) =>
      `Hi ${deal.deal.brandName} team,\n\nThanks for sending the revised brief for ${deal.deal.campaignName}. I’ve received it and I’m reviewing the updated requirements now. If there are any specific changes you want me to prioritize, feel free to send them over.\n\nBest,\nCreator`
  }
};

export function generateEmailDraft(
  deal: DealAggregate,
  intent: DraftIntent,
  senderName = "Creator"
) {
  const copy = intentCopy[intent];

  if (!copy) {
    throw new Error("Unsupported email draft intent.");
  }

  const amountLine =
    deal.terms?.paymentAmount !== null && deal.terms?.paymentAmount !== undefined
      ? `Deal value: ${formatCurrency(
          deal.terms.paymentAmount,
          deal.terms.currency ?? "USD"
        )}\n`
      : "";

  return {
    subject: copy.subject(deal),
    body: `${amountLine}${copy.body(deal).replace(/\nCreator$/u, `\n${senderName}`)}`
  };
}
