import { randomUUID } from "node:crypto";

import type { EmailProvider } from "@/lib/types";
import { decodeBase64Url, encodeBase64Url, signValue, verifySignedValue } from "@/lib/email/crypto";

type OAuthStatePayload = {
  userId: string;
  provider: EmailProvider;
  nonce: string;
  createdAt: string;
};

export function createOAuthState(userId: string, provider: EmailProvider) {
  const payload: OAuthStatePayload = {
    userId,
    provider,
    nonce: randomUUID(),
    createdAt: new Date().toISOString()
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = signValue(encoded);
  return `${encoded}.${signature}`;
}

export function parseOAuthState(state: string | null | undefined) {
  if (!state) {
    throw new Error("Missing OAuth state.");
  }

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || !verifySignedValue(encoded, signature)) {
    throw new Error("Invalid OAuth state.");
  }

  const payload = JSON.parse(decodeBase64Url(encoded).toString("utf8")) as OAuthStatePayload;
  if (!payload.userId || !payload.provider || !payload.createdAt || !payload.nonce) {
    throw new Error("Invalid OAuth state payload.");
  }

  return payload;
}
