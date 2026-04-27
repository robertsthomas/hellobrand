import { describe, expect, test } from "vitest";

import { resolveWorkspaceTab } from "@/app/app/p/[dealId]/page-helpers";

describe("resolveWorkspaceTab", () => {
  test("redirects concepts to overview when concept generation is unavailable", () => {
    expect(
      resolveWorkspaceTab({
        hasInvoice: false,
        rawTab: "concepts",
        hasPendingExtraction: false,
        hasConceptGeneration: false,
      })
    ).toBe("overview");
  });

  test("allows concepts when concept generation is available", () => {
    expect(
      resolveWorkspaceTab({
        hasInvoice: true,
        rawTab: "concepts",
        hasPendingExtraction: false,
        hasConceptGeneration: true,
      })
    ).toBe("concepts");
  });
});
