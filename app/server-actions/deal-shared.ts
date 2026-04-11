/**
 * Shared helpers for deal server actions.
 * This file keeps cache invalidation, safe redirect handling, and workspace deletion behavior in one place for the deal action modules.
 */
import { revalidatePath, updateTag } from "next/cache";

import { deleteDealForViewer as deleteDealFromDeals } from "@/lib/deals";
import { startServerDebug } from "@/lib/server-debug";
import type { Viewer } from "@/lib/types";

export function invalidateDeals(viewerId: string, dealId?: string) {
  updateTag(`user-${viewerId}-deals`);
  if (dealId) {
    updateTag(`deal-${dealId}`);
  }
}

export function invalidateDealWorkspace(viewerId: string, dealId: string) {
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app");
  invalidateDeals(viewerId, dealId);
}

export function invalidateInvoiceSurfaces(viewerId: string, dealId: string) {
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath(`/app/p/${dealId}/invoice`);
  revalidatePath("/app/payments");
  revalidatePath("/app");
  invalidateDeals(viewerId, dealId);
  updateTag(`user-${viewerId}-payments`);
  updateTag(`user-${viewerId}-notifications`);
}

export function resolveSafeWorkspaceRedirect(target: string | null | undefined) {
  if (!target || !target.startsWith("/app")) {
    return "/app";
  }

  return target;
}

export async function performWorkspaceDelete(
  viewer: Viewer,
  dealId: string,
  redirectTo: string,
  actionName: string
) {
  const debug = startServerDebug("action_delete_workspace", {
    action: actionName,
    dealId,
    redirectTo
  });

  try {
    const deleted = await deleteDealFromDeals(viewer, dealId);

    if (!deleted) {
      throw new Error("Could not delete workspace.");
    }

    debug.complete({
      viewerId: viewer.id,
      dealId
    });
  } catch (error) {
    debug.fail(error, {
      viewerId: viewer.id,
      dealId
    });
    throw error;
  }

  revalidatePath("/app");
  revalidatePath("/app/p/history");
  revalidatePath(`/app/p/${dealId}`);
  revalidatePath("/app/payments");
  revalidatePath("/app/inbox");
  revalidatePath("/app/analytics");
  revalidatePath("/app/settings/notifications");
  invalidateDeals(viewer.id, dealId);
  updateTag(`user-${viewer.id}-payments`);
  updateTag(`user-${viewer.id}-notifications`);
}
