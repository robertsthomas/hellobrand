import { describe, expect, it } from "vitest";

import { getNextFeedbackEligibilityTime } from "@/lib/feedback-schedule";

describe("getNextFeedbackEligibilityTime", () => {
  it("uses same-day 10am when 24 hours later lands before 10am", () => {
    const loginAt = new Date(2026, 3, 3, 9, 0, 0, 0).getTime();
    const eligibleAt = getNextFeedbackEligibilityTime(loginAt);

    expect(new Date(eligibleAt)).toEqual(new Date(2026, 3, 4, 10, 0, 0, 0));
  });

  it("rolls to the next day when 24 hours later lands after 10am", () => {
    const loginAt = new Date(2026, 3, 3, 18, 0, 0, 0).getTime();
    const eligibleAt = getNextFeedbackEligibilityTime(loginAt);

    expect(new Date(eligibleAt)).toEqual(new Date(2026, 3, 5, 10, 0, 0, 0));
  });

  it("allows the exact 10am checkpoint", () => {
    const loginAt = new Date(2026, 3, 3, 10, 0, 0, 0).getTime();
    const eligibleAt = getNextFeedbackEligibilityTime(loginAt);

    expect(new Date(eligibleAt)).toEqual(new Date(2026, 3, 4, 10, 0, 0, 0));
  });
});
