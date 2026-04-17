"use client";

export type LocalWorkspaceInputSource = "upload" | "paste" | "mixed";

export interface LocalWorkspaceManifestItem {
  localId: string;
  brandName: string;
  campaignName: string;
  updatedAt: string;
  inputSource: LocalWorkspaceInputSource;
  fileCount: number;
  fileNames: string[];
  hasPastedText: boolean;
}

interface LocalWorkspacePayload {
  localId: string;
  files: File[];
  pastedText: string;
  brandName: string;
  campaignName: string;
}

const STORAGE_KEY = "hellobrand:local-workspace-queue:v1";
const DB_NAME = "hellobrand-local-workspace-queue";
const STORE_NAME = "workspaces";

function isBrowser() {
  return typeof window !== "undefined";
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!isBrowser() || !("indexedDB" in window)) {
      reject(new Error("Local browser storage is unavailable."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "localId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local workspace storage."));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = callback(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("Local workspace storage request failed."));

        transaction.oncomplete = () => database.close();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Local workspace storage transaction failed."));
      })
  );
}

export function readLocalWorkspaceManifest() {
  if (!isBrowser()) {
    return [] as LocalWorkspaceManifestItem[];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalWorkspaceManifestItem[]) : [];
  } catch {
    return [];
  }
}

function writeLocalWorkspaceManifest(items: LocalWorkspaceManifestItem[]) {
  if (!isBrowser()) {
    return;
  }

  if (items.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function saveLocalWorkspace(input: {
  files: File[];
  pastedText: string;
  brandName: string;
  campaignName: string;
  inputSource: LocalWorkspaceInputSource;
}) {
  const localId = isBrowser() && "randomUUID" in window.crypto
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const manifestItem: LocalWorkspaceManifestItem = {
    localId,
    brandName: input.brandName,
    campaignName: input.campaignName,
    updatedAt: new Date().toISOString(),
    inputSource: input.inputSource,
    fileCount: input.files.length,
    fileNames: input.files.map((file) => file.name),
    hasPastedText: input.pastedText.trim().length > 0
  };

  const payload: LocalWorkspacePayload = {
    localId,
    files: input.files,
    pastedText: input.pastedText,
    brandName: input.brandName,
    campaignName: input.campaignName
  };

  await withStore("readwrite", (store) => store.put(payload));
  const manifest = [...readLocalWorkspaceManifest(), manifestItem];
  writeLocalWorkspaceManifest(manifest);

  return manifestItem;
}

export async function loadLocalWorkspace(localId: string) {
  return withStore<LocalWorkspacePayload | undefined>("readonly", (store) => store.get(localId));
}

export async function deleteLocalWorkspace(localId: string) {
  await withStore("readwrite", (store) => store.delete(localId));
  const manifest = readLocalWorkspaceManifest().filter((item) => item.localId !== localId);
  writeLocalWorkspaceManifest(manifest);
}

export async function clearLocalWorkspaces(localIds: string[]) {
  for (const localId of localIds) {
    await withStore("readwrite", (store) => store.delete(localId));
  }
  const manifest = readLocalWorkspaceManifest().filter((item) => !localIds.includes(item.localId));
  writeLocalWorkspaceManifest(manifest);
}
