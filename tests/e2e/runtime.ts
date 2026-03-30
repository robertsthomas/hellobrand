import path from "node:path";

export const E2E_LOCAL_AUTH_SECRET = "hellobrand-playwright-local";
export const E2E_PORT = 4011;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

export const E2E_PROJECTS = [
  {
    tier: "basic",
    port: E2E_PORT,
    baseURL: E2E_BASE_URL,
    storageState: path.join(process.cwd(), "tests/e2e/.auth/basic.json")
  },
  {
    tier: "standard",
    port: E2E_PORT,
    baseURL: E2E_BASE_URL,
    storageState: path.join(process.cwd(), "tests/e2e/.auth/standard.json")
  },
  {
    tier: "premium",
    port: E2E_PORT,
    baseURL: E2E_BASE_URL,
    storageState: path.join(process.cwd(), "tests/e2e/.auth/premium.json")
  }
] as const;

export type TierName = (typeof E2E_PROJECTS)[number]["tier"];
