import { defineConfig, devices } from "@playwright/test";

import { E2E_LOCAL_AUTH_SECRET, E2E_PROJECTS } from "./tests/e2e/runtime";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global.setup.ts",
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
  webServer: E2E_PROJECTS.map((project) => ({
    command: `pnpm exec next dev --port ${project.port}`,
    url: `${project.baseURL}/pricing`,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_DIST_DIR: `.next/e2e-${project.tier}`,
      NEXT_PUBLIC_APP_URL: project.baseURL,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
      HELLOBRAND_DEV_PLAN: project.tier,
      HELLOBRAND_E2E_ENABLED: "1",
      HELLOBRAND_E2E_AUTH_SECRET: E2E_LOCAL_AUTH_SECRET,
      DATABASE_URL: ""
    }
  }))
});
