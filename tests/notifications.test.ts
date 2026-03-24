import { describe, expect, test } from "vitest";

import {
  buildWorkspaceNotificationSeed,
  getWorkspaceSupersededEventTypes,
  isNotificationUnread,
  notificationTypeForEventType
} from "@/lib/notifications";

describe("workspace notification seeds", () => {
  test("maps ready-for-review workspaces to the review route", () => {
    const notification = buildWorkspaceNotificationSeed({
      sessionId: "session-1",
      dealId: "deal-1",
      brandName: "Acme",
      campaignName: "Spring Launch",
      eventType: "workspace.ready_for_review",
      createdAt: "2026-03-23T12:05:00.000Z"
    });

    expect(notification).toMatchObject({
      category: "workspace",
      eventType: "workspace.ready_for_review",
      href: "/app/intake/session-1/review",
      title: "Acme workspace is ready for review",
      dedupeKey: "workspace.ready_for_review:session-1"
    });
  });

  test("includes duplicate-found review messaging", () => {
    const notification = buildWorkspaceNotificationSeed({
      sessionId: "session-1",
      dealId: "deal-1",
      brandName: "Acme",
      campaignName: "Spring Launch",
      duplicateMatchJson: [{ brandName: "Existing Brand" }],
      eventType: "workspace.duplicates_found"
    });

    expect(notification).toMatchObject({
      href: "/app/intake/session-1/review",
      title: "Possible duplicate: Acme",
      description:
        "This workspace may overlap with Existing Brand. Review to merge or keep separate."
    });
  });
});

describe("workspace lifecycle supersession", () => {
  test("processing supersedes queued and failed events", () => {
    expect(getWorkspaceSupersededEventTypes("workspace.processing_started")).toEqual([
      "workspace.queued",
      "workspace.failed"
    ]);
  });

  test("confirmed supersedes ready and duplicate review events", () => {
    expect(getWorkspaceSupersededEventTypes("workspace.confirmed")).toEqual(
      expect.arrayContaining([
        "workspace.ready_for_review",
        "workspace.duplicate_checking",
        "workspace.duplicates_found"
      ])
    );
  });
});

describe("notification metadata", () => {
  test("maps workspace events to display types", () => {
    expect(notificationTypeForEventType("workspace.processing_started")).toBe(
      "workspace_generating"
    );
    expect(notificationTypeForEventType("workspace.ready_for_review")).toBe(
      "workspace_ready"
    );
    expect(notificationTypeForEventType("workspace.confirmed")).toBe(
      "workspace_confirmed"
    );
  });

  test("treats missing readAt as unread", () => {
    expect(
      isNotificationUnread({
        id: "notification-1",
        category: "workspace",
        eventType: "workspace.processing_started",
        type: "workspace_generating",
        status: "active",
        entityType: "workspace",
        entityId: "session-1",
        title: "Generating",
        description: "Processing workspace",
        href: "/app/intake/session-1",
        dealId: "deal-1",
        sessionId: "session-1",
        createdAt: "2026-03-23T12:00:00.000Z",
        updatedAt: "2026-03-23T12:00:00.000Z",
        readAt: null,
        clearedAt: null,
        supersededAt: null,
        read: false
      })
    ).toBe(true);
  });
});
