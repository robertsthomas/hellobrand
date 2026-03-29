import { describe, expect, test } from "vitest";

import { cleanDisplayText } from "@/lib/display-text";

describe("cleanDisplayText", () => {
  test("strips inline markdown artifacts from extracted text", () => {
    expect(cleanDisplayText("# Amazon Kids ## Stories with Alexa")).toBe(
      "Amazon Kids Stories with Alexa",
    );
    expect(cleanDisplayText("**Payment due** within 30 days")).toBe(
      "Payment due within 30 days",
    );
  });
});
