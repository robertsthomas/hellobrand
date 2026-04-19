import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

import type { NextRequest } from "next/server";
import { ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES } from "@/lib/public-upload-config";

export const ANONYMOUS_VISITOR_COOKIE_NAME = "hb_anon_visitor";
export const ANONYMOUS_VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const ANONYMOUS_UPLOAD_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;
export const ANONYMOUS_UPLOAD_MAX_COUNT = 1;
const ANONYMOUS_UPLOAD_REDIRECT_PATH = "/upload/claim";
export const ANONYMOUS_UPLOAD_LIMIT_ERROR_CODE = "ANONYMOUS_UPLOAD_LIMIT_REACHED";

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt"]);

function normalizeIp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase();
}

function parseForwardedHeader(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/for="?([^;,"]+)/i);
  return match?.[1] ?? null;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashBuffer(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function getAnonymousUploadSignUpHref() {
  return `/login?mode=sign-up&redirect=${encodeURIComponent(
    ANONYMOUS_UPLOAD_REDIRECT_PATH
  )}`;
}

export function getAnonymousUploadSignInHref() {
  return `/login?mode=sign-in&redirect=${encodeURIComponent(
    ANONYMOUS_UPLOAD_REDIRECT_PATH
  )}`;
}

function createAnonymousVisitorId() {
  return `anonv_${randomBytes(18).toString("hex")}`;
}

export function resolveAnonymousVisitorIdentity(request: NextRequest) {
  const cookieVisitorId =
    request.cookies.get(ANONYMOUS_VISITOR_COOKIE_NAME)?.value?.trim() || null;
  const visitorId = cookieVisitorId || createAnonymousVisitorId();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const rawIp =
    normalizeIp(forwardedFor?.split(",")[0]) ??
    normalizeIp(request.headers.get("x-real-ip")) ??
    normalizeIp(request.headers.get("cf-connecting-ip")) ??

    normalizeIp(parseForwardedHeader(request.headers.get("forwarded")));
  const ipHash = hashValue(rawIp ? `ip:${rawIp}` : `visitor-fallback:${visitorId}`);

  return {
    visitorId,
    ipHash,
    shouldSetVisitorCookie: !cookieVisitorId
  };
}

export function validateAnonymousUploadFile(file: Pick<File, "name" | "size">) {
  const extension = path.extname(file.name).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Please upload a PDF, DOC, DOCX, or TXT document.");
  }

  if (file.size > ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES) {
    throw new Error("Please upload a document smaller than 10 MB.");
  }
}
