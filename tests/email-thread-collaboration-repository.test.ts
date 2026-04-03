import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionMock,
  emailThreadFindFirstMock,
  emailThreadUpdateMock,
  dealFindFirstMock,
  dealEmailLinkFindFirstMock,
  dealEmailLinkDeleteMock,
  emailThreadDraftUpsertMock,
  emailThreadNoteCreateMock
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  emailThreadFindFirstMock: vi.fn(),
  emailThreadUpdateMock: vi.fn(),
  dealFindFirstMock: vi.fn(),
  dealEmailLinkFindFirstMock: vi.fn(),
  dealEmailLinkDeleteMock: vi.fn(),
  emailThreadDraftUpsertMock: vi.fn(),
  emailThreadNoteCreateMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    emailThread: {
      findFirst: emailThreadFindFirstMock,
      update: emailThreadUpdateMock
    },
    deal: {
      findFirst: dealFindFirstMock
    },
    dealEmailLink: {
      findFirst: dealEmailLinkFindFirstMock
    },
    emailThreadDraft: {
      findFirst: vi.fn(),
      upsert: emailThreadDraftUpsertMock,
      delete: vi.fn()
    },
    emailThreadNote: {
      create: emailThreadNoteCreateMock,
      findMany: vi.fn()
    }
  }
}));

import {
  createEmailThreadNoteForUser,
  linkEmailThreadToDeal,
  saveEmailThreadDraftForUser,
  unlinkEmailThreadFromDeal
} from "@/lib/email/repository";

describe("email thread collaboration repository", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    emailThreadFindFirstMock.mockReset();
    emailThreadUpdateMock.mockReset();
    dealFindFirstMock.mockReset();
    dealEmailLinkFindFirstMock.mockReset();
    dealEmailLinkDeleteMock.mockReset();
    emailThreadDraftUpsertMock.mockReset();
    emailThreadNoteCreateMock.mockReset();
  });

  it("replaces the existing primary link when promoting a thread workspace", async () => {
    emailThreadFindFirstMock.mockResolvedValue({ id: "thread-1" });
    dealFindFirstMock.mockResolvedValue({ id: "deal-2" });

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const upsert = vi.fn().mockResolvedValue({
      id: "link-2",
      dealId: "deal-2",
      threadId: "thread-1",
      linkSource: "manual",
      role: "primary",
      confidence: null,
      createdAt: new Date("2026-04-02T14:00:00.000Z")
    });
    const updateThread = vi.fn().mockResolvedValue({});

    transactionMock.mockImplementation(async (callback) =>
      callback({
        dealEmailLink: {
          updateMany,
          upsert
        },
        emailThread: {
          update: updateThread
        }
      })
    );

    const result = await linkEmailThreadToDeal(
      "user-1",
      "thread-1",
      "deal-2",
      "manual",
      "primary"
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        threadId: "thread-1",
        role: "primary"
      },
      data: {
        role: "reference"
      }
    });
    expect(upsert).toHaveBeenCalledWith({
      where: {
        dealId_threadId: {
          dealId: "deal-2",
          threadId: "thread-1"
        }
      },
      update: {
        linkSource: "manual",
        role: "primary",
        confidence: null
      },
      create: {
        dealId: "deal-2",
        threadId: "thread-1",
        linkSource: "manual",
        role: "primary",
        confidence: null
      }
    });
    expect(updateThread).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: {
        workflowState: "needs_review"
      }
    });
    expect(result).toEqual({
      id: "link-2",
      dealId: "deal-2",
      threadId: "thread-1",
      linkSource: "manual",
      role: "primary",
      confidence: null,
      createdAt: "2026-04-02T14:00:00.000Z"
    });
  });

  it("marks threads with no remaining primary links as unlinked", async () => {
    dealEmailLinkFindFirstMock.mockResolvedValueOnce({
      id: "link-1",
      role: "primary"
    });

    const deleteMock = vi.fn().mockResolvedValue({});
    const findPrimaryMock = vi.fn().mockResolvedValue(null);
    const updateThread = vi.fn().mockResolvedValue({});

    transactionMock.mockImplementation(async (callback) =>
      callback({
        dealEmailLink: {
          delete: deleteMock,
          findFirst: findPrimaryMock
        },
        emailThread: {
          update: updateThread
        }
      })
    );

    const result = await unlinkEmailThreadFromDeal("user-1", "thread-1", "deal-1");

    expect(result).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({
      where: {
        id: "link-1"
      }
    });
    expect(findPrimaryMock).toHaveBeenCalledWith({
      where: {
        threadId: "thread-1",
        role: "primary"
      },
      select: {
        id: true
      }
    });
    expect(updateThread).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: {
        workflowState: "unlinked"
      }
    });
  });

  it("persists drafts and updates workflow state based on draft status", async () => {
    emailThreadFindFirstMock.mockResolvedValue({ id: "thread-1" });

    const upsert = vi.fn().mockResolvedValue({
      id: "draft-1",
      userId: "user-1",
      threadId: "thread-1",
      subject: "Re: Spring launch",
      body: "Draft body",
      status: "ready",
      source: "manual",
      createdAt: new Date("2026-04-02T13:00:00.000Z"),
      updatedAt: new Date("2026-04-02T13:30:00.000Z")
    });
    const updateThread = vi.fn().mockResolvedValue({});

    transactionMock.mockImplementation(async (callback) =>
      callback({
        emailThreadDraft: {
          upsert
        },
        emailThread: {
          update: updateThread
        }
      })
    );

    const result = await saveEmailThreadDraftForUser({
      userId: "user-1",
      threadId: "thread-1",
      subject: "Re: Spring launch",
      body: "Draft body",
      status: "ready",
      source: "manual"
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_threadId: {
          userId: "user-1",
          threadId: "thread-1"
        }
      },
      update: {
        subject: "Re: Spring launch",
        body: "Draft body",
        status: "ready",
        source: "manual"
      },
      create: {
        userId: "user-1",
        threadId: "thread-1",
        subject: "Re: Spring launch",
        body: "Draft body",
        status: "ready",
        source: "manual"
      }
    });
    expect(updateThread).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: {
        workflowState: "draft_ready",
        draftUpdatedAt: expect.any(Date)
      }
    });
    expect(result).toEqual({
      id: "draft-1",
      userId: "user-1",
      threadId: "thread-1",
      subject: "Re: Spring launch",
      body: "Draft body",
      status: "ready",
      source: "manual",
      createdAt: "2026-04-02T13:00:00.000Z",
      updatedAt: "2026-04-02T13:30:00.000Z"
    });
  });

  it("creates private notes only for owned threads", async () => {
    emailThreadFindFirstMock.mockResolvedValue({ id: "thread-1" });
    emailThreadNoteCreateMock.mockResolvedValue({
      id: "note-1",
      userId: "user-1",
      threadId: "thread-1",
      body: "Flag the payment timing language.",
      createdAt: new Date("2026-04-02T15:00:00.000Z"),
      updatedAt: new Date("2026-04-02T15:00:00.000Z")
    });

    const result = await createEmailThreadNoteForUser({
      userId: "user-1",
      threadId: "thread-1",
      body: "Flag the payment timing language."
    });

    expect(emailThreadNoteCreateMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        threadId: "thread-1",
        body: "Flag the payment timing language."
      }
    });
    expect(result).toEqual({
      id: "note-1",
      userId: "user-1",
      threadId: "thread-1",
      body: "Flag the payment timing language.",
      createdAt: "2026-04-02T15:00:00.000Z",
      updatedAt: "2026-04-02T15:00:00.000Z"
    });
  });
});
