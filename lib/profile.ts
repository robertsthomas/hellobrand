import { prisma } from "@/lib/prisma";
import type { ProfileRecord, Viewer } from "@/lib/types";

function toProfileRecord(profile: {
  id: string;
  userId: string;
  displayName: string | null;
  creatorLegalName: string | null;
  businessName: string | null;
  contactEmail: string | null;
  preferredSignature: string | null;
  payoutDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProfileRecord {
  return {
    id: profile.id,
    userId: profile.userId,
    displayName: profile.displayName,
    creatorLegalName: profile.creatorLegalName,
    businessName: profile.businessName,
    contactEmail: profile.contactEmail,
    preferredSignature: profile.preferredSignature,
    payoutDetails: profile.payoutDetails,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

export async function getProfileForViewer(viewer: Viewer) {
  const existing = await prisma.profile.findUnique({
    where: { userId: viewer.id }
  });

  if (existing) {
    return toProfileRecord(existing);
  }

  const created = await prisma.profile.create({
    data: {
      userId: viewer.id,
      displayName: viewer.displayName,
      contactEmail: viewer.email
    }
  });

  return toProfileRecord(created);
}

export async function updateProfileForViewer(
  viewer: Viewer,
  patch: {
    displayName: string | null;
    creatorLegalName: string | null;
    businessName: string | null;
    contactEmail: string | null;
    preferredSignature: string | null;
    payoutDetails: string | null;
  }
) {
  const profile = await prisma.profile.upsert({
    where: { userId: viewer.id },
    update: patch,
    create: {
      userId: viewer.id,
      ...patch
    }
  });

  if (patch.displayName?.trim()) {
    await prisma.user.update({
      where: { id: viewer.id },
      data: { displayName: patch.displayName.trim() }
    });
  }

  return toProfileRecord(profile);
}
