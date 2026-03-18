import { z } from "zod";

import type { AssistantUiBlock } from "@/lib/types";

const dealStatusSchema = z.enum([
  "contract_received",
  "negotiating",
  "signed",
  "deliverables_pending",
  "submitted",
  "awaiting_payment",
  "paid",
  "completed"
]);

const paymentStatusSchema = z.enum([
  "not_invoiced",
  "invoiced",
  "awaiting_payment",
  "paid",
  "late"
]);

const workspaceListItemSchema = z.object({
  dealId: z.string(),
  brandName: z.string(),
  campaignName: z.string(),
  status: dealStatusSchema,
  paymentStatus: paymentStatusSchema,
  href: z.string(),
  prompt: z.string().nullable().optional()
}).transform((value) => ({
  ...value,
  prompt: value.prompt ?? null
}));

const navigationBlockSchema = z.object({
  type: z.literal("navigation"),
  href: z.string(),
  label: z.string(),
  description: z.string().nullable().optional()
}).transform((value) => ({
  ...value,
  description: value.description ?? null
}));

const legacyNavigationBlockSchema = z
  .object({
    href: z.string(),
    label: z.string(),
    description: z.string().nullable().optional()
  })
  .transform((value) => ({
    type: "navigation" as const,
    href: value.href,
    label: value.label,
    description: value.description ?? null
  }));

const draftBlockSchema = z.object({
  type: z.literal("draft"),
  label: z.string(),
  subject: z.string(),
  body: z.string()
});

const workspaceListBlockSchema = z.object({
  type: z.literal("workspace-list"),
  title: z.string(),
  description: z.string(),
  prompt: z.string().nullable().optional(),
  workspaces: z.array(workspaceListItemSchema)
}).transform((value) => ({
  ...value,
  prompt: value.prompt ?? null
}));

const assistantUiBlockSchema = z.union([
  navigationBlockSchema,
  legacyNavigationBlockSchema,
  draftBlockSchema,
  workspaceListBlockSchema
]);

export function parseAssistantUiBlock(value: unknown): AssistantUiBlock | null {
  const parsed = assistantUiBlockSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function createAssistantNavigationBlock(input: {
  href: string;
  label: string;
  description?: string | null;
}): AssistantUiBlock {
  return {
    type: "navigation",
    href: input.href,
    label: input.label,
    description: input.description ?? null
  };
}

export function createAssistantDraftBlock(input: {
  label: string;
  subject: string;
  body: string;
}): AssistantUiBlock {
  return {
    type: "draft",
    label: input.label,
    subject: input.subject,
    body: input.body
  };
}
