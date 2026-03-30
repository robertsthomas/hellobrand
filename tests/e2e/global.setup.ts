import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { request, type FullConfig } from "@playwright/test";

import {
  E2E_BASE_URL,
  E2E_LOCAL_AUTH_SECRET,
  E2E_PROJECTS
} from "./runtime";

export default async function globalSetup(_config: FullConfig) {
  await mkdir(path.join(process.cwd(), "tests/e2e/.auth"), {
    recursive: true
  });

  for (const project of E2E_PROJECTS) {
    const context = await request.newContext({
      baseURL: E2E_BASE_URL
    });

    const response = await context.post("/api/test-auth/login", {
      data: {
        secret: E2E_LOCAL_AUTH_SECRET,
        userId: "demo-user",
        email: "demo@hellobrand.app",
        displayName: "Demo Creator"
      },
      timeout: 60_000
    });

    if (!response.ok()) {
      throw new Error(
        `E2E login failed for ${project.tier}: ${response.status()} ${await response.text()}`
      );
    }

    // Set the tier cookie so the single server knows which plan to simulate
    const state = await context.storageState();
    const url = new URL(E2E_BASE_URL);
    state.cookies.push({
      name: "hb_e2e_tier",
      value: project.tier,
      domain: url.hostname,
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: "Lax"
    });

    await writeFile(project.storageState, JSON.stringify(state, null, 2), "utf8");
    await context.dispose();
  }
}
