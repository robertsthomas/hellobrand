import { expect, test } from "@playwright/test";

import {
  exerciseVisibleFormControls,
  gotoAuthed,
  startRuntimeErrorCapture
} from "./helpers";

test.describe("form smoke", () => {
  test("settings form handles text, select, and number changes without runtime errors", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/settings");
      await expect(
        page.getByRole("heading", { name: "Settings", exact: true }).first()
      ).toBeVisible();

      const form = page.getByRole("main").locator("form").first();
      await expect(form).toBeVisible();

      const interactions = await exerciseVisibleFormControls(form);
      expect(interactions).toBeGreaterThan(0);
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });

  test("profile editor handles textareas and selects without runtime errors", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/settings/profile");
      await expect(
        page.getByRole("heading", { name: "Profile", exact: true })
      ).toBeVisible();

      const form = page.getByRole("main").locator("form").first();
      await expect(form).toBeVisible();

      const interactions = await exerciseVisibleFormControls(form);
      expect(interactions).toBeGreaterThan(6);
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });

  test("payments editors accept numeric, date, text, and select changes without runtime errors", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/payments");
      await expect(
        page.getByRole("heading", { name: "Payments", exact: true }).first()
      ).toBeVisible();

      const forms = page.getByRole("main").locator("form");
      const formCount = await forms.count();
      expect(formCount).toBeGreaterThan(0);

      let interactions = 0;
      for (let index = 0; index < formCount; index += 1) {
        interactions += await exerciseVisibleFormControls(forms.nth(index));
      }

      expect(interactions).toBeGreaterThan(0);
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });

  test("deal notes form accepts textarea edits without runtime errors", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/deals/demo-deal?tab=notes");
      await expect(
        page.getByRole("heading", { name: "Notes", exact: true })
      ).toBeVisible();

      const form = page.getByRole("main").locator("form").first();
      await expect(form).toBeVisible();

      const interactions = await exerciseVisibleFormControls(form);
      expect(interactions).toBeGreaterThan(0);
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });
});
