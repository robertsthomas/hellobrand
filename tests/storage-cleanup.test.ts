import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { deleteStoredBytes } from "@/lib/storage";

describe("storage cleanup", () => {
  test("deletes locally stored uploaded files", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "hb-storage-cleanup-"));
    const filePath = path.join(directory, "contract.pdf");

    try {
      await writeFile(filePath, "test");
      await deleteStoredBytes(filePath);

      await expect(access(filePath)).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("ignores pasted-text pseudo storage paths", async () => {
    await expect(deleteStoredBytes("pasted:notes.txt")).resolves.toBeUndefined();
  });
});
