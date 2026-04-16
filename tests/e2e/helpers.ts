import {
  expect,
  type ConsoleMessage,
  type Page
} from "@playwright/test";

import { E2E_LOCAL_AUTH_SECRET } from "./runtime";
import type { TierName } from "./runtime";

export function getTierName(projectName: string): TierName {
  if (
    projectName !== "free" &&
    projectName !== "basic" &&
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

function isLikelyRuntimeConsoleError(message: ConsoleMessage) {
  if (message.type() !== "error") {
    return false;
  }

  const text = message.text();
  return [
    "TypeError",
    "ReferenceError",
    "RangeError",
    "SyntaxError",
    "Cannot read properties",
    "Cannot destructure property",
    "is not a function",
    "is not iterable"
  ].some((pattern) => text.includes(pattern));
}

export function startRuntimeErrorCapture(page: Page) {
  const errors: string[] = [];

  const onPageError = (error: Error) => {
    errors.push(`pageerror: ${error.message}`);
  };

  const onConsole = (message: ConsoleMessage) => {
    if (!isLikelyRuntimeConsoleError(message)) {
      return;
    }

    errors.push(`console: ${message.text()}`);
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  return {
    async assertNoRuntimeErrors() {
      expect(errors, errors.join("\n\n")).toEqual([]);
    },
    dispose() {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }
  };
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
