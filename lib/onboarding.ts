import { buildProfileOnboardingSubmission } from "@/lib/onboarding-draft";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  parseProfileMetadata,
  serializeProfileMetadata,
  type ProfilePlatform
} from "@/lib/profile-metadata";
import { updateProfileForViewer } from "@/lib/profile";
import type {
  OnboardingStateRecord,
  ProductGuideState,
  Viewer
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const EMPTY_GUIDE_STATE: ProductGuideState = {
  dismissedStepIds: [],
  completedStepIds: [],
  hasEverCreatedWorkspace: false
};

const FALLBACK_ONBOARDING_COOKIE_NAME = "hellobrand_onboarding_state";

function normalizeGuideState(raw: unknown): ProductGuideState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_GUIDE_STATE };
  }

  const record = raw as Record<string, unknown>;

  return {
    dismissedStepIds: Array.isArray(record.dismissedStepIds)
      ? record.dismissedStepIds.filter((v): v is string => typeof v === "string")
      : [],
    completedStepIds: Array.isArray(record.completedStepIds)
      ? record.completedStepIds.filter((v): v is string => typeof v === "string")
      : [],
    hasEverCreatedWorkspace: record.hasEverCreatedWorkspace === true
  };
}

function toOnboardingStateRecord(row: {
  id: string;
  userId: string;
  profileOnboardingCompletedAt: Date | null;
  profileOnboardingVersion: number;
  profileOnboardingStateJson: unknown;
  productGuideVersion: number;
  productGuideStateJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): OnboardingStateRecord {
  return {
    id: row.id,
    userId: row.userId,
    profileOnboardingCompletedAt:
      row.profileOnboardingCompletedAt?.toISOString() ?? null,
    profileOnboardingVersion: row.profileOnboardingVersion,
    profileOnboardingStateJson: row.profileOnboardingStateJson,
    productGuideVersion: row.productGuideVersion,
    productGuideStateJson: normalizeGuideState(row.productGuideStateJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function buildFallbackState(viewer: Viewer): OnboardingStateRecord {
  const now = new Date().toISOString();

  return {
    id: `onboarding-${viewer.id}`,
    userId: viewer.id,
    profileOnboardingCompletedAt: null,
    profileOnboardingVersion: 0,
    profileOnboardingStateJson: null,
    productGuideVersion: 0,
    productGuideStateJson: { ...EMPTY_GUIDE_STATE },
    createdAt: now,
    updatedAt: now
  };
}

type FallbackOnboardingCookiePayload = {
  userId: string;
  profileOnboardingCompletedAt: string | null;
  profileOnboardingVersion: number;
  profileOnboardingStateJson: unknown;
  productGuideVersion: number;
  productGuideStateJson: ProductGuideState;
  createdAt: string;
  updatedAt: string;
};

async function getFallbackOnboardingStateFromCookie(
  viewer: Viewer
): Promise<OnboardingStateRecord | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FALLBACK_ONBOARDING_COOKIE_NAME)?.value;

  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as Partial<FallbackOnboardingCookiePayload>;

    if (payload.userId !== viewer.id) {
      return null;
    }

    const base = buildFallbackState(viewer);

    return {
      ...base,
      profileOnboardingCompletedAt:
        typeof payload.profileOnboardingCompletedAt === "string"
          ? payload.profileOnboardingCompletedAt
          : null,
      profileOnboardingVersion:
        typeof payload.profileOnboardingVersion === "number"
          ? payload.profileOnboardingVersion
          : base.profileOnboardingVersion,
      profileOnboardingStateJson:
        payload.profileOnboardingStateJson ?? base.profileOnboardingStateJson,
      productGuideVersion:
        typeof payload.productGuideVersion === "number"
          ? payload.productGuideVersion
          : base.productGuideVersion,
      productGuideStateJson: normalizeGuideState(payload.productGuideStateJson),
      createdAt:
        typeof payload.createdAt === "string" ? payload.createdAt : base.createdAt,
      updatedAt:
        typeof payload.updatedAt === "string" ? payload.updatedAt : base.updatedAt
    };
  } catch {
    return null;
  }
}

async function setFallbackOnboardingStateCookie(
  viewer: Viewer,
  patch: Partial<OnboardingStateRecord>
) {
  const cookieStore = await cookies();
  const existing =
    (await getFallbackOnboardingStateFromCookie(viewer)) ?? buildFallbackState(viewer);
  const next: OnboardingStateRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    userId: viewer.id,
    productGuideStateJson: patch.productGuideStateJson
      ? normalizeGuideState(patch.productGuideStateJson)
      : existing.productGuideStateJson,
    updatedAt: new Date().toISOString()
  };

  cookieStore.set({
    name: FALLBACK_ONBOARDING_COOKIE_NAME,
    value: JSON.stringify({
      userId: next.userId,
      profileOnboardingCompletedAt: next.profileOnboardingCompletedAt,
      profileOnboardingVersion: next.profileOnboardingVersion,
      profileOnboardingStateJson: next.profileOnboardingStateJson,
      productGuideVersion: next.productGuideVersion,
      productGuideStateJson: next.productGuideStateJson,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt
    } satisfies FallbackOnboardingCookiePayload),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 60 * 60 * 24 * 7
  });

  return next;
}

export async function resetFallbackOnboardingStateCookie(viewer: Viewer) {
  return setFallbackOnboardingStateCookie(viewer, {
    profileOnboardingCompletedAt: null,
    profileOnboardingVersion: 0,
    profileOnboardingStateJson: null,
    productGuideVersion: 0,
    productGuideStateJson: { ...EMPTY_GUIDE_STATE }
  });
}

export async function completeFallbackOnboardingStateCookie(viewer: Viewer) {
  return setFallbackOnboardingStateCookie(viewer, {
    profileOnboardingCompletedAt: new Date().toISOString(),
    profileOnboardingVersion: 1
  });
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

export async function getOnboardingStateForViewer(
  viewer: Viewer
): Promise<OnboardingStateRecord> {
  if (!process.env.DATABASE_URL) {
    return (
      (await getFallbackOnboardingStateFromCookie(viewer)) ??
      buildFallbackState(viewer)
    );
  }

  const existing = await prisma.userOnboardingState.findUnique({
    where: { userId: viewer.id }
  });

  if (existing) {
    return toOnboardingStateRecord(existing);
  }

  try {
    const created = await prisma.userOnboardingState.create({
      data: { userId: viewer.id }
    });

    return toOnboardingStateRecord(created);
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentState = await prisma.userOnboardingState.findUnique({
      where: { userId: viewer.id }
    });

    if (!concurrentState) {
      throw error;
    }

    return toOnboardingStateRecord(concurrentState);
  }
}

export function isProfileOnboardingComplete(
  state: OnboardingStateRecord
): boolean {
  return state.profileOnboardingCompletedAt !== null;
}

/* ------------------------------------------------------------------ */
/*  Complete profile onboarding                                        */
/* ------------------------------------------------------------------ */

export async function completeProfileOnboarding(
  viewer: Viewer,
  input: {
    displayName: string;
    contactEmail: string;
    timeZone?: string | null;
    primaryHandle: string;
    selectedPlatforms: string[];
    platformHandles: Record<string, string>;
    contentCategory: string;
    bio?: string | null;
    accentColor?: string | null;
  }
) {
  const submission = buildProfileOnboardingSubmission({
    displayName: input.displayName,
    contactEmail: input.contactEmail,
    timeZone: input.timeZone ?? null,
    primaryHandle: input.primaryHandle,
    selectedPlatforms: input.selectedPlatforms.filter(
      (platform): platform is ProfilePlatform => typeof platform === "string"
    ),
    platformHandles: input.platformHandles,
    contentCategory: input.contentCategory,
    bio: input.bio ?? "",
    accentColor: input.accentColor ?? ""
  });
  const normalizedPrimaryHandle = submission.primaryHandle;
  const validPlatforms = submission.selectedPlatforms;

  if (validPlatforms.length === 0) {
    throw new Error("At least one valid platform is required.");
  }

  // Build social handles from platform selections
  const socialHandles = validPlatforms.map((platform, index) => {
    const handle = submission.platformHandles[platform] ?? normalizedPrimaryHandle;

    return {
      id: `social-${platform}-${index + 1}`,
      platform,
      handle,
      audienceLabel: null,
      partnershipContext: null
    };
  });

  // Get existing profile metadata to preserve other fields
  const { getProfileForViewer } = await import("@/lib/profile");
  const existingProfile = await getProfileForViewer(viewer);
  const { metadata: existingMetadata } = parseProfileMetadata(
    existingProfile.payoutDetails
  );

  const updatedMetadata = {
    ...existingMetadata,
    primaryPlatform: validPlatforms[0],
    contentCategory: submission.contentCategory || null,
    bio: submission.bio,
    socialHandles
  };

  const serializedMetadata = serializeProfileMetadata(updatedMetadata);

  // Update profile
  const profile = await updateProfileForViewer(viewer, {
    displayName: submission.displayName,
    creatorLegalName: existingProfile.creatorLegalName,
    businessName: normalizedPrimaryHandle,
    contactEmail: submission.contactEmail,
    timeZone: submission.timeZone,
    preferredSignature: existingProfile.preferredSignature,
    payoutDetails: serializedMetadata,
    accentColor: submission.accentColor
  });

  if (!process.env.DATABASE_URL) {
    await completeFallbackOnboardingStateCookie(viewer);
    return profile;
  }

  // Mark onboarding as complete
  await prisma.userOnboardingState.upsert({
    where: { userId: viewer.id },
    update: {
      profileOnboardingCompletedAt: new Date(),
      profileOnboardingVersion: 1,
      profileOnboardingStateJson: {
        selectedPlatforms: validPlatforms,
        primaryHandle: normalizedPrimaryHandle
      }
    },
    create: {
      userId: viewer.id,
      profileOnboardingCompletedAt: new Date(),
      profileOnboardingVersion: 1,
      profileOnboardingStateJson: {
        selectedPlatforms: validPlatforms,
        primaryHandle: normalizedPrimaryHandle
      }
    }
  });

  return profile;
}

/* ------------------------------------------------------------------ */
/*  Guide step persistence                                             */
/* ------------------------------------------------------------------ */

export async function updateGuideStep(
  viewer: Viewer,
  stepId: string,
  action: "dismiss" | "complete"
) {
  const state = await getOnboardingStateForViewer(viewer);
  const guideState = state.productGuideStateJson;

  if (action === "dismiss") {
    if (!guideState.dismissedStepIds.includes(stepId)) {
      guideState.dismissedStepIds.push(stepId);
    }
  } else {
    if (!guideState.completedStepIds.includes(stepId)) {
      guideState.completedStepIds.push(stepId);
    }
  }

  if (!process.env.DATABASE_URL) {
    const nextState = await setFallbackOnboardingStateCookie(viewer, {
      productGuideVersion: Math.max(state.productGuideVersion, 1),
      productGuideStateJson: { ...guideState }
    });

    return nextState.productGuideStateJson;
  }

  await prisma.userOnboardingState.upsert({
    where: { userId: viewer.id },
    update: { productGuideStateJson: { ...guideState } },
    create: {
      userId: viewer.id,
      productGuideStateJson: { ...guideState }
    }
  });

  return guideState;
}

export async function markWorkspaceCreatedForViewer(viewer: Viewer) {
  const state = await getOnboardingStateForViewer(viewer);
  const guideState = state.productGuideStateJson;

  if (guideState.hasEverCreatedWorkspace) {
    return guideState;
  }

  const nextGuideState: ProductGuideState = {
    ...guideState,
    hasEverCreatedWorkspace: true
  };

  if (!process.env.DATABASE_URL) {
    const nextState = await setFallbackOnboardingStateCookie(viewer, {
      productGuideVersion: Math.max(state.productGuideVersion, 1),
      productGuideStateJson: nextGuideState
    });

    return nextState.productGuideStateJson;
  }

  await prisma.userOnboardingState.upsert({
    where: { userId: viewer.id },
    update: { productGuideStateJson: { ...nextGuideState } },
    create: {
      userId: viewer.id,
      productGuideStateJson: { ...nextGuideState }
    }
  });

  return nextGuideState;
}
