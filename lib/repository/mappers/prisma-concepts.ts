/**
 * Prisma-to-app-record mapper for Concept records.
 */
import type { Concept as PrismaConcept } from "@prisma/client";
import type { ConceptRecord } from "@/lib/types";

export function mapPrismaConceptToRecord(row: PrismaConcept): ConceptRecord {
  return {
    id: row.id,
    dealId: row.dealId,
    deliverableIndex: row.deliverableIndex,
    title: row.title,
    hook: row.hook,
    summary: row.summary,
    structure: row.structure,
    messagingIntegration: row.messagingIntegration,
    ctaApproach: row.ctaApproach,
    platformNotes: row.platformNotes,
    moodAndTone: row.moodAndTone,
    rationale: row.rationale,
    isFavorite: row.isFavorite,
    isVariation: row.isVariation,
    parentConceptId: row.parentConceptId,
    generationBatch: row.generationBatch,
    modelVersion: row.modelVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
