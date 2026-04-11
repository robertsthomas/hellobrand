/**
 * Shared helpers for intake server actions.
 * This file keeps common file parsing and batch redirect behavior out of the session and batch action modules.
 */
import { redirect } from "next/navigation";

export function getUploadedFiles(formData: FormData) {
  return formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export function redirectToCreatedBatch(batch: {
  id: string;
  groups: Array<{ intakeSessionId: string | null }>;
}) {
  if (batch.groups.length <= 1) {
    const group = batch.groups[0];
    if (group?.intakeSessionId) {
      redirect(`/app/intake/${group.intakeSessionId}`);
    }
  }

  redirect(`/app/intake/batch/${batch.id}`);
}
