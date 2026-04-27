/**
 * Domain service for concept generation, persistence, and management.
 * Orchestrates LLM concept generation with deal workspace context.
 */
import { randomUUID } from "node:crypto";

import { generateConceptsWithLlm, generateConceptVariationsWithLlm } from "@/lib/analysis/llm/concept";
import { getRepository } from "@/lib/repository";
import { getDealForViewer } from "@/lib/deals/service";
import type {
  ConceptRecord,
  ConceptGenerationResult,
  DeliverableItem,
  Viewer,
} from "@/lib/types";

export async function listConceptsForDeal(dealId: string): Promise<ConceptRecord[]> {
  return getRepository().listConceptsForDeal(dealId);
}

async function requireDealConceptForViewer(viewer: Viewer, dealId: string, conceptId: string) {
  const aggregate = await getDealForViewer(viewer, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const concept = (await getRepository().listConceptsForDeal(dealId)).find(
    (item) => item.id === conceptId
  );
  if (!concept) {
    throw new Error("Concept not found.");
  }

  return concept;
}

export async function generateConceptsForDeliverable(
  viewer: Viewer,
  dealId: string,
  deliverableIndex: number
): Promise<ConceptGenerationResult> {
  const aggregate = await getDealForViewer(viewer, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const deliverables = (aggregate.terms?.deliverables ?? []) as DeliverableItem[];
  if (deliverableIndex < 0 || deliverableIndex >= deliverables.length) {
    throw new Error("Invalid deliverable index.");
  }

  const result = await generateConceptsWithLlm(aggregate, deliverableIndex);
  const batch = randomUUID();
  const now = new Date().toISOString();

  await getRepository().saveConcepts(
    dealId,
    result.concepts.map((concept) => ({
      deliverableIndex,
      title: concept.title,
      hook: concept.hook,
      summary: concept.summary,
      structure: concept.structure,
      messagingIntegration: concept.messagingIntegration,
      ctaApproach: concept.ctaApproach,
      platformNotes: concept.platformNotes,
      moodAndTone: concept.moodAndTone,
      rationale: concept.rationale,
      isVariation: false,
      parentConceptId: null,
      generationBatch: batch,
      modelVersion: result.modelVersion,
    }))
  );

  return {
    concepts: result.concepts,
    generatedAt: now,
    modelVersion: result.modelVersion,
  };
}

export async function generateConceptVariations(
  viewer: Viewer,
  dealId: string,
  deliverableIndex: number,
  parentConceptId: string
): Promise<ConceptGenerationResult> {
  const aggregate = await getDealForViewer(viewer, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const existingConcepts = await getRepository().listConceptsForDeal(dealId);
  const parentConcept = existingConcepts.find((c) => c.id === parentConceptId);
  if (!parentConcept) {
    throw new Error("Parent concept not found.");
  }

  const result = await generateConceptVariationsWithLlm(aggregate, deliverableIndex, {
    title: parentConcept.title,
    hook: parentConcept.hook,
    summary: parentConcept.summary,
    structure: parentConcept.structure,
  });

  const batch = randomUUID();
  const now = new Date().toISOString();

  await getRepository().saveConcepts(
    dealId,
    result.concepts.map((concept) => ({
      deliverableIndex,
      title: concept.title,
      hook: concept.hook,
      summary: concept.summary,
      structure: concept.structure,
      messagingIntegration: concept.messagingIntegration,
      ctaApproach: concept.ctaApproach,
      platformNotes: concept.platformNotes,
      moodAndTone: concept.moodAndTone,
      rationale: concept.rationale,
      isVariation: true,
      parentConceptId,
      generationBatch: batch,
      modelVersion: result.modelVersion,
    }))
  );

  return {
    concepts: result.concepts,
    generatedAt: now,
    modelVersion: result.modelVersion,
  };
}

export async function toggleConceptFavorite(
  viewer: Viewer,
  conceptId: string,
  dealId: string,
  isFavorite: boolean
): Promise<ConceptRecord | null> {
  await requireDealConceptForViewer(viewer, dealId, conceptId);
  return getRepository().toggleConceptFavorite(conceptId, isFavorite);
}

export async function updateConcept(
  viewer: Viewer,
  dealId: string,
  conceptId: string,
  patch: Partial<
    Pick<
      ConceptRecord,
      "title" | "hook" | "summary" | "structure" | "messagingIntegration" | "ctaApproach" | "platformNotes" | "moodAndTone" | "rationale"
    >
  >
): Promise<ConceptRecord | null> {
  await requireDealConceptForViewer(viewer, dealId, conceptId);
  return getRepository().updateConcept(conceptId, patch);
}
