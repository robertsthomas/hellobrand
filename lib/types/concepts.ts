/**
 * Concept generation types for branded creator content ideation.
 * Each concept represents a creative direction tailored to a specific deliverable.
 */

export interface GeneratedConcept {
  title: string;
  hook: string;
  summary: string;
  structure: string;
  messagingIntegration: string;
  ctaApproach: string;
  platformNotes: string | null;
  moodAndTone: string;
  rationale: string;
}

export interface ConceptGenerationResult {
  concepts: GeneratedConcept[];
  generatedAt: string;
  modelVersion: string;
}

export interface ConceptRecord {
  id: string;
  dealId: string;
  deliverableIndex: number;
  title: string;
  hook: string;
  summary: string;
  structure: string;
  messagingIntegration: string;
  ctaApproach: string;
  platformNotes: string | null;
  moodAndTone: string;
  rationale: string;
  isFavorite: boolean;
  isVariation: boolean;
  parentConceptId: string | null;
  generationBatch: string;
  modelVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConceptGenerationRequest = {
  mode: "generate" | "variations";
  deliverableIndex: number;
  parentConceptId?: string;
};
