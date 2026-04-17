import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getClerkMetadataDisplayName } from "@/lib/clerk-profile";
import { DEFAULT_E2E_VIEWER, resolveE2EViewerFromCookies } from "@/lib/e2e-auth";
import { prisma } from "@/lib/prisma";
import type { Viewer } from "@/lib/types";

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

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

async function ensureViewerRecord(viewer: Viewer): Promise<Viewer> {
  if (
    process.env.NODE_ENV !== "production" &&
    viewer.mode === "demo"
  ) {
    return viewer;
  }

  if (!process.env.DATABASE_URL) {
    return viewer;
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: viewer.id },
      select: { id: true, email: true, displayName: true }
    });

    if (existing) {
      if (existing.email !== viewer.email || existing.displayName !== viewer.displayName) {
        const updated = await prisma.user.update({
          where: { id: viewer.id },
          data: {
            email: viewer.email,
            displayName: viewer.displayName
          }
        });

        return {
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          mode: viewer.mode
        };
      }

      return {
        id: existing.id,
        email: existing.email,
        displayName: existing.displayName,
        mode: viewer.mode
      };
    }

    const created = await prisma.user.create({
      data: {
        id: viewer.id,
        email: viewer.email,
        displayName: viewer.displayName
      }
    });

    return {
      id: created.id,
      email: created.email,
      displayName: created.displayName,
      mode: viewer.mode
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const reassigned = await prisma.user.update({
      where: { email: viewer.email },
      data: {
        id: viewer.id,
        displayName: viewer.displayName
      }
    });

    return {
      id: reassigned.id,
      email: reassigned.email,
      displayName: reassigned.displayName,
      mode: viewer.mode
    };
  }
}

async function ensureViewerBillingAccount(viewer: {
  id: string;
  email: string;
}) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  await prisma.billingAccount.upsert({
    where: { userId: viewer.id },
    update: {
      billingEmail: viewer.email,
    },
    create: {
      userId: viewer.id,
      billingEmail: viewer.email,
      currentPlanTier: "free",
    },
  });
}

// fallow-ignore-next-line complexity
async function upsertViewerFromSession() {
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  const claims = (session.sessionClaims as Record<string, unknown> | undefined) ?? null;
  const defaults = deriveViewerDefaults(session.userId, claims);

  // Prefer the real Clerk email, even if db has the @clerk.local fallback.
  // Try claims first, then fall back to the Clerk API for the primary email.
  let realEmail = firstString(
    claims?.email,
    claims?.primaryEmailAddress,
    claims?.primary_email_address,
    claims?.["email_address"]
  );

  if (!realEmail) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(session.userId);
      realEmail = clerkUser.primaryEmailAddress?.emailAddress ?? null;
    } catch {
      // If the Clerk API call fails, we'll use the fallback
    }
  }

  // Read display name from Clerk public metadata if synced from profile
  const metaDisplayName = getClerkMetadataDisplayName(claims);

  if (!process.env.DATABASE_URL) {
    return {
      id: session.userId,
      email: realEmail ?? defaults.email,
      displayName: metaDisplayName ?? defaults.displayName,
      mode: "clerk"
    } satisfies Viewer;
  }

  const effectiveEmail = realEmail ?? defaults.email;

  let user;

  try {
    user = await prisma.user.upsert({
      where: { id: session.userId },
      update: {
        // Only overwrite the DB email when we have a real one from Clerk,
        // so we never regress a good address back to the @clerk.local fallback
        ...(realEmail ? { email: realEmail } : {}),
        displayName: metaDisplayName ?? defaults.displayName
      },
      create: {
        id: session.userId,
        email: effectiveEmail,
        displayName: metaDisplayName ?? defaults.displayName
      }
    });
  } catch (error) {
    // Handle unique constraint on email — another Clerk user ID owns this
    // email. Find the existing row and update it with the new session ID,
    // or just fetch by ID if the row was already created concurrently.
    if (isUniqueConstraintError(error)) {
      user = await prisma.user.findUnique({ where: { id: session.userId } });

      if (!user) {
        // The email conflict is from a different user row — reassign it
        user = await prisma.user.update({
          where: { email: effectiveEmail },
          data: {
            id: session.userId,
            displayName: metaDisplayName ?? defaults.displayName
          }
        });
      }
    } else {
      throw error;
    }
  }

  await ensureViewerBillingAccount({
    id: user.id,
    email: realEmail ?? user.email,
  });

  return {
    id: user.id,
    email: realEmail ?? user.email,
    displayName: metaDisplayName ?? user.displayName,
    mode: "clerk"
  } satisfies Viewer;
}

const getCurrentViewerCached = cache(async (): Promise<Viewer | null> => {
  const e2eViewer = await resolveE2EViewerFromCookies();
  if (e2eViewer) {
    return ensureViewerRecord(e2eViewer);
  }

  const sessionViewer = await upsertViewerFromSession();
  if (sessionViewer) {
    return sessionViewer;
  }

  return null;
});

export async function getCurrentViewer(): Promise<Viewer | null> {
  return getCurrentViewerCached();
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

const getViewerByIdCached = cache(async (viewerId: string): Promise<Viewer> => {
  if (!process.env.DATABASE_URL) {
    if (viewerId === DEFAULT_E2E_VIEWER.id) {
      return DEFAULT_E2E_VIEWER;
    }

    return {
      id: viewerId,
      email: `${viewerId}@hellobrand.local`,
      displayName: "Creator",
      mode: "demo"
    };
  }

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
});

export async function getViewerById(viewerId: string): Promise<Viewer> {
  return getViewerByIdCached(viewerId);
}
