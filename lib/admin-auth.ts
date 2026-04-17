import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const ADMIN_SESSION_COOKIE_NAME = "hellobrand_admin_session";

const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const ADMIN_USERNAME = "admin";

type AdminViewer = {
  credentialId: string;
  username: string;
  sessionId: string;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizePasswordHash(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_TTL_SECONDS
  };
}

export function getAdminUsername() {
  return ADMIN_USERNAME;
}

async function getAdminCredential() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  return prisma.adminCredential.findUnique({
    where: { username: ADMIN_USERNAME }
  });
}

export async function isAdminConfigured() {
  return Boolean(await getAdminCredential());
}

export async function createInitialAdminCredential(password: string) {
  if (!process.env.DATABASE_URL) {
    throw new Error("Admin auth requires DATABASE_URL.");
  }

  const existing = await getAdminCredential();
  if (existing) {
    throw new Error("Admin credentials are already configured.");
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = normalizePasswordHash(password, salt);

  return prisma.adminCredential.create({
    data: {
      username: ADMIN_USERNAME,
      passwordHash,
      passwordSalt: salt
    }
  });
}

export async function updateAdminCredentialPassword(password: string) {
  if (!process.env.DATABASE_URL) {
    throw new Error("Admin auth requires DATABASE_URL.");
  }

  const credential = await getAdminCredential();
  if (!credential) {
    throw new Error("Admin credentials have not been configured yet.");
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = normalizePasswordHash(password, salt);

  return prisma.adminCredential.update({
    where: { id: credential.id },
    data: {
      passwordHash,
      passwordSalt: salt
    }
  });
}

export async function verifyAdminPassword(username: string, password: string) {
  if (!process.env.DATABASE_URL) {
    throw new Error("Admin auth requires DATABASE_URL.");
  }

  const credential = await prisma.adminCredential.findUnique({
    where: { username: normalizeUsername(username) }
  });

  if (!credential) {
    return null;
  }

  const expectedHashBuffer = Buffer.from(credential.passwordHash, "hex");
  const actualHashBuffer = Buffer.from(
    normalizePasswordHash(password, credential.passwordSalt),
    "hex"
  );

  if (
    expectedHashBuffer.length !== actualHashBuffer.length ||
    !timingSafeEqual(expectedHashBuffer, actualHashBuffer)
  ) {
    return null;
  }

  return credential;
}

export async function createAdminSession(credentialId: string) {
  if (!process.env.DATABASE_URL) {
    throw new Error("Admin auth requires DATABASE_URL.");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000);

  const session = await prisma.adminSession.create({
    data: {
      credentialId,
      tokenHash,
      expiresAt
    }
  });

  return {
    token,
    session
  };
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    ...getSessionCookieOptions()
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    ...getSessionCookieOptions(),
    expires: new Date(0)
  });
}

export async function deleteAdminSessionByToken(token: string | null | undefined) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  if (!token) {
    return;
  }

  await prisma.adminSession.deleteMany({
    where: {
      tokenHash: hashSessionToken(token)
    }
  });
}

export async function getAdminViewer(): Promise<AdminViewer | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: {
      tokenHash: hashSessionToken(token)
    },
    include: {
      credential: {
        select: {
          id: true,
          username: true
        }
      }
    }
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  void prisma.adminSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  }).catch(() => undefined);

  return {
    credentialId: session.credential.id,
    username: session.credential.username,
    sessionId: session.id
  };
}

export async function requireAdminViewer() {
  const viewer = await getAdminViewer();

  if (!viewer) {
    redirect("/admin/login");
  }

  return viewer;
}

export async function requireApiAdminViewer() {
  const viewer = await getAdminViewer();

  if (!viewer) {
    throw new Error("Unauthorized");
  }

  return viewer;
}
