"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
  deleteAccountAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
} from "@/app/actions";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import { PostHogSubmitButton } from "@/components/posthog-submit-button";

type BillingControlsProps = {
  hasActiveSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

export function BillingControls({
  hasActiveSubscription,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: BillingControlsProps) {
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const endDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "the end of your billing period";

  if (!hasActiveSubscription && !cancelAtPeriodEnd) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {cancelAtPeriodEnd ? (
          <form action={resumeSubscriptionAction}>
            <PostHogSubmitButton
              eventName="billing_resume_clicked"
              payload={{ source: "billing_overview" }}
              pendingLabel="Resuming…"
              className="inline-flex items-center justify-center rounded-lg border border-ocean/25 bg-white px-4 py-2 text-sm font-medium text-ocean transition-colors hover:bg-ocean/5"
            >
              Resume subscription
            </PostHogSubmitButton>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setPauseDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-destructive/25 bg-white px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
          >
            Pause subscription
          </button>
        )}
      </div>

      <ConfirmDestructiveDialog
        open={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        title="Pause subscription"
        description={
          <>
            <p>
              Your subscription will remain active until <strong>{endDate}</strong>. After that,
              billing stops and you will be moved to the free plan.
            </p>
            <p>
              Your workspaces, documents, and data stay safe. You can resume your subscription
              anytime to restore full access.
            </p>
          </>
        }
        confirmLabel="Pause subscription"
        confirmLoading={pauseLoading}
        onConfirm={() => {
          setPauseLoading(true);
          pauseSubscriptionAction()
            .then(() => setPauseDialogOpen(false))
            .catch(() => setPauseDialogOpen(false))
            .finally(() => setPauseLoading(false));
        }}
      />

      <section className="mt-8 rounded-lg border border-clay/20 bg-clay/[0.02] p-6">
        <h3 className="text-sm font-semibold text-clay">Danger zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-clay/30 bg-white px-4 py-2 text-sm font-medium text-clay transition-colors hover:bg-clay/5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete account and all data
        </button>
      </section>

      <ConfirmDestructiveDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete your account"
        description={
          <>
            <p>
              This is <strong>irreversible</strong>. All your workspaces, documents, invoices,
              partnership records, and stored files will be permanently deleted.
            </p>
            <p>
              If you just want to stop billing, consider pausing your subscription instead — you
              keep access until {endDate} and your data stays safe.
            </p>
          </>
        }
        confirmLabel="Delete permanently"
        confirmLoading={deleteLoading}
        alternative={{
          label: "Pause subscription instead",
          onClick: () => {
            setDeleteDialogOpen(false);
            setPauseDialogOpen(true);
          },
        }}
        onConfirm={() => {
          setDeleteLoading(true);
          deleteAccountAction()
            .then(() => setDeleteDialogOpen(false))
            .catch(() => setDeleteDialogOpen(false))
            .finally(() => setDeleteLoading(false));
        }}
      />
    </>
  );
}
