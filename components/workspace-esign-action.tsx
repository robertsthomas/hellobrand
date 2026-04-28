"use client";

import { useRouter } from "next/navigation";
/**
 * Workspace header action for sending the current deal's contract through Documenso.
 * It keeps the UI feedback local here and delegates all signing orchestration to the server action.
 */
import { useTransition } from "react";
import { toast } from "sonner";

import { sendForESignatureAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { DealRecord } from "@/lib/types";

function getStatusLabel(esignStatus: DealRecord["esignStatus"]) {
  switch (esignStatus) {
    case "PENDING":
      return "Waiting on signatures";
    case "COMPLETED":
      return "Signed in Documenso";
    case "REJECTED":
      return "Previous request was rejected";
    default:
      return null;
  }
}

function getButtonLabel(esignStatus: DealRecord["esignStatus"]) {
  if (esignStatus === "PENDING") {
    return "Sent for eSignature";
  }

  if (esignStatus === "COMPLETED") {
    return "eSignature complete";
  }

  if (esignStatus === "REJECTED") {
    return "Resend for eSignature";
  }

  return "Send for eSignature";
}

export function WorkspaceESignAction({
  dealId,
  esignStatus,
}: {
  dealId: string;
  esignStatus: DealRecord["esignStatus"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const statusLabel = getStatusLabel(esignStatus);
  const isDisabled = esignStatus === "PENDING" || esignStatus === "COMPLETED";

  return (
    <div className="flex items-center gap-3">
      {statusLabel ? <p className="text-sm text-muted-foreground">{statusLabel}</p> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || isDisabled}
        onClick={() => {
          startTransition(async () => {
            try {
              const formData = new FormData();
              formData.set("dealId", dealId);
              const payload = await sendForESignatureAction(formData);
              toast.success(payload.message);
              router.refresh();
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not send for eSignature."
              );
            }
          });
        }}
      >
        {isPending ? "Sending..." : getButtonLabel(esignStatus)}
      </Button>
    </div>
  );
}
