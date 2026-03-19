import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { Viewer } from "@/lib/types";

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function deriveViewerDefaults(
  userId: string,
  claims: Record<string, unknown> | null | undefined
) {
  const email = firstString(
    claims?.email,
    claims?.primaryEmailAddress,
    claims?.primary_email_address,
    claims?.["email_address"]
  );
  const displayName = firstString(
    claims?.fullName,
    claims?.full_name,
    [claims?.firstName, claims?.lastName].filter(Boolean).join(" "),
    [claims?.first_name, claims?.last_name].filter(Boolean).join(" "),
    claims?.username
  );

  return {
    email: email ?? `${userId}@clerk.local`,
    displayName: displayName ?? "Creator"
  };
}

async function upsertViewerFromSession() {
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  const claims = (session.sessionClaims as Record<string, unknown> | undefined) ?? null;
  const defaults = deriveViewerDefaults(session.userId, claims);

  // Prefer the real Clerk email, even if db has the @clerk.local fallback
  const realEmail = firstString(
    claims?.email,
    claims?.primaryEmailAddress,
    claims?.primary_email_address,
    claims?.["email_address"]
  );

  // Read display name from Clerk public metadata if synced from profile
  const publicMeta = (claims?.publicMetadata ?? claims?.public_metadata) as Record<string, unknown> | undefined;
  const metaDisplayName = firstString(publicMeta?.displayName);

  const user = await prisma.user.upsert({
    where: { id: session.userId },
    update: {
      email: defaults.email,
      displayName: metaDisplayName ?? defaults.displayName
    },
    create: {
      id: session.userId,
      email: defaults.email,
      displayName: metaDisplayName ?? defaults.displayName
    }
  });

  return {
    id: user.id,
    email: realEmail ?? user.email,
    displayName: metaDisplayName ?? user.displayName,
    mode: "clerk"
  } satisfies Viewer;
}

export async function getCurrentViewer(): Promise<Viewer | null> {
  return upsertViewerFromSession();
}

export async function requireViewer() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect("/login");
  }

  return viewer;
}

export async function requireApiViewer() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    throw new Error("Unauthorized");
  }

  return viewer;
}

export async function getViewerById(viewerId: string): Promise<Viewer> {
  const user = await prisma.user.findUnique({
    where: { id: viewerId }
  });

  if (!user) {
    return {
      id: viewerId,
      email: `${viewerId}@clerk.local`,
      displayName: "Creator",
      mode: "clerk"
    };
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    mode: "clerk"
  };
}
