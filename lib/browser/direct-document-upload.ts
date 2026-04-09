"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DirectUploadFileRegistration = {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
};

type DirectUploadRegistrationResponse = {
  registration: {
    mode: "direct" | "legacy";
    uploads: Array<{
      documentId: string;
      fileName: string;
      mimeType: string;
      fileSizeBytes: number;
      checksumSha256: string | null;
      bucket: string;
      objectPath: string;
      token: string;
    }>;
    pastedDocumentIds: string[];
  };
};

function supportsBrowserDirectUpload() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY)
  );
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function buildFileRegistration(file: File): Promise<DirectUploadFileRegistration> {
  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSizeBytes: file.size,
    checksumSha256: await sha256Hex(file)
  };
}

async function postLegacyMultipart(input: {
  uploadUrl: string;
  files: File[];
  pastedText: string;
  startProcessing?: boolean;
}) {
  const formData = new FormData();
  for (const file of input.files) {
    formData.append("documents", file);
  }
  if (input.pastedText.trim()) {
    formData.append("pastedText", input.pastedText.trim());
  }
  if (input.startProcessing === false) {
    formData.append("startProcessing", "0");
  }

  const response = await fetch(input.uploadUrl, {
    method: "POST",
    body: formData
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not upload documents.");
  }

  return payload;
}

export async function uploadDocumentsViaDirectStorage(input: {
  registerUrl: string;
  completeUrl: string;
  uploadUrl: string;
  files: File[];
  pastedText: string;
  startProcessing?: boolean;
  onRegistered?: () => void | Promise<void>;
}) {
  if (input.files.length === 0 && !input.pastedText.trim()) {
    throw new Error("Please upload at least one file or paste document text.");
  }

  if (!supportsBrowserDirectUpload() && input.files.length > 0) {
    return postLegacyMultipart(input);
  }

  const files = await Promise.all(input.files.map((file) => buildFileRegistration(file)));
  const registerResponse = await fetch(input.registerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      files,
      pastedText: input.pastedText.trim() || null
    })
  });
  const registerPayload = (await registerResponse.json()) as DirectUploadRegistrationResponse & {
    error?: string;
    session?: unknown;
  };

  if (!registerResponse.ok) {
    throw new Error(registerPayload.error ?? "Could not register upload.");
  }

  if (registerPayload.registration.mode === "legacy") {
    return postLegacyMultipart(input);
  }

  if (input.onRegistered) {
    await input.onRegistered();
  }

  const supabase = createSupabaseBrowserClient();
  const succeededDocumentIds = [...registerPayload.registration.pastedDocumentIds];
  const failedUploads: Array<{ documentId: string; errorMessage: string }> = [];

  await Promise.all(
    registerPayload.registration.uploads.map(async (upload, index) => {
      const file = input.files[index];
      if (!file) {
        failedUploads.push({
          documentId: upload.documentId,
          errorMessage: "Selected file could not be matched to the registered upload."
        });
        return;
      }

      const { error } = await supabase
        .storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.objectPath, upload.token, file, {
          contentType: upload.mimeType,
          upsert: true
        });

      if (error) {
        failedUploads.push({
          documentId: upload.documentId,
          errorMessage: error.message || "Could not upload file."
        });
        return;
      }

      succeededDocumentIds.push(upload.documentId);
    })
  );

  const completeResponse = await fetch(input.completeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      succeededDocumentIds,
      failedUploads,
      startProcessing: input.startProcessing
    })
  });
  const completePayload = await completeResponse.json();

  if (!completeResponse.ok) {
    throw new Error(completePayload.error ?? "Could not finalize uploads.");
  }

  return completePayload;
}
