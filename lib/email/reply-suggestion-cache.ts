import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { EmailThreadDetail, Viewer } from "@/lib/types";

import { generateReplySuggestions } from "./ai";
import {
  buildReplySuggestionThreadVersion,
  sanitizeReplySuggestions,
  type ReplySuggestion
} from "./reply-suggestion-version";

type ReplySuggestionCacheDelegate = {
  findUnique: (args: {
    where: {
      userId_threadId_threadVersion: {
        userId: string;
        threadId: string;
        threadVersion: string;
      };
    };
  }) => Promise<{ suggestionsJson: unknown } | null>;
  upsert: (args: {
    where: {
      userId_threadId_threadVersion: {
        userId: string;
        threadId: string;
        threadVersion: string;
      };
    };
    update: { suggestionsJson: Prisma.InputJsonValue };
    create: {
      userId: string;
      threadId: string;
      threadVersion: string;
      suggestionsJson: Prisma.InputJsonValue;
    };
  }) => Promise<unknown>;
  deleteMany: (args: {
    where: {
      userId: string;
      threadId: string;
      threadVersion?: { not: string };
    };
  }) => Promise<unknown>;
};

function getReplySuggestionCacheDelegate(): ReplySuggestionCacheDelegate | null {
  const delegate = (
    prisma as unknown as {
      emailThreadReplySuggestionCache?: ReplySuggestionCacheDelegate;
    }
  ).emailThreadReplySuggestionCache;

  if (
    delegate &&
    typeof delegate.findUnique === "function" &&
    typeof delegate.upsert === "function" &&
    typeof delegate.deleteMany === "function"
  ) {
    return delegate;
  }

  return null;
}

function isPrismaTableMissingError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

export async function getPersistedReplySuggestionsForThread(
  viewer: Viewer,
  thread: EmailThreadDetail
): Promise<ReplySuggestion[]> {
  const fallback = () => generateReplySuggestions(thread);
  const delegate = getReplySuggestionCacheDelegate();

  if (!process.env.DATABASE_URL || !delegate) {
    return fallback();
  }

  const threadVersion = buildReplySuggestionThreadVersion(thread.thread);
  const where = {
    userId_threadId_threadVersion: {
      userId: viewer.id,
      threadId: thread.thread.id,
      threadVersion
    }
  } as const;

  try {
    const existing = await delegate.findUnique({ where });
    const cachedSuggestions = sanitizeReplySuggestions(existing?.suggestionsJson);

    if (cachedSuggestions.length > 0) {
      return cachedSuggestions;
    }
  } catch (error) {
    if (isPrismaTableMissingError(error)) {
      return fallback();
    }

    throw error;
  }

  const suggestions = await fallback();

  try {
    await delegate.upsert({
      where,
      update: {
        suggestionsJson: suggestions as Prisma.InputJsonValue
      },
      create: {
        userId: viewer.id,
        threadId: thread.thread.id,
        threadVersion,
        suggestionsJson: suggestions as Prisma.InputJsonValue
      }
    });

    await delegate.deleteMany({
      where: {
        userId: viewer.id,
        threadId: thread.thread.id,
        threadVersion: { not: threadVersion }
      }
    });
  } catch (error) {
    if (!isPrismaTableMissingError(error)) {
      throw error;
    }
  }

  return suggestions;
}
