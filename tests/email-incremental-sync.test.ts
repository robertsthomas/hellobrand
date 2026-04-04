import { describe, expect, test } from "vitest";

import { coalesceIncrementalEmailSyncRequests } from "@/lib/email/service";

describe("coalesceIncrementalEmailSyncRequests", () => {
  test("keeps the newest gmail history id and dedupes outlook message ids", () => {
    expect(
      coalesceIncrementalEmailSyncRequests([
        {
          accountId: "acct_123",
          gmailHistoryId: "100",
          outlookMessageIds: ["a", "b"]
        },
        {
          accountId: "acct_123",
          gmailHistoryId: "105",
          outlookMessageIds: ["b", "c"]
        },
        {
          accountId: "acct_123",
          gmailHistoryId: "102",
          outlookMessageIds: ["", "c"]
        }
      ])
    ).toEqual({
      accountId: "acct_123",
      gmailHistoryId: "105",
      outlookMessageIds: ["a", "b", "c"],
      batchSize: 3
    });
  });

  test("ignores requests for other accounts in the same batch", () => {
    expect(
      coalesceIncrementalEmailSyncRequests([
        { accountId: "acct_123", gmailHistoryId: "101" },
        { accountId: "acct_999", gmailHistoryId: "999" }
      ])
    ).toEqual({
      accountId: "acct_123",
      gmailHistoryId: "101",
      outlookMessageIds: [],
      batchSize: 1
    });
  });
});
