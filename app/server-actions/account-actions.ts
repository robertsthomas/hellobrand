"use server";

import { revalidatePath } from "next/cache";

import { requireViewer } from "@/lib/auth";
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
  revalidatePath("/app/profile");
  revalidatePath("/app");
}
