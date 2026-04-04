import { afterEach, describe, expect, test } from "vitest";

import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";

function buildFile(
  name: string,
  contents: string,
  options?: {
    type?: string;
    lastModified?: number;
  }
) {
  return new File([contents], name, {
    type: options?.type ?? "application/pdf",
    lastModified: options?.lastModified ?? Date.now()
  });
}

describe("useIntakeUiStore", () => {
  afterEach(() => {
    useIntakeUiStore.getState().reset();
  });

  test("appends newly selected files instead of replacing the existing queue", () => {
    const firstFile = buildFile("first.pdf", "first", { lastModified: 1 });
    const secondFile = buildFile("second.pdf", "second", { lastModified: 2 });

    useIntakeUiStore.getState().setSelectedFilesFromList([firstFile] as unknown as FileList);
    useIntakeUiStore.getState().setSelectedFilesFromList([secondFile] as unknown as FileList);

    const state = useIntakeUiStore.getState();

    expect(state.pendingFiles.map((file) => file.name)).toEqual([
      "first.pdf",
      "second.pdf"
    ]);
    expect(state.selectedFiles.map((file) => file.name)).toEqual([
      "first.pdf",
      "second.pdf"
    ]);
  });

  test("does not clear existing files when the picker returns no new files", () => {
    const firstFile = buildFile("first.pdf", "first", { lastModified: 1 });

    useIntakeUiStore.getState().setSelectedFilesFromList([firstFile] as unknown as FileList);
    useIntakeUiStore.getState().setSelectedFilesFromList(null);

    const state = useIntakeUiStore.getState();

    expect(state.pendingFiles.map((file) => file.name)).toEqual(["first.pdf"]);
    expect(state.selectedFiles.map((file) => file.name)).toEqual(["first.pdf"]);
  });

  test("dedupes files when the same document is selected more than once", () => {
    const duplicateFile = buildFile("first.pdf", "first", { lastModified: 1 });

    useIntakeUiStore.getState().setSelectedFilesFromList(
      [duplicateFile] as unknown as FileList
    );
    useIntakeUiStore.getState().setSelectedFilesFromList(
      [duplicateFile] as unknown as FileList
    );

    const state = useIntakeUiStore.getState();

    expect(state.pendingFiles.map((file) => file.name)).toEqual(["first.pdf"]);
    expect(state.selectedFiles.map((file) => file.name)).toEqual(["first.pdf"]);
  });
});
