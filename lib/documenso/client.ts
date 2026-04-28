/**
 * Documenso API client — thin fetch wrapper with auth and error handling.
 * All outbound calls to the Documenso eSignature service go through here.
 */
import type {
  DocumensoCreatePayload,
  DocumensoEnvelope,
  DocumensoListResponse,
} from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

function getBaseUrl(): string {
  const url = process.env.DOCUMENSO_API_URL;
  if (!url) {
    throw new Error("DOCUMENSO_API_URL is not configured.");
  }
  return url.replace(/\/+$/, "");
}

function getApiKey(): string {
  const key = process.env.DOCUMENSO_API_KEY;
  if (!key) {
    throw new Error("DOCUMENSO_API_KEY is not configured.");
  }
  return key;
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: getApiKey(),
        ...init.headers,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Documenso API ${res.status}: ${path} — ${body.slice(0, 500)}`
      );
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function listEnvelopes(params?: {
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<DocumensoListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.perPage) qs.set("perPage", String(params.perPage));
  const query = qs.toString();
  return request<DocumensoListResponse>(`/api/v2/envelope${query ? `?${query}` : ""}`);
}

export async function getEnvelope(envelopeId: string): Promise<DocumensoEnvelope> {
  return request<DocumensoEnvelope>(`/api/v2/envelope/${envelopeId}`);
}

export async function createEnvelope(
  payload: DocumensoCreatePayload,
  pdfBuffer: Buffer,
  filename: string
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append(
    "files",
    new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }),
    filename
  );

  return request<{ id: string }>("/api/v2/envelope/create", {
    method: "POST",
    body: form,
    timeoutMs: 60_000,
  });
}

export async function distributeEnvelope(
  envelopeId: string,
  meta?: { subject?: string; message?: string }
): Promise<{
  success: boolean;
  id: string;
  recipients: { id: number; email: string; signingUrl: string }[];
}> {
  return request("/api/v2/envelope/distribute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelopeId, ...(meta ? { meta } : {}) }),
  });
}

export async function deleteEnvelope(
  envelopeId: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/api/v2/envelope/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelopeId }),
  });
}
