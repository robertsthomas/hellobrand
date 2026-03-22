import { expect, type Page } from "@playwright/test";

import { E2E_LOCAL_AUTH_SECRET } from "./runtime";
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

export async function resetOnboardingState(page: Page) {
  const baseURL = page.url().split("/app")[0] || page.url().split("/api")[0];
  await page.request.post(`${baseURL}/api/test-onboarding`, {
    data: {
      secret: E2E_LOCAL_AUTH_SECRET,
      userId: "demo-user",
      action: "reset"
    }
  });
}

export async function completeOnboarding(page: Page) {
  const baseURL = page.url().split("/app")[0] || page.url().split("/api")[0];
  await page.request.post(`${baseURL}/api/test-onboarding`, {
    data: {
      secret: E2E_LOCAL_AUTH_SECRET,
      userId: "demo-user",
      action: "complete"
    }
  });
}
