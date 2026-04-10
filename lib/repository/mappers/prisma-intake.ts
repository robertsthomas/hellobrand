/**
 * Prisma mappers for intake-session records.
 * These helpers keep intake row conversion out of the repository implementation.
 */

import type { IntakeSessionRecord } from "@/lib/types";

import { iso } from "./prisma-shared";

export function toIntakeSessionRecord(session: {
  id: string;
  userId: string;
  dealId: string;
  status: string;
  errorMessage: string | null;
  inputSource: string | null;
  draftBrandName: string | null;
  draftCampaignName: string | null;
  draftNotes: string | null;
  draftPastedText: string | null;
  draftPastedTextTitle: string | null;
  duplicateCheckStatus: string | null;
  duplicateMatchJson: unknown | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
}): IntakeSessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    dealId: session.dealId,
    status: session.status as IntakeSessionRecord["status"],
    errorMessage: session.errorMessage,
    inputSource: (session.inputSource ?? null) as IntakeSessionRecord["inputSource"],
    draftBrandName: session.draftBrandName,
    draftCampaignName: session.draftCampaignName,
    draftNotes: session.draftNotes,
    draftPastedText: session.draftPastedText,
    draftPastedTextTitle: session.draftPastedTextTitle,
    duplicateCheckStatus:
      (session.duplicateCheckStatus ?? null) as IntakeSessionRecord["duplicateCheckStatus"],
    duplicateMatchJson: session.duplicateMatchJson ?? null,
    createdAt: iso(session.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(session.updatedAt) ?? new Date().toISOString(),
    completedAt: iso(session.completedAt),
    expiresAt: iso(session.expiresAt)
  };
}
