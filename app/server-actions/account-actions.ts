"use server";

import { BillingInterval, PlanTier } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import {
  cancelCurrentSubscriptionForViewer,
  createBillingPortalSessionForViewer,
  createCheckoutSessionForViewer
} from "@/lib/billing/service";
import { updatePaymentForViewer } from "@/lib/payments";
import { updateProfileForViewer } from "@/lib/profile";
import {
  paymentRecordInputSchema,
  profileInputSchema
} from "@/lib/validation";
import {
  parseNullableNumber,
  parseNullableString
} from "@/app/action-helpers";

function isNextRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

export async function savePaymentAction(formData: FormData) {
  const viewer = await requireViewer();
  const dealId = String(formData.get("dealId") ?? "");
  const input = paymentRecordInputSchema.parse({
    amount: parseNullableNumber(formData.get("amount")),
    currency: parseNullableString(formData.get("currency")),
    invoiceDate: parseNullableString(formData.get("invoiceDate")),
    dueDate: parseNullableString(formData.get("dueDate")),
    paidDate: parseNullableString(formData.get("paidDate")),
    status: String(formData.get("status") ?? ""),
    notes: parseNullableString(formData.get("notes")),
    source: parseNullableString(formData.get("source"))
  });

  await updatePaymentForViewer(viewer, dealId, input);
  revalidatePath("/app/payments");
  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app");
  updateTag(`user-${viewer.id}-payments`);
  updateTag(`user-${viewer.id}-deals`);
  updateTag(`deal-${dealId}`);
}

export async function saveProfileAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = profileInputSchema.parse({
    displayName: parseNullableString(formData.get("displayName")),
    creatorLegalName: parseNullableString(formData.get("creatorLegalName")),
    businessName: parseNullableString(formData.get("businessName")),
    contactEmail: parseNullableString(formData.get("contactEmail")),
    preferredSignature: parseNullableString(formData.get("preferredSignature")),
    payoutDetails: parseNullableString(formData.get("payoutDetails"))
  });

  await updateProfileForViewer(viewer, input);
  revalidatePath("/app/settings/profile");
  revalidatePath("/app");
  updateTag(`user-${viewer.id}-profile`);
}

export async function startCheckoutAction(formData: FormData) {
  const viewer = await requireViewer();
  const planTier = String(formData.get("planTier") ?? "");
  const interval = String(formData.get("interval") ?? "");
  const validPlanTiers = [PlanTier.basic, PlanTier.standard, PlanTier.premium];
  const validIntervals = [BillingInterval.month, BillingInterval.year];

  if (!validPlanTiers.includes(planTier as PlanTier)) {
    redirect("/app/settings/billing?billing_error=Invalid%20plan%20selection.");
  }

  if (!validIntervals.includes(interval as BillingInterval)) {
    redirect("/app/settings/billing?billing_error=Invalid%20billing%20interval.");
  }

  try {
    const result = await createCheckoutSessionForViewer(viewer, {
      planTier: planTier as PlanTier,
      interval: interval as BillingInterval
    });
    redirect(result.url);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Could not start billing checkout.";
    redirect(`/app/settings/billing?billing_error=${encodeURIComponent(message)}`);
  }
}

export async function openBillingPortalAction() {
  const viewer = await requireViewer();

  try {
    const result = await createBillingPortalSessionForViewer(viewer);
    redirect(result.url);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Could not open Stripe billing portal.";
    redirect(`/app/settings/billing?billing_error=${encodeURIComponent(message)}`);
  }
}

export async function cancelSubscriptionAction() {
  const viewer = await requireViewer();

  try {
    const result = await cancelCurrentSubscriptionForViewer(viewer);
    revalidatePath("/app/settings/billing");
    revalidatePath("/app");
    updateTag(`user-${viewer.id}-deals`);
    updateTag(`user-${viewer.id}-payments`);

    const message =
      result.mode === "trial_scheduled"
        ? `Your trial will stay active until ${result.endsAt ? new Date(result.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "the end of the trial"}. You will not be charged after it ends.`
        : result.mode === "scheduled"
          ? `Your trial is already set to end on ${result.endsAt ? new Date(result.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "the trial end date"}.`
          : "Your subscription has been canceled and access has ended.";

    redirect(`/app/settings/billing?billing_notice=${encodeURIComponent(message)}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Could not cancel the subscription.";
    redirect(`/app/settings/billing?billing_error=${encodeURIComponent(message)}`);
  }
}
