import { describe, expect, test } from "vitest";

import { formatDeliverableTitle } from "@/lib/intake/normalization/deliverable-formatter";

describe("deliverable formatter", () => {
  test("keeps only the readable deliverable portion from mixed brief rows", () => {
    const formatted = formatDeliverableTitle(
      "com/simoneglowbeauty # of Posts / Content Type 2 x TikTok In-Feed Videos + 2 x Instagram Reels + 1 x Instagram Story Set (minimum 4 frames) Concept Submission July 3, 2026* First Draft Content Submission July 10, 2026* Content Live July 21, 2026* Post Duration Minimum 90 days from go-live date *All dates subject to change with written notice"
    );

    expect(formatted).toBe(
      "2 x TikTok In-Feed Videos + 2 x Instagram Reels + 1 x Instagram Story Set (minimum 4 frames)"
    );
  });

  test("falls back to the original title when no deliverable marker exists", () => {
    expect(formatDeliverableTitle("Instagram Reel")).toBe("Instagram Reel");
  });
});
