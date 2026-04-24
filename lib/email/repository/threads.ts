/**
 * This file handles email threads, thread links, drafts, notes, and attachment lookups.
 * It keeps inbox content and workspace-linking queries together instead of mixing them with account and AI candidate records.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  ConnectedEmailAccountRecord,
  DealEmailLinkRecord,
  EmailMessageRecord,
  EmailParticipant,
  EmailThreadDetail,
  EmailThreadDraftRecord,
  EmailThreadListItem,
  EmailThreadWorkflowState
} from "@/lib/types";

import {
  iso,
  splitThreadLinks,
  toAccountRecord,
  toActionItemRecord,
  toDealEventRecord,
  toDraftRecord,
  toLinkView,
  toJsonValue,
  toMessageRecord,
  toNoteRecord,
  toTermSuggestionRecord,
  toThreadRecord
} from "./shared";

export async function getEmailAttachmentForUser(userId: string, attachmentId: string) {
  const attachment = await prisma.emailAttachment.findFirst({
    where: {
      id: attachmentId,
      message: {
        thread: {
          account: {
            userId
          }
        }
      }
    },
    select: {
      id: true,
      messageId: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      storageKey: true,
      providerAttachmentId: true,
      message: {
        select: {
          providerMessageId: true,
          thread: {
            select: {
              id: true,
              account: true
            }
          }
        }
      }
    }
  });

  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    messageId: attachment.messageId,
    threadId: attachment.message.thread.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    storageKey: attachment.storageKey,
    providerAttachmentId: attachment.providerAttachmentId,
    providerMessageId: attachment.message.providerMessageId,
    account: toAccountRecord(attachment.message.thread.account)
  };
}

export async function saveSyncedEmailThread(
  accountId: string,
  provider: ConnectedEmailAccountRecord["provider"],
  payload: {
    providerThreadId: string;
    subject: string;
    snippet: string | null;
    participants: EmailParticipant[];
    lastMessageAt: string;
    isContractRelated: boolean;
    messages: Array<{
      providerMessageId: string;
      internetMessageId: string | null;
      from: EmailParticipant | null;
      to: EmailParticipant[];
      cc: EmailParticipant[];
      bcc: EmailParticipant[];
      subject: string;
      textBody: string | null;
      htmlBody: string | null;
      sentAt: string | null;
      receivedAt: string | null;
      direction: EmailMessageRecord["direction"];
      hasAttachments: boolean;
      attachments: Array<{
        providerAttachmentId: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    }>;
  }
) {
  const result = await prisma.$transaction(
// fallow-ignore-next-line complexity
    async (tx) => {
    const existingThread = await tx.emailThread.findUnique({
      where: {
        accountId_providerThreadId: {
          accountId,
          providerThreadId: payload.providerThreadId
        }
      },
      select: {
        id: true,
        workflowState: true,
        lastMessageAt: true,
        dealLinks: {
          select: {
            role: true
          }
        }
      }
    });
    const hasPrimaryLink = existingThread?.dealLinks.some((link) => link.role === "primary") ?? false;
    const latestInboundAt = payload.messages
      .filter((message) => message.direction === "inbound")
      .map((message) => message.receivedAt ?? message.sentAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
    const hasNewInboundActivity =
      !existingThread ||
      (latestInboundAt
        ? new Date(latestInboundAt).getTime() > existingThread.lastMessageAt.getTime()
        : false);
    const nextWorkflowState =
      hasNewInboundActivity && existingThread?.workflowState !== "closed"
        ? hasPrimaryLink
          ? "needs_review"
          : "unlinked"
        : existingThread?.workflowState ?? (hasPrimaryLink ? "needs_review" : "unlinked");

    const thread = await tx.emailThread.upsert({
      where: {
        accountId_providerThreadId: {
          accountId,
          providerThreadId: payload.providerThreadId
        }
      },
      update: {
        provider,
        subject: payload.subject,
        snippet: payload.snippet,
        participantsJson: toJsonValue(payload.participants),
        lastMessageAt: new Date(payload.lastMessageAt),
        messageCount: payload.messages.length,
        isContractRelated: payload.isContractRelated,
        workflowState: nextWorkflowState
      },
      create: {
        accountId,
        provider,
        providerThreadId: payload.providerThreadId,
        subject: payload.subject,
        snippet: payload.snippet,
        participantsJson: toJsonValue(payload.participants),
        lastMessageAt: new Date(payload.lastMessageAt),
        messageCount: payload.messages.length,
        isContractRelated: payload.isContractRelated,
        workflowState: nextWorkflowState
      }
    });

    for (const message of payload.messages) {
      const savedMessage = await tx.emailMessage.upsert({
        where: {
          threadId_providerMessageId: {
            threadId: thread.id,
            providerMessageId: message.providerMessageId
          }
        },
        update: {
          internetMessageId: message.internetMessageId,
          fromJson: message.from ? toJsonValue(message.from) : Prisma.JsonNull,
          toJson: toJsonValue(message.to),
          ccJson: toJsonValue(message.cc),
          bccJson: toJsonValue(message.bcc),
          subject: message.subject,
          textBody: message.textBody,
          htmlBody: message.htmlBody,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          direction: message.direction,
          hasAttachments: message.hasAttachments
        },
        create: {
          threadId: thread.id,
          providerMessageId: message.providerMessageId,
          internetMessageId: message.internetMessageId,
          fromJson: message.from ? toJsonValue(message.from) : Prisma.JsonNull,
          toJson: toJsonValue(message.to),
          ccJson: toJsonValue(message.cc),
          bccJson: toJsonValue(message.bcc),
          subject: message.subject,
          textBody: message.textBody,
          htmlBody: message.htmlBody,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          direction: message.direction,
          hasAttachments: message.hasAttachments
        }
      });

      await tx.emailAttachment.deleteMany({
        where: { messageId: savedMessage.id }
      });

      if (message.attachments.length > 0) {
        await tx.emailAttachment.createMany({
          data: message.attachments.map((attachment) => ({
            messageId: savedMessage.id,
            providerAttachmentId: attachment.providerAttachmentId,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            storageKey: null,
            extractedText: null
          }))
        });
      }
    }

    return tx.emailThread.findUniqueOrThrow({
      where: { id: thread.id }
    });
  }, { timeout: 30000 });

  return toThreadRecord(result);
}

export async function deleteSyncedEmailThread(
  accountId: string,
  providerThreadId: string
) {
  const existing = await prisma.emailThread.findUnique({
    where: {
      accountId_providerThreadId: {
        accountId,
        providerThreadId
      }
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    return null;
  }

  await prisma.emailThread.delete({
    where: {
      id: existing.id
    }
  });

  return existing.id;
}

export async function listEmailThreadsForUser(
  userId: string,
  filters?: {
    query?: string | null;
    provider?: string | null;
    accountId?: string | null;
    linkedDealId?: string | null;
    linkedOnly?: boolean;
    workflowState?: string | null;
    limit?: number;
  }
) {
  const recentEventThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const query = filters?.query?.trim().toLowerCase() || null;

  const rows = await prisma.emailThread.findMany({
    where: {
      account: {
        userId,
        provider: filters?.provider ?? undefined,
        id: filters?.accountId ?? undefined
      },
      workflowState: filters?.workflowState ?? undefined,
      dealLinks: filters?.linkedOnly
        ? {
            some: {
              role: "primary",
              deal: {
                userId
              }
            }
          }
        : undefined,
      ...(filters?.linkedDealId
        ? {
            dealLinks: {
              some: {
                dealId: filters.linkedDealId
              }
            }
          }
        : {}),
      ...(query
        ? {
            OR: [
              { subject: { contains: query, mode: "insensitive" } },
              { snippet: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      account: true,
      dealLinks: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          deal: {
            select: {
              brandName: true,
              campaignName: true
            }
          }
        }
      },
      dealEvents: {
        where: {
          createdAt: {
            gte: recentEventThreshold
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          updatedAt: true
        },
        take: 12
      },
      termSuggestions: {
        where: {
          status: "pending"
        },
        select: {
          id: true,
          updatedAt: true
        }
      },
      actionItems: {
        where: {
          status: "pending"
        },
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          updatedAt: true
        },
        take: 20
      },
      drafts: {
        where: {
          userId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      },
      _count: {
        select: {
          notes: true
        }
      }
    },
    orderBy: {
      lastMessageAt: "desc"
    },
    take: Math.max(filters?.limit ?? 100, 1)
  });

  return rows.map((row) => {
    const links = row.dealLinks.map(toLinkView);
    const { primaryLink, referenceLinks } = splitThreadLinks(links);

    return {
      thread: toThreadRecord(row),
      account: toAccountRecord(row.account),
      links,
      primaryLink,
      referenceLinks,
      importantEventCount: row.dealEvents.length + row.termSuggestions.length,
      latestImportantEventAt:
        [...row.dealEvents, ...row.termSuggestions]
          .map((event) => iso(event.updatedAt))
          .sort((left, right) => (right ?? "").localeCompare(left ?? ""))
          .find((value): value is string => Boolean(value)) ?? null,
      pendingTermSuggestionCount: row.termSuggestions.length,
      pendingActionItemCount: row.actionItems.length,
      latestPendingActionItemAt:
        row.actionItems
          .map((item) => iso(item.updatedAt))
          .find((value): value is string => Boolean(value)) ?? null,
      savedDraft: row.drafts[0] ? toDraftRecord(row.drafts[0]) : null,
      noteCount: row._count.notes
    };
  });
}

export async function getEmailThreadDetailForUser(userId: string, threadId: string): Promise<EmailThreadDetail | null> {
  const row = await prisma.emailThread.findFirst({
    where: {
      id: threadId,
      account: {
        userId
      }
    },
    include: {
      account: true,
      messages: {
        include: {
          attachments: true
        },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }]
      },
      dealLinks: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          deal: {
            select: {
              brandName: true,
              campaignName: true
            }
          }
        }
      },
      dealEvents: {
        orderBy: { createdAt: "desc" },
        take: 12
      },
      termSuggestions: {
        where: {
          status: "pending"
        },
        orderBy: { createdAt: "desc" },
        take: 8
      },
      actionItems: {
        where: {
          status: "pending"
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 20
      },
      drafts: {
        where: {
          userId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      },
      notes: {
        where: {
          userId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 20
      },
      _count: {
        select: {
          notes: true
        }
      }
    }
  });

  if (!row) {
    return null;
  }

  const links = row.dealLinks.map(toLinkView);
  const { primaryLink, referenceLinks } = splitThreadLinks(links);

  return {
    thread: toThreadRecord(row),
    account: toAccountRecord(row.account),
    messages: row.messages.map(toMessageRecord),
    links,
    primaryLink,
    referenceLinks,
    importantEvents: row.dealEvents.map(toDealEventRecord),
    termSuggestions: row.termSuggestions.map(toTermSuggestionRecord),
    actionItems: row.actionItems.map(toActionItemRecord),
    promiseDiscrepancies: [],
    crossDealConflicts: [],
    threadBrief: null,
    savedDraft: row.drafts[0] ? toDraftRecord(row.drafts[0]) : null,
    notes: row.notes.map(toNoteRecord),
    noteCount: row._count.notes
  };
}

export async function listLinkedEmailThreadsForDeal(userId: string, dealId: string) {
  const rows = await prisma.dealEmailLink.findMany({
    where: {
      dealId,
      deal: {
        userId
      }
    },
    include: {
      thread: {
        include: {
          account: true,
          dealEvents: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
              }
            },
            orderBy: {
              updatedAt: "desc"
            },
            select: {
              id: true,
              updatedAt: true
            },
            take: 12
          },
          termSuggestions: {
            where: {
              status: "pending"
            },
            select: {
              id: true,
              updatedAt: true
            }
          },
          actionItems: {
            where: {
              status: "pending"
            },
            orderBy: {
              updatedAt: "desc"
            },
            select: {
              id: true,
              updatedAt: true
            },
            take: 20
          },
          dealLinks: {
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            include: {
              deal: {
                select: {
                  brandName: true,
                  campaignName: true
                }
              }
            }
          },
          drafts: {
            where: {
              userId
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 1
          },
          _count: {
            select: {
              notes: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return rows.map((row) => {
    const links = row.thread.dealLinks.map(toLinkView);
    const { primaryLink, referenceLinks } = splitThreadLinks(links);

    return {
      thread: toThreadRecord(row.thread),
      account: toAccountRecord(row.thread.account),
      links,
      primaryLink,
      referenceLinks,
      importantEventCount: row.thread.dealEvents.length + row.thread.termSuggestions.length,
      latestImportantEventAt:
        [...row.thread.dealEvents, ...row.thread.termSuggestions]
          .map((event) => iso(event.updatedAt))
          .sort((left, right) => (right ?? "").localeCompare(left ?? ""))
          .find((value): value is string => Boolean(value)) ?? null,
      pendingTermSuggestionCount: row.thread.termSuggestions.length,
      pendingActionItemCount: row.thread.actionItems.length,
      latestPendingActionItemAt:
        row.thread.actionItems
          .map((item) => iso(item.updatedAt))
          .find((value): value is string => Boolean(value)) ?? null,
      savedDraft: row.thread.drafts[0] ? toDraftRecord(row.thread.drafts[0]) : null,
      noteCount: row.thread._count.notes
    };
  }) satisfies EmailThreadListItem[];
}

export async function linkEmailThreadToDeal(
  userId: string,
  threadId: string,
  dealId: string,
  source: DealEmailLinkRecord["linkSource"] = "manual",
  role: DealEmailLinkRecord["role"] = "reference",
  confidence: number | null = null
) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: threadId,
      account: {
        userId
      }
    },
    select: { id: true }
  });
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      userId
    },
    select: { id: true }
  });

  if (!thread || !deal) {
    return null;
  }

  const link = await prisma.$transaction(async (tx) => {
    if (role === "primary") {
      await tx.dealEmailLink.updateMany({
        where: {
          threadId,
          role: "primary"
        },
        data: {
          role: "reference"
        }
      });
    }

    const nextLink = await tx.dealEmailLink.upsert({
      where: {
        dealId_threadId: {
          dealId,
          threadId
        }
      },
      update: {
        linkSource: source,
        role,
        confidence
      },
      create: {
        dealId,
        threadId,
        linkSource: source,
        role,
        confidence
      }
    });

    await tx.emailThread.update({
      where: { id: threadId },
      data: {
        workflowState: role === "primary" ? "needs_review" : undefined
      }
    });

    return nextLink;
  });

  return {
    id: link.id,
    dealId: link.dealId,
    threadId: link.threadId,
    linkSource: link.linkSource as DealEmailLinkRecord["linkSource"],
    role: link.role as DealEmailLinkRecord["role"],
    confidence: link.confidence,
    createdAt: iso(link.createdAt) ?? new Date().toISOString()
  } satisfies DealEmailLinkRecord;
}

export async function unlinkEmailThreadFromDeal(userId: string, threadId: string, dealId: string) {
  const existing = await prisma.dealEmailLink.findFirst({
    where: {
      dealId,
      threadId,
      deal: {
        userId
      },
      thread: {
        account: {
          userId
        }
      }
    },
    select: { id: true, role: true }
  });

  if (!existing) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.dealEmailLink.delete({
      where: { id: existing.id }
    });

    const hasPrimaryLink = await tx.dealEmailLink.findFirst({
      where: {
        threadId,
        role: "primary"
      },
      select: { id: true }
    });

    await tx.emailThread.update({
      where: { id: threadId },
      data: {
        workflowState: hasPrimaryLink ? undefined : "unlinked"
      }
    });
  });
  return true;
}

export async function saveEmailThreadDraftForUser(input: {
  userId: string;
  threadId: string;
  subject: string;
  body: string;
  status: EmailThreadDraftRecord["status"];
  source: EmailThreadDraftRecord["source"];
}) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: input.threadId,
      account: {
        userId: input.userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const workflowState: EmailThreadWorkflowState =
    input.status === "ready" ? "draft_ready" : "needs_reply";

  const saved = await prisma.$transaction(async (tx) => {
    const draft = await tx.emailThreadDraft.upsert({
      where: {
        userId_threadId: {
          userId: input.userId,
          threadId: input.threadId
        }
      },
      update: {
        subject: input.subject,
        body: input.body,
        status: input.status,
        source: input.source
      },
      create: {
        userId: input.userId,
        threadId: input.threadId,
        subject: input.subject,
        body: input.body,
        status: input.status,
        source: input.source
      }
    });

    await tx.emailThread.update({
      where: { id: input.threadId },
      data: {
        workflowState,
        draftUpdatedAt: new Date()
      }
    });

    return draft;
  });

  return toDraftRecord(saved);
}

export async function getEmailThreadDraftForUser(userId: string, threadId: string) {
  const draft = await prisma.emailThreadDraft.findFirst({
    where: {
      userId,
      threadId,
      thread: {
        account: {
          userId
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return draft ? toDraftRecord(draft) : null;
}

export async function deleteEmailThreadDraftForUser(userId: string, threadId: string) {
  const existing = await prisma.emailThreadDraft.findFirst({
    where: {
      userId,
      threadId,
      thread: {
        account: {
          userId
        }
      }
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    return false;
  }

  await prisma.emailThreadDraft.delete({
    where: {
      id: existing.id
    }
  });

  return true;
}

export async function listEmailThreadNotesForUser(userId: string, threadId: string) {
  const notes = await prisma.emailThreadNote.findMany({
    where: {
      userId,
      threadId,
      thread: {
        account: {
          userId
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  return notes.map(toNoteRecord);
}

export async function createEmailThreadNoteForUser(input: {
  userId: string;
  threadId: string;
  body: string;
}) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: input.threadId,
      account: {
        userId: input.userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const note = await prisma.emailThreadNote.create({
    data: {
      userId: input.userId,
      threadId: input.threadId,
      body: input.body
    }
  });

  return toNoteRecord(note);
}

export async function updateEmailThreadWorkflowForUser(input: {
  userId: string;
  threadId: string;
  workflowState: EmailThreadWorkflowState;
}) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: input.threadId,
      account: {
        userId: input.userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const saved = await prisma.emailThread.update({
    where: {
      id: input.threadId
    },
    data: {
      workflowState: input.workflowState
    }
  });

  return toThreadRecord(saved);
}

export async function saveEmailThreadSummary(userId: string, threadId: string, summary: string) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      id: threadId,
      account: {
        userId
      }
    },
    select: { id: true }
  });

  if (!thread) {
    return null;
  }

  const saved = await prisma.emailThread.update({
    where: { id: threadId },
    data: {
      aiSummary: summary,
      aiSummaryUpdatedAt: new Date()
    }
  });

  return toThreadRecord(saved);
}
