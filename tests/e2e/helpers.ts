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
