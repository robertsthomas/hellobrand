import { expect, test, type Page } from "@playwright/test";

import {
  PRICING_PLAN_CONTRACT,
  TIER_SURFACE_CONTRACT
} from "./fixtures/tiers";
import type { TierName } from "./runtime";

function getTierName(projectName: string): TierName {
  if (
    projectName !== "basic" &&
    projectName !== "standard" &&
    projectName !== "premium"
  ) {
    throw new Error(`Unknown tier project: ${projectName}`);
  }

  return projectName;
}

async function gotoAuthed(page: Page, path: string) {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/login/);
}

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
    const currentPlanSection = page.locator("section").first();

    await expect(
      currentPlanSection.getByRole("heading", { name: contract.currentPlanHeading })
    ).toBeVisible();

    for (const usageLabel of ["Workspaces", "Assistant", "AI drafts", "Briefs"]) {
      await expect(
        currentPlanSection.getByText(usageLabel, { exact: true })
      ).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "Compare plans" })).toBeVisible();
    const comparePlansSection = page
      .getByRole("heading", { name: "Compare plans" })
      .locator("..")
      .locator("..");
    const planCards = comparePlansSection.locator("article");
    await expect(planCards).toHaveCount(3);

    for (const [index, plan] of ["Basic", "Standard", "Premium"].entries()) {
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
    if (tier === "basic") {
      await expect(
        page.getByRole("heading", { name: "Unlock analytics" })
      ).toBeVisible();
    } else {
      await expect(page.getByText("Tracked revenue").first()).toBeVisible();
    }

    const briefResponse = await page.goto("/app/deals/demo-deal?tab=brief");
    const briefStatus = briefResponse?.status() ?? 0;
    if (tier === "basic") {
      await expect(
        page.getByRole("heading", {
          name: "AI brief generation unlocks on Standard"
        })
      ).toBeVisible();
    } else {
      // Premium/Standard have brief access, so the page either shows the
      // brief generator (if the deal exists) or a 404 (demo-deal is not
      // seeded). Either way, there must be no upgrade gate.
      await expect(
        page.getByRole("heading", {
          name: "AI brief generation unlocks on Standard"
        })
      ).not.toBeVisible();
      expect([200, 404]).toContain(briefStatus);
    }
  });

  test("premium communication surfaces unlock only on premium", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);

    await gotoAuthed(page, "/app/inbox");
    if (tier === "premium") {
      await expect(page.getByRole("heading", { name: "Inbox" }).first()).toBeVisible();
      await expect(page.getByText("Browse linked deal threads")).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "Unlock inbox intelligence" })
      ).toBeVisible();
    }

    await gotoAuthed(page, "/app/settings");
    if (tier === "premium") {
      await expect(
        page.getByRole("heading", { name: "Email Connections" })
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", {
          name: "Email connections unlock on Premium"
        })
      ).toBeVisible();
    }

    await gotoAuthed(page, "/app/deals/demo-deal?tab=emails");
    if (tier === "premium") {
      await expect(page.getByRole("heading", { name: "Linked Threads" })).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", {
          name: "Email intelligence unlocks on Premium"
        })
      ).toBeVisible();
    }
  });

});
