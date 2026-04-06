import { describe, expect, test } from "vitest";

import {
  buildProfileEditorDraft,
  buildProfileEditorPatch,
  emptyGeneralHandle
} from "@/lib/profile-draft";
import { parseProfileMetadata, serializeProfileMetadata } from "@/lib/profile-metadata";
import type { ProfileRecord } from "@/lib/types";

function createProfile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: "profile-1",
    userId: "user-1",
    displayName: "Creator",
    creatorLegalName: "Creator Example",
    businessName: "@creator",
    contactEmail: "creator@example.com",
    timeZone: "America/New_York",
    preferredSignature: null,
    payoutDetails: serializeProfileMetadata({
      bio: null,
      location: null,
      primaryPlatform: "instagram",
      contentCategory: "Lifestyle",
      taxId: null,
      address: null,
      rateCardUrl: null,
      payoutNotes: null,
      socialHandles: [
        {
          id: "social-instagram-1",
          platform: "instagram",
          handle: "@creator",
          audienceLabel: "245K",
          partnershipContext: null
        },
        {
          id: "social-tiktok-1",
          platform: "tiktok",
          handle: "@creatortok",
          audienceLabel: null,
          partnershipContext: null
        }
      ]
    }),
    defaultCurrency: "USD",
    reminderLeadDays: 3,
    conflictAlertsEnabled: true,
    paymentRemindersEnabled: true,
    emailNotificationsEnabled: true,
    accentColor: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
    ...overrides
  };
}

describe("profile draft", () => {
  test("only includes persisted general channels in the editor draft", () => {
    const draft = buildProfileEditorDraft(createProfile(), "creator@example.com");

    expect(draft.generalHandles.map((entry) => entry.platform)).toEqual([
      "instagram",
      "tiktok"
    ]);
  });

  test("dedupes general channels by platform when building the save patch", () => {
    const profile = createProfile();
    const draft = buildProfileEditorDraft(profile, "creator@example.com");

    draft.generalHandles = [
      draft.generalHandles[0],
      emptyGeneralHandle("instagram", "duplicate-instagram"),
      emptyGeneralHandle("youtube", "youtube-1")
    ];
    draft.generalHandles[1].handle = "@another";
    draft.generalHandles[2].handle = "@creatortube";

    const patch = buildProfileEditorPatch(draft, profile);
    const { metadata } = parseProfileMetadata(patch.payoutDetails ?? null);

    expect(
      metadata.socialHandles
        .filter((entry) => !entry.partnershipContext)
        .map((entry) => entry.platform)
    ).toEqual(["instagram", "youtube"]);
  });
});
