import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Viewer } from "@/lib/types";

const { findManyMock, upsertMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  upsertMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailThreadPreviewState: {
      findMany: findManyMock,
      upsert: upsertMock
    }
  }
}));

import {
  listEmailThreadPreviewStatesForViewer,
  markEmailThreadPreviewSectionSeenForViewer
} from "@/lib/email/preview-state";

const viewer: Viewer = {
  id: "user-1",
  email: "creator@example.com",
  displayName: "Creator",
  mode: "demo"
};

describe("email thread preview state", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    upsertMock.mockReset();
    process.env.DATABASE_URL = "postgres://example";
  });

  it("lists preview states keyed by thread id", async () => {
    findManyMock.mockResolvedValue([
      {
        threadId: "thread-1",
        previewUpdatesSeenAt: new Date("2026-03-24T12:00:00.000Z"),
        actionItemsSeenAt: null,
        createdAt: new Date("2026-03-24T11:00:00.000Z"),
        updatedAt: new Date("2026-03-24T12:00:00.000Z")
      }
    ]);

    const result = await listEmailThreadPreviewStatesForViewer(viewer, [
      "thread-1",
      "thread-2"
    ]);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        threadId: {
          in: ["thread-1", "thread-2"]
        }
      }
    });
    expect(result).toEqual({
      "thread-1": {
        threadId: "thread-1",
        previewUpdatesSeenAt: "2026-03-24T12:00:00.000Z",
        actionItemsSeenAt: null,
        createdAt: "2026-03-24T11:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z"
      }
    });
  });

  it("marks a section as seen", async () => {
    upsertMock.mockResolvedValue({
      threadId: "thread-1",
      previewUpdatesSeenAt: new Date("2026-03-24T13:00:00.000Z"),
      actionItemsSeenAt: null,
      createdAt: new Date("2026-03-24T11:00:00.000Z"),
      updatedAt: new Date("2026-03-24T13:00:00.000Z")
    });

    const result = await markEmailThreadPreviewSectionSeenForViewer({
      viewer,
      threadId: "thread-1",
      section: "updates",
      seenAt: "2026-03-24T13:00:00.000Z"
    });

    expect(upsertMock).toHaveBeenCalledWith({
      where: {
        userId_threadId: {
          userId: "user-1",
          threadId: "thread-1"
        }
      },
      update: {
        previewUpdatesSeenAt: new Date("2026-03-24T13:00:00.000Z")
      },
      create: {
        userId: "user-1",
        threadId: "thread-1",
        previewUpdatesSeenAt: new Date("2026-03-24T13:00:00.000Z")
      }
    });
    expect(result).toEqual({
      threadId: "thread-1",
      previewUpdatesSeenAt: "2026-03-24T13:00:00.000Z",
      actionItemsSeenAt: null,
      createdAt: "2026-03-24T11:00:00.000Z",
      updatedAt: "2026-03-24T13:00:00.000Z"
    });
  });
});
