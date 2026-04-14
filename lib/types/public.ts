/**
 * Public upload and anonymous analysis record types.
 * Keep authenticated workspace state and internal persistence orchestration out of this module.
 */

import type { DeliverableItem } from "./deals";
import type { DocumentAnalysisResult, DocumentKind } from "./documents";

export interface AnonymousDealBreakdown {
  brandName: string | null;
  contractTitle: string | null;
  contractSummary: string | null;
  paymentAmount: number | null;
  currency: string | null;
  paymentSummary: string | null;
  deliverables: DeliverableItem[];
  riskFlags: Array<{
    id: string;
    title: string;
    detail: string;
    severity: "low" | "medium" | "high";
    suggestedAction: string | null;
  }>;
  documentKind: DocumentKind;
  sourceFileName: string;
}

export interface AnonymousAnalysisSessionRecord {
  id: string;
  token: string;
  fileName: string;
  mimeType: string;
  sourceType: "file" | "pasted_text";
  visitorId: string | null;
  ipHash: string | null;
  fileHash: string | null;
  storagePath: string | null;
  rawText: string | null;
  normalizedText: string;
  analysis: DocumentAnalysisResult;
  breakdown: AnonymousDealBreakdown;
  claimedByUserId: string | null;
  claimedDealId: string | null;
  claimedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}
