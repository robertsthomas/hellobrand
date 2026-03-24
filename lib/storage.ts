import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { getRuntimePath } from "@/lib/runtime-path";

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";
const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";
const supabaseAdminKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  supabasePublicKey;

function hasSupabaseStorage() {
  return Boolean(supabaseUrl && supabaseAdminKey);
}

function supabaseAdmin() {
  return createClient(supabaseUrl, supabaseAdminKey);
}

async function ensureUploadDirectory() {
  const target = getRuntimePath("uploads");
  await mkdir(target, { recursive: true });
  return target;
}

export async function storeUploadedBytes(input: {
  fileName: string;
  bytes: Buffer;
  contentType: string;
  folder: string;
}) {
  const safeName = input.fileName.replace(/[^\w.\-]+/g, "-");
  const objectPath = `${input.folder}/${Date.now()}-${safeName}`;

  if (hasSupabaseStorage()) {
    const { error } = await supabaseAdmin()
      .storage
      .from(DEFAULT_BUCKET)
      .upload(objectPath, input.bytes, {
        contentType: input.contentType,
        upsert: true
      });

    if (!error) {
      return {
        storagePath: `supabase:${DEFAULT_BUCKET}:${objectPath}`
      };
    }
  }

  const uploadDir = await ensureUploadDirectory();
  const destination = path.join(uploadDir, `${input.folder}-${safeName}`);
  await writeFile(destination, input.bytes);
  return {
    storagePath: destination
  };
}

export async function readStoredBytes(storagePath: string) {
  if (storagePath.startsWith("supabase:")) {
    const [, bucket, ...rest] = storagePath.split(":");
    const objectPath = rest.join(":");
    const { data, error } = await supabaseAdmin().storage.from(bucket).download(objectPath);

    if (error || !data) {
      throw new Error(error?.message ?? "Could not read stored document.");
    }

    return Buffer.from(await data.arrayBuffer());
  }

  return readFile(storagePath);
}

export async function deleteStoredBytes(storagePath: string) {
  if (!storagePath || storagePath.startsWith("pasted:")) {
    return;
  }

  if (storagePath.startsWith("supabase:")) {
    const [, bucket, ...rest] = storagePath.split(":");
    const objectPath = rest.join(":");
    const { error } = await supabaseAdmin().storage.from(bucket).remove([objectPath]);

    if (error) {
      throw new Error(error.message || "Could not delete stored document.");
    }

    return;
  }

  try {
    await unlink(storagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") {
      throw error;
    }
  }
}
