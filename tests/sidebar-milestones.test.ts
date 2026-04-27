import { describe, expect, test } from "vitest";

import { buildSidebarMilestones } from "@/lib/sidebar-milestones";

function makeMilestones(
  overrides: Partial<Parameters<typeof buildSidebarMilestones>[0]> = {}
) {
  return buildSidebarMilestones({
    hasActiveWorkspace: false,
    hasEverCreatedWorkspace: false,
    profile: {
      creatorLegalName: null,
      businessName: null
    },
    entitlements: {
      features: {
        workspace_creation: true,
        assistant_chat: true,
        deal_draft_generation: true,
        brief_generation: false,
        analytics: false,
        analytics_advanced: false,
        premium_inbox: false,
        email_connections: false,
        concept_generation: false
      }
    },
    emailAccounts: [],
    ...overrides
  });
}

describe("buildSidebarMilestones", () => {
  test("new free or basic users only see workspace and profile steps", () => {
    const milestones = makeMilestones();

    expect(milestones.visible).toBe(true);
    expect(milestones.completedCount).toBe(0);
    expect(milestones.totalCount).toBe(2);
    expect(milestones.items.map((item) => item.id)).toEqual([
      "create_workspace",
      "setup_creator_profile"
    ]);
  });

  test("premium users before setup see all three incomplete steps", () => {
    const milestones = makeMilestones({
      entitlements: {
        features: {
          workspace_creation: true,
          assistant_chat: true,
          deal_draft_generation: true,
          brief_generation: true,
          analytics: true,
          analytics_advanced: true,
          premium_inbox: true,
          email_connections: true,
          concept_generation: true
        }
      }
    });

    expect(milestones.visible).toBe(true);
    expect(milestones.completedCount).toBe(0);
    expect(milestones.totalCount).toBe(3);
    expect(milestones.items.map((item) => item.id)).toEqual([
      "create_workspace",
      "setup_creator_profile",
      "connect_email"
    ]);
  });

  test("profile completion depends on saved profile fields, not onboarding flags", () => {
    const milestones = makeMilestones({
      profile: {
        creatorLegalName: "Thomas Roberts",
        businessName: "@hellobrand"
      }
    });

    expect(
      milestones.items.find((item) => item.id === "setup_creator_profile")?.complete
    ).toBe(true);
  });

  test("premium users with a connected or syncing email account complete the email step", () => {
    const connectedMilestones = makeMilestones({
      entitlements: {
        features: {
          workspace_creation: true,
          assistant_chat: true,
          deal_draft_generation: true,
          brief_generation: true,
          analytics: true,
          analytics_advanced: true,
          premium_inbox: true,
          email_connections: true,
          concept_generation: true
        }
      },
      emailAccounts: [
        {
          provider: "gmail",
          status: "connected",
          mailAuthConfigured: true
        }
      ]
    });
    const syncingMilestones = makeMilestones({
      entitlements: {
        features: {
          workspace_creation: true,
          assistant_chat: true,
          deal_draft_generation: true,
          brief_generation: true,
          analytics: true,
          analytics_advanced: true,
          premium_inbox: true,
          email_connections: true,
          concept_generation: true
        }
      },
      emailAccounts: [
        {
          provider: "outlook",
          status: "syncing",
          mailAuthConfigured: true
        }
      ]
    });

    expect(
      connectedMilestones.items.find((item) => item.id === "connect_email")?.complete
    ).toBe(true);
    expect(
      syncingMilestones.items.find((item) => item.id === "connect_email")?.complete
    ).toBe(true);
  });

  test("yahoo without mail auth configured does not complete the email step", () => {
    const milestones = makeMilestones({
      entitlements: {
        features: {
          workspace_creation: true,
          assistant_chat: true,
          deal_draft_generation: true,
          brief_generation: true,
          analytics: true,
          analytics_advanced: true,
          premium_inbox: true,
          email_connections: true,
          concept_generation: true
        }
      },
      emailAccounts: [
        {
          provider: "yahoo",
          status: "connected",
          mailAuthConfigured: false
        }
      ]
    });

    expect(
      milestones.items.find((item) => item.id === "connect_email")?.complete
    ).toBe(false);
  });

  test("the checklist hides once every visible step is complete", () => {
    const milestones = makeMilestones({
      hasActiveWorkspace: true,
      hasEverCreatedWorkspace: true,
      profile: {
        creatorLegalName: "Thomas Roberts",
        businessName: "@hellobrand"
      }
    });

    expect(milestones.completedCount).toBe(2);
    expect(milestones.totalCount).toBe(2);
    expect(milestones.visible).toBe(false);
  });
});
