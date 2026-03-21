import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { request, type FullConfig } from "@playwright/test";

import {
  E2E_LOCAL_AUTH_SECRET,
  E2E_PROJECTS
} from "./runtime";

export default async function globalSetup(_config: FullConfig) {
  await mkdir(path.join(process.cwd(), "tests/e2e/.auth"), {
    recursive: true
  });

  for (const project of E2E_PROJECTS) {
    const context = await request.newContext({
      baseURL: project.baseURL
    });

    const response = await context.post("/api/test-auth/login", {
      data: {
        secret: E2E_LOCAL_AUTH_SECRET,
        userId: "demo-user",
        email: "demo@hellobrand.app",
        displayName: "Demo Creator"
      }
    });

    if (!response.ok()) {
      throw new Error(
        `E2E login failed for ${project.tier}: ${response.status()} ${await response.text()}`
      );
    }

    const state = await context.storageState();
    await writeFile(project.storageState, JSON.stringify(state, null, 2), "utf8");
    await context.dispose();
  }
}
