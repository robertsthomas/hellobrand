import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

function hasSupabaseStorage() {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  );
}

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? ""
  );
}

async function ensureUploadDirectory() {
  const target = path.join(process.cwd(), ".runtime", "uploads");
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
