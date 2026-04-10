/**
 * Prisma mappers for assistant and batch-clustering records.
 * These helpers keep assistant and batch row conversion out of the repository implementation.
 */

import type {
  AssistantContextSnapshotRecord,
  AssistantMessageRecord,
  AssistantThreadRecord,
  IntakeBatchGroupRecord,
  IntakeBatchRecord
} from "@/lib/types";

import { iso, toStringArray } from "./prisma-shared";

export function toAssistantThreadRecord(thread: {
  id: string;
  userId: string;
  dealId: string | null;
  scope: string;
  title: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AssistantThreadRecord {
  return {
    id: thread.id,
    userId: thread.userId,
    dealId: thread.dealId,
    scope: thread.scope as AssistantThreadRecord["scope"],
    title: thread.title,
    summary: thread.summary,
    createdAt: iso(thread.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(thread.updatedAt) ?? new Date().toISOString()
  };
}

export function toAssistantMessageRecord(message: {
  id: string;
  threadId: string;
  role: string;
  content: string;
  parts: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AssistantMessageRecord {
  return {
    id: message.id,
    threadId: message.threadId,
    role: message.role as AssistantMessageRecord["role"],
    content: message.content,
    parts: Array.isArray(message.parts) ? message.parts : [],
    createdAt: iso(message.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(message.updatedAt) ?? new Date().toISOString()
  };
}

export function toAssistantContextSnapshotRecord(snapshot: {
  id: string;
  userId: string;
  dealId: string | null;
  scope: string;
  key: string;
  version: string;
  summary: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AssistantContextSnapshotRecord {
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    dealId: snapshot.dealId,
    scope: snapshot.scope as AssistantContextSnapshotRecord["scope"],
    key: snapshot.key,
    version: snapshot.version,
    summary: snapshot.summary,
    payload:
      snapshot.payload && typeof snapshot.payload === "object"
        ? (snapshot.payload as Record<string, unknown>)
        : {},
    createdAt: iso(snapshot.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(snapshot.updatedAt) ?? new Date().toISOString()
  };
}

export function toBatchGroupRecord(group: {
  id: string;
  batchId: string;
  intakeSessionId: string | null;
  label: string;
  confidence: number | null;
  documentIds: unknown;
  status: string;
  createdAt: Date;
}): IntakeBatchGroupRecord {
  return {
    id: group.id,
    batchId: group.batchId,
    intakeSessionId: group.intakeSessionId,
    label: group.label,
    confidence: group.confidence,
    documentIds: toStringArray(group.documentIds),
    status: group.status as IntakeBatchGroupRecord["status"],
    createdAt: iso(group.createdAt) ?? new Date().toISOString()
  };
}

export function toBatchRecord(
  batch: {
    id: string;
    userId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  groups: Array<{
    id: string;
    batchId: string;
    intakeSessionId: string | null;
    label: string;
    confidence: number | null;
    documentIds: unknown;
    status: string;
    createdAt: Date;
  }>
): IntakeBatchRecord {
  return {
    id: batch.id,
    userId: batch.userId,
    status: batch.status as IntakeBatchRecord["status"],
    createdAt: iso(batch.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(batch.updatedAt) ?? new Date().toISOString(),
    groups: groups.map(toBatchGroupRecord)
  };
}
