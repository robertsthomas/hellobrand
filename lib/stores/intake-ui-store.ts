"use client";

import { create, type UseBoundStore, type StoreApi } from "zustand";

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
  errorMessage: null
};

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
    set({
      pendingFiles: Array.from(files ?? []),
      selectedFiles: Array.from(files ?? []).map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
    }),
  setPendingFiles: (pendingFiles) =>
    set({
      pendingFiles,
      selectedFiles: pendingFiles.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
    }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
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
