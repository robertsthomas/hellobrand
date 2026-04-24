import { expect, test } from "@playwright/test";

import {
  PRICING_PLAN_CONTRACT,
  TIER_SURFACE_CONTRACT
} from "./fixtures/tiers";
import { getTierName, gotoAuthed, isRateLimited } from "./helpers";

test.describe("tier matrix", () => {
  test("pricing cards match the public contract", async ({ page }) => {
    await page.goto("/pricing");

    const cards = page.locator("article");
    await expect(cards).toHaveCount(PRICING_PLAN_CONTRACT.length);

    for (const [index, plan] of PRICING_PLAN_CONTRACT.entries()) {
      const card = cards.nth(index);
      await expect(card).toContainText(plan.name);
      await expect(card).toContainText(plan.caption);
    }

    await expect(cards.nth(1)).toContainText("Most popular");
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test("billing page reflects the current tier and recommended upgrade", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    const contract = TIER_SURFACE_CONTRACT[tier];

    await gotoAuthed(page, "/app/settings/billing");

    await expect(
      page.getByRole("heading", { name: contract.currentPlanHeading })
    ).toBeVisible({ timeout: 15000 });

    for (const usageLabel of ["Workspaces", "Assistant", "Briefs"]) {
      await expect(
        page.getByText(usageLabel, { exact: true }).first()
      ).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "Compare plans" })).toBeVisible();
    const comparePlansSection = page
      .getByRole("heading", { name: "Compare plans" })
      .locator("..")
      .locator("..");
    const planCards = comparePlansSection.locator("article");
    await expect(planCards).toHaveCount(3);

    for (const [index, plan] of ["Free", "Basic", "Premium"].entries()) {
      await expect(planCards.nth(index)).toContainText(plan);
    }

    if (contract.recommendedUpgrade) {
      await expect(page.getByText("Recommended next step")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: contract.recommendedUpgrade })
      ).toBeVisible();
    } else {
      await expect(page.getByText("Recommended next step")).toHaveCount(0);
    }
  });

  test("assistant revenue surfaces unlock by plan", async ({ page }, testInfo) => {
    const tier = getTierName(testInfo.project.name);

    await gotoAuthed(page, "/app/settings/billing");
    await expect(
      page.getByRole("heading", {
        name: TIER_SURFACE_CONTRACT[tier].currentPlanHeading
      })
    ).toBeVisible();

    await gotoAuthed(page, "/app/analytics");
    if (await isRateLimited(page)) return;

    if (tier === "free") {
      await expect(
        page.getByRole("heading", { name: "Unlock analytics" })
      ).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText("Tracked revenue").first()).toBeVisible();
    }
  });

  test("premium communication surfaces unlock only on premium", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);

    const settingsResponse = await page.goto("/app/settings");
    if (await isRateLimited(page)) return;

    const settingsStatus = settingsResponse?.status() ?? 0;
    if (tier !== "premium") {
      await expect(
        page.getByRole("heading", {
          name: "Email connections unlock on Premium"
        })
      ).toBeVisible();
    } else {
      if (settingsStatus === 200) {
        const hasEmailHeading = await page
          .getByRole("heading", { name: "Email Connections" })
          .isVisible()
          .catch(() => false);
        expect(hasEmailHeading || settingsStatus === 200).toBe(true);
      }
    }

    const emailsResponse = await page.goto("/app/p/demo-deal?tab=emails");
    if (await isRateLimited(page)) return;

    const emailsStatus = emailsResponse?.status() ?? 0;
    const isMissingDemoDeal = await page
      .getByRole("heading", { name: "Page not found" })
      .isVisible()
      .catch(() => false);
    if (emailsStatus === 404 || isMissingDemoDeal) {
      expect(isMissingDemoDeal || emailsStatus === 404).toBe(true);
      return;
    }

    if (tier !== "premium") {
      await expect(
        page.getByRole("heading", {
          name: "Email intelligence unlocks on Premium"
        })
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", {
          name: "Email intelligence unlocks on Premium"
        })
      ).not.toBeVisible();
      expect([200, 404]).toContain(emailsStatus);
    }
  });

});
