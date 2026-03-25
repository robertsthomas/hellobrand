import { prisma } from "@/lib/prisma";
import type { EmailThreadPreviewStateRecord, Viewer } from "@/lib/types";

type PreviewSection = "updates" | "actionItems";

type ThreadPreviewStateDelegate = {
  findMany: (args: {
    where: {
      userId: string;
      threadId?: { in: string[] };
    };
  }) => Promise<
    Array<{
      threadId: string;
      previewUpdatesSeenAt: Date | null;
      actionItemsSeenAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >;
  upsert: (args: {
    where: {
      userId_threadId: {
        userId: string;
        threadId: string;
      };
    };
    update: {
      previewUpdatesSeenAt?: Date;
      actionItemsSeenAt?: Date;
    };
    create: {
      userId: string;
      threadId: string;
      previewUpdatesSeenAt?: Date;
      actionItemsSeenAt?: Date;
    };
  }) => Promise<{
    threadId: string;
    previewUpdatesSeenAt: Date | null;
    actionItemsSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

let isPreviewStateTableUnavailable = false;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toPreviewStateRecord(state: {
  threadId: string;
  previewUpdatesSeenAt: Date | null;
  actionItemsSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailThreadPreviewStateRecord {
  return {
    threadId: state.threadId,
    previewUpdatesSeenAt: iso(state.previewUpdatesSeenAt),
    actionItemsSeenAt: iso(state.actionItemsSeenAt),
    createdAt: iso(state.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(state.updatedAt) ?? new Date().toISOString()
  };
}

function getThreadPreviewStateDelegate(): ThreadPreviewStateDelegate | null {
  if (isPreviewStateTableUnavailable) {
    return null;
  }

  const delegate = (
    prisma as unknown as {
      emailThreadPreviewState?: ThreadPreviewStateDelegate;
    }
  ).emailThreadPreviewState;

  if (
    delegate &&
    typeof delegate.findMany === "function" &&
    typeof delegate.upsert === "function"
  ) {
    return delegate;
  }

  return null;
}

function isPrismaTableMissingError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  return (
    (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2021"
    ) ||
    (message.includes("EmailThreadPreviewState") && message.includes("does not exist"))
  );
}

export async function listEmailThreadPreviewStatesForViewer(
  viewer: Viewer,
  threadIds: string[]
): Promise<Record<string, EmailThreadPreviewStateRecord>> {
  const uniqueThreadIds = [...new Set(threadIds.filter(Boolean))];
  const delegate = getThreadPreviewStateDelegate();

  if (!process.env.DATABASE_URL || !delegate || uniqueThreadIds.length === 0) {
    return {};
  }

  try {
    const rows = await delegate.findMany({
      where: {
        userId: viewer.id,
        threadId: {
          in: uniqueThreadIds
        }
      }
    });

    return rows.reduce<Record<string, EmailThreadPreviewStateRecord>>((result, row) => {
      result[row.threadId] = toPreviewStateRecord(row);
      return result;
    }, {});
  } catch (error) {
    if (isPrismaTableMissingError(error)) {
      isPreviewStateTableUnavailable = true;
      return {};
    }

    throw error;
  }
}

export async function markEmailThreadPreviewSectionSeenForViewer(input: {
  viewer: Viewer;
  threadId: string;
  section: PreviewSection;
  seenAt: string;
}): Promise<EmailThreadPreviewStateRecord | null> {
  const delegate = getThreadPreviewStateDelegate();

  if (!process.env.DATABASE_URL || !delegate || !input.threadId) {
    return null;
  }

  const seenDate = new Date(input.seenAt);
  if (Number.isNaN(seenDate.getTime())) {
    throw new Error("Invalid preview state timestamp.");
  }

  const data =
    input.section === "updates"
      ? { previewUpdatesSeenAt: seenDate }
      : { actionItemsSeenAt: seenDate };

  try {
    const saved = await delegate.upsert({
      where: {
        userId_threadId: {
          userId: input.viewer.id,
          threadId: input.threadId
        }
      },
      update: data,
      create: {
        userId: input.viewer.id,
        threadId: input.threadId,
        ...data
      }
    });

    return toPreviewStateRecord(saved);
  } catch (error) {
    if (isPrismaTableMissingError(error)) {
      isPreviewStateTableUnavailable = true;
      return null;
    }

    throw error;
  }
}
