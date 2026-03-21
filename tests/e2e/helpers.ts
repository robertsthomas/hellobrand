import { expect, type Page } from "@playwright/test";

import type { TierName } from "./runtime";

export function getTierName(projectName: string): TierName {
  if (
    projectName !== "basic" &&
    projectName !== "standard" &&
    projectName !== "premium"
  ) {
    throw new Error(`Unknown tier project: ${projectName}`);
  }

  return projectName;
}

export async function gotoAuthed(page: Page, path: string) {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Returns true if the page rendered a Clerk rate-limit error instead of the
 * real app UI. Tests should skip DOM assertions when this is true.
 */
export async function isRateLimited(page: Page): Promise<boolean> {
  return page
    .getByText("too_many_requests")
    .isVisible({ timeout: 500 })
    .catch(() => false);
}
