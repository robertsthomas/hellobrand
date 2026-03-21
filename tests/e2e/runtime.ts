import path from "node:path";

export const E2E_LOCAL_AUTH_SECRET = "hellobrand-playwright-local";

export const E2E_PROJECTS = [
  {
    tier: "basic",
    port: 4011,
    baseURL: "http://127.0.0.1:4011",
    storageState: path.join(process.cwd(), "tests/e2e/.auth/basic.json")
  },
  {
    tier: "standard",
    port: 4012,
    baseURL: "http://127.0.0.1:4012",
    storageState: path.join(process.cwd(), "tests/e2e/.auth/standard.json")
  },
  {
    tier: "premium",
    port: 4013,
    baseURL: "http://127.0.0.1:4013",
    storageState: path.join(process.cwd(), "tests/e2e/.auth/premium.json")
  }
] as const;

export type TierName = (typeof E2E_PROJECTS)[number]["tier"];
