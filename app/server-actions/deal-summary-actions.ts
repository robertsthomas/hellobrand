"use server";

/**
 * Deal summary and review actions.
 * This file handles summary version changes, pending term changes, and deliverable updates after a workspace is already in progress.
 */
import { revalidatePath } from "next/cache";

import { requireViewer } from "@/lib/auth";
import {
  activateSummaryVariantForViewer,
  applyPendingChangesForViewer,
  dismissPendingChangesForViewer,
  restoreSummaryForViewer,
  updateTermsForViewer as updateTermsFromDeals
} from "@/lib/deals";
import { captureHandledError } from "@/lib/monitoring/sentry";
import type { SummaryType } from "@/lib/types";

import { invalidateDeals, invalidateDealWorkspace } from "./deal-shared";

const SUMMARY_TYPES = ["legal", "plain_language", "short"] as const;

export async function activateSummaryVariantAction(
  dealId: string,
  summaryType: SummaryType
) {
  const viewer = await requireViewer();

  if (!SUMMARY_TYPES.includes(summaryType)) {
    return {
      error: "Unknown summary type."
    };
  }

  try {
    await activateSummaryVariantForViewer(viewer, dealId, summaryType);
    invalidateDealWorkspace(viewer.id, dealId);
    return { ok: true };
  } catch (error) {
    captureHandledError(error, {
      area: "workspace",
      name: "activate_summary_variant",
      viewerId: viewer.id,
      captureExpected: true,
      extras: {
        dealId,
        summaryType
      }
    });
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not switch summary versions right now."
    };
  }
}

export async function restoreSummaryVersionAction(dealId: string, summaryId: string) {
  const viewer = await requireViewer();

  try {
    await restoreSummaryForViewer(viewer, dealId, summaryId);
    invalidateDealWorkspace(viewer.id, dealId);
    return { ok: true };
  } catch (error) {
    captureHandledError(error, {
      area: "workspace",
      name: "restore_summary_version",
      viewerId: viewer.id,
      captureExpected: true,
      extras: {
        dealId,
        summaryId
      }
    });
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not restore that summary version."
    };
  }
}

export async function applyPendingChangesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const acceptedFieldsJson = String(formData.get("acceptedFieldsJson") ?? "[]");
  const acceptedFields: string[] = JSON.parse(acceptedFieldsJson);

  await applyPendingChangesForViewer(viewer, dealId, acceptedFields);
  invalidateDealWorkspace(viewer.id, dealId);
}

export async function dismissPendingChangesAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");

  await dismissPendingChangesForViewer(viewer, dealId);
  invalidateDealWorkspace(viewer.id, dealId);
}

export async function updateDeliverablesAction(dealId: string, deliverables: unknown[]) {
  const viewer = await requireViewer();
  await updateTermsFromDeals(viewer, dealId, { deliverables: deliverables as never });
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewer.id, dealId);
}
