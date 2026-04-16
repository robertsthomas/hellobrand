import { defineConfig, devices } from "@playwright/test";

import {
  E2E_BASE_URL,
  E2E_LOCAL_AUTH_SECRET,
  E2E_PORT,
  E2E_PROJECTS
} from "./tests/e2e/runtime";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global.setup.ts",
  globalTimeout: 300 * 1000,
  fullyParallel: true,
  retries: 2,
  workers: process.env.CI ? 3 : 4,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: E2E_PROJECTS.map((project) => ({
    name: project.tier,
    use: {
      ...devices["Desktop Chrome"],
      baseURL: project.baseURL,
      storageState: project.storageState
    }
  })),
  webServer: {
    command: `pnpm exec next dev --turbopack --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/pricing`,
    timeout: 120 * 1000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
        "pk_test_ZXhhbXBsZS5hY2NvdW50cy5kZXYk",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "sk_test_ZXhhbXBsZQ",
      HELLOBRAND_DEV_PLAN: "free",
      HELLOBRAND_E2E_ENABLED: "1",
      HELLOBRAND_E2E_AUTH_SECRET: E2E_LOCAL_AUTH_SECRET
    }
  }
});
