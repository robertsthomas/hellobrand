import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { Viewer } from "@/lib/types";

export const E2E_AUTH_COOKIE_NAME = "hellobrand_e2e_auth";

export const DEFAULT_E2E_VIEWER = {
  id: "demo-user",
  email: "demo@hellobrand.app",
  displayName: "Demo Creator",
  mode: "demo"
} satisfies Viewer;

type E2EViewerPayload = Pick<Viewer, "id" | "email" | "displayName">;

function getE2EAuthSecret() {
  const secret = process.env.HELLOBRAND_E2E_AUTH_SECRET?.trim();
  return secret?.length ? secret : null;
}

function normalizeViewerPayload(input?: Partial<E2EViewerPayload>): E2EViewerPayload {
  return {
    id: input?.id?.trim() || DEFAULT_E2E_VIEWER.id,
    email: input?.email?.trim() || DEFAULT_E2E_VIEWER.email,
    displayName: input?.displayName?.trim() || DEFAULT_E2E_VIEWER.displayName
  };
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function parseCookieValue(
  value: string,
  secret: string
): E2EViewerPayload | null {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<E2EViewerPayload>;
    return normalizeViewerPayload(parsed);
  } catch {
    return null;
  }
}

export function isE2EAuthEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.HELLOBRAND_E2E_ENABLED === "1";
}

export function buildE2EAuthCookieValue(input?: Partial<E2EViewerPayload>) {
  const secret = getE2EAuthSecret();
  if (!secret) {
    throw new Error("Missing HELLOBRAND_E2E_AUTH_SECRET.");
  }

  const payload = normalizeViewerPayload(input);
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return {
    payload,
    value: `${encodedPayload}.${signPayload(encodedPayload, secret)}`
  };
}

export async function resolveE2EViewerFromCookies(): Promise<Viewer | null> {
  if (!isE2EAuthEnabled()) {
    return null;
  }

  const secret = getE2EAuthSecret();
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(E2E_AUTH_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return null;
  }

  const payload = parseCookieValue(cookieValue, secret);
  if (!payload) {
    return null;
  }

  return {
    ...payload,
    mode: "demo"
  };
}

export function setE2EViewerCookie(
  response: NextResponse,
  input?: Partial<E2EViewerPayload>
) {
  const { payload, value } = buildE2EAuthCookieValue(input);

  response.cookies.set({
    name: E2E_AUTH_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 60 * 60 * 24 * 7
  });

  return payload;
}

export function clearE2EViewerCookie(response: NextResponse) {
  response.cookies.set({
    name: E2E_AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    expires: new Date(0)
  });
}
