import { describe, expect, test } from "vitest";

import {
  clusterDocuments,
  extractBrandFromFileName,
  extractBrandFromText
} from "@/lib/intake-clustering";

describe("intake clustering", () => {
  test("extracts a brand from contract text cues", () => {
    expect(
      extractBrandFromText(
        "Creator agreement\nBrand: Amazon Kids\nDeliverables include 1 Reel."
      )
    ).toBe("Amazon Kids");
  });

  test("extracts a cleaned brand name from filenames", () => {
    expect(
      extractBrandFromFileName(
        "Amazon-Kids_campaign_brief_final_signed.pdf"
      )
    ).toBe("Amazon Kids");
  });

  test("clusters related documents under the same detected brand", () => {
    const result = clusterDocuments([
      {
        documentId: "doc-contract",
        fileName: "nimbus-contract.pdf",
        rawText: "Brand: Nimbus Athletics\nCompensation: $2,000",
        documentKind: "contract",
        brandHint: null
      },
      {
        documentId: "doc-brief",
        fileName: "nimbus-brief.docx",
        rawText: "Campaign for Nimbus Athletics\nDeliverables: 1 Reel",
        documentKind: "campaign_brief",
        brandHint: null
      }
    ]);

    expect(result.groups).toEqual([
      {
        label: "Nimbus Athletics",
        confidence: 0.9,
        documentIds: ["doc-contract", "doc-brief"]
      }
    ]);
  });

  test("keeps unmatched documents with the lone detected group", () => {
    const result = clusterDocuments([
      {
        documentId: "doc-contract",
        fileName: "nimbus-contract.pdf",
        rawText: "Brand: Nimbus Athletics",
        documentKind: "contract",
        brandHint: null
      },
      {
        documentId: "doc-rider",
        fileName: "v2.pdf",
        rawText: "Usage rights addendum with no brand name",
        documentKind: "unknown",
        brandHint: null
      }
    ]);

    expect(result.groups).toEqual([
      {
        label: "Nimbus Athletics",
        confidence: 0.9,
        documentIds: ["doc-contract", "doc-rider"]
      }
    ]);
  });

  test("creates an unknown group when there are multiple detected partnerships", () => {
    const result = clusterDocuments([
      {
        documentId: "doc-nimbus",
        fileName: "nimbus-contract.pdf",
        rawText: "Brand: Nimbus Athletics",
        documentKind: "contract",
        brandHint: null
      },
      {
        documentId: "doc-sprout",
        fileName: "sprout-brief.docx",
        rawText: "Campaign for Sprout Organics",
        documentKind: "campaign_brief",
        brandHint: null
      },
      {
        documentId: "doc-unknown",
        fileName: "v2.txt",
        rawText: "Random notes without a clear brand",
        documentKind: "unknown",
        brandHint: null
      }
    ]);

    expect(result.groups).toEqual([
      {
        label: "Nimbus Athletics",
        confidence: 0.9,
        documentIds: ["doc-nimbus"]
      },
      {
        label: "Sprout Organics",
        confidence: 0.9,
        documentIds: ["doc-sprout"]
      },
      {
        label: "Unknown",
        confidence: 0.6,
        documentIds: ["doc-unknown"]
      }
    ]);
  });
});
