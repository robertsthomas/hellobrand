import {
  expect,
  type ConsoleMessage,
  type Locator,
  type Page
} from "@playwright/test";

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

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

async function buildInputSample(input: Locator, index: number) {
  const type = normalizeKey(await input.getAttribute("type")) || "text";
  const fieldKey = [
    normalizeKey(await input.getAttribute("name")),
    normalizeKey(await input.getAttribute("id")),
    normalizeKey(await input.getAttribute("placeholder"))
  ]
    .filter(Boolean)
    .join(" ");

  if (type === "email" || fieldKey.includes("email")) {
    return `smoke+${index + 1}@hellobrand.test`;
  }

  if (type === "url" || fieldKey.includes("url") || fieldKey.includes("link")) {
    return "https://example.com/rate-card";
  }

  if (type === "number") {
    const min = Number(await input.getAttribute("min"));
    const max = Number(await input.getAttribute("max"));
    let value = 7;

    if (!Number.isNaN(min)) {
      value = Math.max(value, min);
    }

    if (!Number.isNaN(max)) {
      value = Math.min(value, max);
    }

    return String(value);
  }

  if (type === "date") {
    return "2026-03-22";
  }

  if (fieldKey.includes("currency")) {
    return "USD";
  }

  if (fieldKey.includes("signature") || fieldKey.includes("sign-off")) {
    return "Best, HelloBrand";
  }

  if (fieldKey.includes("location")) {
    return "New York, NY";
  }

  if (fieldKey.includes("business")) {
    return "HelloBrand Studio";
  }

  if (fieldKey.includes("display")) {
    return "Smoke Test Creator";
  }

  if (fieldKey.includes("handle")) {
    return "smoketestcreator";
  }

  if (fieldKey.includes("tax")) {
    return "12-3456789";
  }

  if (fieldKey.includes("audience")) {
    return "250K followers";
  }

  if (fieldKey.includes("context")) {
    return "Paid partnerships";
  }

  return `Smoke test value ${index + 1}`;
}

async function fillVisibleInputs(inputs: Locator) {
  let interactions = 0;
  const count = await inputs.count();

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    const isVisible = await input.isVisible().catch(() => false);
    const isEditable = await input.isEditable().catch(() => false);

    if (!isVisible || !isEditable) {
      continue;
    }

    await input.scrollIntoViewIfNeeded();
    await input.fill(await buildInputSample(input, index));
    await input.evaluate((node: HTMLInputElement) => node.blur());
    interactions += 1;
  }

  return interactions;
}

async function fillVisibleTextareas(textareas: Locator) {
  let interactions = 0;
  const count = await textareas.count();

  for (let index = 0; index < count; index += 1) {
    const textarea = textareas.nth(index);
    const isVisible = await textarea.isVisible().catch(() => false);
    const isEditable = await textarea.isEditable().catch(() => false);

    if (!isVisible || !isEditable) {
      continue;
    }

    await textarea.scrollIntoViewIfNeeded();
    await textarea.fill(`Smoke test notes ${index + 1}`);
    await textarea.evaluate((node: HTMLTextAreaElement) => node.blur());
    interactions += 1;
  }

  return interactions;
}

async function selectVisibleOptions(selects: Locator) {
  let interactions = 0;
  const count = await selects.count();

  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    const isVisible = await select.isVisible().catch(() => false);
    const isEnabled = await select.isEnabled().catch(() => false);

    if (!isVisible || !isEnabled) {
      continue;
    }

    const currentValue = await select.inputValue().catch(() => "");
    const optionCount = await select.locator("option").count();
    let nextValue: string | null = null;

    for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
      const option = select.locator("option").nth(optionIndex);
      const value = await option.getAttribute("value");
      const isDisabled = await option.isDisabled().catch(() => false);

      if (!value || isDisabled || value === currentValue) {
        continue;
      }

      nextValue = value;
      break;
    }

    if (!nextValue) {
      continue;
    }

    await select.scrollIntoViewIfNeeded();
    await select.selectOption(nextValue);
    interactions += 1;
  }

  return interactions;
}

async function togglePressedButtons(buttons: Locator) {
  let interactions = 0;
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const isVisible = await button.isVisible().catch(() => false);
    const isEnabled = await button.isEnabled().catch(() => false);

    if (!isVisible || !isEnabled) {
      continue;
    }

    await button.scrollIntoViewIfNeeded();
    await button.click();
    interactions += 1;
  }

  return interactions;
}

export async function exerciseVisibleFormControls(root: Locator) {
  let interactions = 0;

  interactions += await fillVisibleInputs(
    root.locator(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="color"])'
    )
  );
  interactions += await fillVisibleTextareas(root.locator("textarea"));
  interactions += await selectVisibleOptions(root.locator("select"));
  interactions += await togglePressedButtons(root.locator("button[aria-pressed]"));

  return interactions;
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
