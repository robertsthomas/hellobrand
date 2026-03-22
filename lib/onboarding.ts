import { prisma } from "@/lib/prisma";
import {
  parseProfileMetadata,
  serializeProfileMetadata,
  type ProfilePlatform,
  PROFILE_PLATFORM_OPTIONS
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
  completedStepIds: []
};

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
      : []
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

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

export async function getOnboardingStateForViewer(
  viewer: Viewer
): Promise<OnboardingStateRecord> {
  if (!process.env.DATABASE_URL) {
    return buildFallbackState(viewer);
  }

  const existing = await prisma.userOnboardingState.findUnique({
    where: { userId: viewer.id }
  });

  if (existing) {
    return toOnboardingStateRecord(existing);
  }

  const created = await prisma.userOnboardingState.create({
    data: { userId: viewer.id }
  });

  return toOnboardingStateRecord(created);
}

export function isProfileOnboardingComplete(
  state: OnboardingStateRecord
): boolean {
  return state.profileOnboardingCompletedAt !== null;
}

/* ------------------------------------------------------------------ */
/*  Complete profile onboarding                                        */
/* ------------------------------------------------------------------ */

function normalizeHandle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function isValidPlatform(value: string): value is ProfilePlatform {
  return PROFILE_PLATFORM_OPTIONS.includes(value as ProfilePlatform);
}

export async function completeProfileOnboarding(
  viewer: Viewer,
  input: {
    displayName: string;
    contactEmail: string;
    primaryHandle: string;
    selectedPlatforms: string[];
    platformHandles: Record<string, string>;
    contentCategory: string;
    bio?: string | null;
    accentColor?: string | null;
  }
) {
  const normalizedPrimaryHandle = normalizeHandle(input.primaryHandle);
  const validPlatforms = input.selectedPlatforms.filter(isValidPlatform);

  if (validPlatforms.length === 0) {
    throw new Error("At least one valid platform is required.");
  }

  // Build social handles from platform selections
  const socialHandles = validPlatforms.map((platform, index) => {
    const customHandle = input.platformHandles[platform];
    const handle = customHandle?.trim()
      ? normalizeHandle(customHandle)
      : normalizedPrimaryHandle;

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
    contentCategory: input.contentCategory.trim() || null,
    bio: input.bio?.trim() || null,
    socialHandles
  };

  const serializedMetadata = serializeProfileMetadata(updatedMetadata);

  // Update profile
  const profile = await updateProfileForViewer(viewer, {
    displayName: input.displayName.trim(),
    creatorLegalName: existingProfile.creatorLegalName,
    businessName: normalizedPrimaryHandle,
    contactEmail: input.contactEmail.trim(),
    preferredSignature: existingProfile.preferredSignature,
    payoutDetails: serializedMetadata,
    accentColor: input.accentColor || null
  });

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
