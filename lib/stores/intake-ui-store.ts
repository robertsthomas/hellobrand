"use client";

import { create, type UseBoundStore, type StoreApi } from "zustand";

import type { DuplicateMatch } from "@/lib/duplicate-detection";

export type IntakeUiMode = "upload" | "paste";

export interface SelectedFileMeta {
  name: string;
  size: number;
  type: string;
}

interface IntakeUiState {
  sessionId: string | null;
  mode: IntakeUiMode;
  pendingFiles: File[];
  brandName: string;
  campaignName: string;
  notes: string;
  pastedText: string;
  selectedFiles: SelectedFileMeta[];
  isSubmitting: boolean;
  errorMessage: string | null;
  duplicateMatches: DuplicateMatch[];
  isDuplicateCheckPending: boolean;
  setSessionId: (value: string | null) => void;
  setMode: (mode: IntakeUiMode) => void;
  setBrandName: (value: string) => void;
  setCampaignName: (value: string) => void;
  setNotes: (value: string) => void;
  setPastedText: (value: string) => void;
  setSelectedFilesFromList: (files: FileList | null) => void;
  setPendingFiles: (files: File[]) => void;
  setIsSubmitting: (value: boolean) => void;
  setErrorMessage: (value: string | null) => void;
  setDuplicateMatches: (matches: DuplicateMatch[]) => void;
  setIsDuplicateCheckPending: (value: boolean) => void;
  clearDuplicateMatches: () => void;
  reset: (mode?: IntakeUiMode) => void;
  hydrateDraft: (input: {
    sessionId: string | null;
    mode: IntakeUiMode;
    brandName: string;
    campaignName: string;
    notes: string;
    pastedText: string;
  }) => void;
}

const initialState = {
  sessionId: null as string | null,
  mode: "upload" as IntakeUiMode,
  pendingFiles: [] as File[],
  brandName: "",
  campaignName: "",
  notes: "",
  pastedText: "",
  selectedFiles: [],
  isSubmitting: false,
  errorMessage: null,
  duplicateMatches: [] as DuplicateMatch[],
  isDuplicateCheckPending: false
};

function toSelectedFileMeta(file: File): SelectedFileMeta {
  return {
    name: file.name,
    size: file.size,
    type: file.type
  };
}

function getFileSignature(file: File) {
  return [file.name, file.size, file.type, file.lastModified].join(":");
}

function mergePendingFiles(existingFiles: File[], incomingFiles: File[]) {
  if (incomingFiles.length === 0) {
    return existingFiles;
  }

  const seen = new Set(existingFiles.map(getFileSignature));
  const mergedFiles = [...existingFiles];

  for (const file of incomingFiles) {
    const signature = getFileSignature(file);
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    mergedFiles.push(file);
  }

  return mergedFiles;
}

export const useIntakeUiStore: UseBoundStore<StoreApi<IntakeUiState>> =
  create<IntakeUiState>((set) => ({
  ...initialState,
  setSessionId: (sessionId) => set({ sessionId }),
  setMode: (mode) => set({ mode, errorMessage: null }),
  setBrandName: (brandName) => set({ brandName }),
  setCampaignName: (campaignName) => set({ campaignName }),
  setNotes: (notes) => set({ notes }),
  setPastedText: (pastedText) => set({ pastedText }),
  setSelectedFilesFromList: (files) =>
    set((state) => {
      const mergedFiles = mergePendingFiles(state.pendingFiles, Array.from(files ?? []));
      return {
        pendingFiles: mergedFiles,
        selectedFiles: mergedFiles.map(toSelectedFileMeta)
      };
    }),
  setPendingFiles: (pendingFiles) =>
    set({
      pendingFiles,
      selectedFiles: pendingFiles.map(toSelectedFileMeta)
    }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setDuplicateMatches: (duplicateMatches) => set({ duplicateMatches }),
  setIsDuplicateCheckPending: (isDuplicateCheckPending) => set({ isDuplicateCheckPending }),
  clearDuplicateMatches: () => set({ duplicateMatches: [], isDuplicateCheckPending: false }),
  reset: (mode = "upload") =>
    set({
      ...initialState,
      mode
    }),
  hydrateDraft: (input) =>
    set({
      ...initialState,
      sessionId: input.sessionId,
      mode: input.mode,
      brandName: input.brandName,
      campaignName: input.campaignName,
      notes: input.notes,
      pastedText: input.pastedText
    })
  }));
