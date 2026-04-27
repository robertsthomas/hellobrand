"use server";

/**
 * Deal lifecycle actions.
 * This file handles workspace deletion and archive state changes for an existing partnership.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import { updateDealForViewer as updateDealFromDeals } from "@/lib/deals";

import {
  invalidateDeals,
  performWorkspaceDelete,
  resolveSafeWorkspaceRedirect
} from "./deal-shared";

async function deleteWorkspaceAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const redirectTo = resolveSafeWorkspaceRedirect(String(formData.get("redirectTo") ?? "/app"));

  await performWorkspaceDelete(viewer, dealId, redirectTo, "deleteWorkspaceAction");
  redirect(redirectTo);
}

export async function deleteWorkspaceConfirmedAction(
  _previousState: { error: string | null },
  formData: FormData
) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const redirectTo = resolveSafeWorkspaceRedirect(String(formData.get("redirectTo") ?? "/app"));
  const confirmation = String(formData.get("confirmationText") ?? "").trim().toLowerCase();

  if (confirmation !== "delete") {
    return {
      error: 'Type "delete" to confirm this partnership deletion.'
    };
  }

  await performWorkspaceDelete(
    viewer,
    dealId,
    redirectTo,
    "deleteWorkspaceConfirmedAction"
  );
  redirect(redirectTo);
}

export async function archiveDealAction(dealId: string) {
  const viewer = await requireViewer();
  const deal = await updateDealFromDeals(viewer, dealId, {});

  if (!deal) {
    return { error: "Partnership not found." };
  }

  if (deal.status === "archived") {
    return { error: "Partnership is already archived." };
  }

  await updateDealFromDeals(viewer, dealId, {
    statusBeforeArchive: deal.status,
    status: "archived"
  });

  revalidatePath("/app");
  revalidatePath("/app/p/history");
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app/payments");
  revalidatePath("/admin");
  invalidateDeals(viewer.id, dealId);
}

export async function unarchiveDealAction(dealId: string) {
  const viewer = await requireViewer();
  const deal = await updateDealFromDeals(viewer, dealId, {});

  if (!deal) {
    return { error: "Partnership not found." };
  }

  if (deal.status !== "archived") {
    return { error: "Partnership is not archived." };
  }

  const restoreStatus = deal.statusBeforeArchive ?? "completed";

  await updateDealFromDeals(viewer, dealId, {
    status: restoreStatus as never,
    statusBeforeArchive: null
  });

  revalidatePath("/app");
  revalidatePath("/app/p/history");
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app/payments");
  revalidatePath("/admin");
  invalidateDeals(viewer.id, dealId);
}
