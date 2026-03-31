import { describe, expect, test } from "vitest";

import { buildYahooProviderCursor, parseYahooProviderCursor } from "@/lib/email/providers/yahoo";

describe("Yahoo provider cursor helpers", () => {
  test("round-trips uid and uidValidity", () => {
    const cursor = buildYahooProviderCursor(4821, "123456");

    expect(parseYahooProviderCursor(cursor)).toEqual({
      lastUid: 4821,
      uidValidity: "123456"
    });
  });

  test("returns null for malformed cursor data", () => {
    expect(parseYahooProviderCursor("not-json")).toBeNull();
    expect(parseYahooProviderCursor(JSON.stringify({ lastUid: "bad" }))).toBeNull();
  });
});
