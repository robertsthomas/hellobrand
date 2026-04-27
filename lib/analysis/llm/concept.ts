/**
 * LLM tasks for concept generation and variation.
 * Generates branded creator content concepts from deal workspace context.
 */
import type {
  DealAggregate,
  DeliverableItem,
  GeneratedConcept,
} from "@/lib/types";
import {
  buildConceptContext,
} from "@/lib/analysis/normalizers";
import {
  conceptGenerationSystemPrompt,
  conceptGenerationUserPrompt,
  conceptVariationUserPrompt,
} from "@/lib/analysis/prompts";

import {
  conceptGenerationResponseSchema,
  getLlmModel,
  requestStructured,
} from "./shared";

function deliverableLabel(deliverable: DeliverableItem | null, index: number): string {
  if (!deliverable) return `Deliverable ${index + 1}`;
  const parts = [deliverable.title];
  if (deliverable.channel) parts.push(deliverable.channel);
  if (deliverable.quantity) parts.push(`${deliverable.quantity}x`);
  return parts.join(" ") || `Deliverable ${index + 1}`;
}

// fallow-ignore-next-line complexity
export async function generateConceptsWithLlm(
  aggregate: DealAggregate,
  deliverableIndex: number
): Promise<{ concepts: GeneratedConcept[]; modelVersion: string }> {
  const contextJson = buildConceptContext(aggregate, deliverableIndex);
  const deliverables = (aggregate.terms?.deliverables ?? []) as DeliverableItem[];
  const deliverable = deliverables[deliverableIndex] ?? null;
  const label = deliverableLabel(deliverable, deliverableIndex);

  const payload = await requestStructured(
    "generate_concepts",
    conceptGenerationSystemPrompt(),
    conceptGenerationUserPrompt(contextJson, label),
    conceptGenerationResponseSchema,
    { concepts: [] },
    {
      dealId: aggregate.deal.id,
      purpose: "concept_generation",
    }
  );

  const concepts: GeneratedConcept[] = (payload.concepts ?? []).map((c) => ({
    title: c.title,
    hook: c.hook,
    summary: c.summary,
    structure: c.structure,
    messagingIntegration: c.messagingIntegration,
    ctaApproach: c.ctaApproach,
    platformNotes: c.platformNotes ?? null,
    moodAndTone: c.moodAndTone,
    rationale: c.rationale,
  }));

  return {
    concepts,
    modelVersion: `llm:generate_concepts:${getLlmModel("generate_concepts")}`,
  };
}

// fallow-ignore-next-line complexity
export async function generateConceptVariationsWithLlm(
  aggregate: DealAggregate,
  deliverableIndex: number,
  baseConcept: { title: string; hook: string; summary: string; structure: string }
): Promise<{ concepts: GeneratedConcept[]; modelVersion: string }> {
  const contextJson = buildConceptContext(aggregate, deliverableIndex);
  const deliverables = (aggregate.terms?.deliverables ?? []) as DeliverableItem[];
  const deliverable = deliverables[deliverableIndex] ?? null;
  const label = deliverableLabel(deliverable, deliverableIndex);

  const payload = await requestStructured(
    "generate_concepts",
    conceptGenerationSystemPrompt(),
    conceptVariationUserPrompt(contextJson, label, baseConcept),
    conceptGenerationResponseSchema,
    { concepts: [] },
    {
      dealId: aggregate.deal.id,
      purpose: "concept_variations",
    }
  );

  const concepts: GeneratedConcept[] = (payload.concepts ?? []).map((c) => ({
    title: c.title,
    hook: c.hook,
    summary: c.summary,
    structure: c.structure,
    messagingIntegration: c.messagingIntegration,
    ctaApproach: c.ctaApproach,
    platformNotes: c.platformNotes ?? null,
    moodAndTone: c.moodAndTone,
    rationale: c.rationale,
  }));

  return {
    concepts,
    modelVersion: `llm:concept_variations:${getLlmModel("generate_concepts")}`,
  };
}
