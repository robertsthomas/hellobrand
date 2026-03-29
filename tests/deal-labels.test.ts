import { describe, expect, test } from "vitest";

import { getDisplayDealLabels } from "@/lib/deal-labels";
import { deriveWorkspaceTitleFromFileNames } from "@/lib/workspace-labels";

describe("deal label display helpers", () => {
  test("cleans composite markdown labels for brand and campaign displays", () => {
    expect(
      getDisplayDealLabels({
        brandName: "# Amazon Kids ## Stories with Alexa",
        campaignName: "# Amazon Kids ## Stories with Alexa - Stories with Alexa",
      }),
    ).toEqual({
      brandName: "Amazon Kids",
      campaignName: "Amazon Kids - Stories with Alexa",
    });
  });

  test("drops generic workspace placeholders from display labels", () => {
    expect(
      getDisplayDealLabels({
        brandName: "Workspace",
        campaignName: "2 uploaded documents",
      }),
    ).toEqual({
      brandName: null,
      campaignName: null,
    });
  });

  test("derives a usable workspace title from meaningful filenames", () => {
    expect(
      deriveWorkspaceTitleFromFileNames([
        "773518399.pdf",
        "Amazon Kids Influencer Brief_ Stories with Alexa.docx",
      ]),
    ).toBe("Amazon Kids Stories with Alexa");
  });
});
