import { z } from "zod";

export const emailDraftSchema = z.object({
  subject: z.string(),
  body: z.string()
});

export type EmailDraft = z.infer<typeof emailDraftSchema>;
