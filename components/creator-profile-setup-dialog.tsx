"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveProfileAction } from "@/app/actions";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function normalizeHandle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function CreatorProfileSetupDialog({
  email,
  initialName,
  initialHandle,
  configured
}: {
  email: string;
  initialName: string;
  initialHandle: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            buttonVariants({
              variant: configured ? "outline" : "default",
              className: configured ? "" : "bg-ocean text-white hover:bg-ocean/90"
            })
          )}
        >
          {configured ? "Edit creator profile" : "Setup creator profile"}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-md border-black/10 bg-background p-0 dark:border-white/10">
        <form
          action={(formData) => {
            startTransition(async () => {
              const creatorName = String(formData.get("creatorLegalName") ?? "").trim();
              const creatorHandle = normalizeHandle(
                String(formData.get("businessName") ?? "")
              );

              formData.set("creatorLegalName", creatorName);
              formData.set("businessName", creatorHandle);
              formData.set("displayName", creatorName || creatorHandle);
              formData.set("contactEmail", email);

              await saveProfileAction(formData);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader className="border-b border-black/8 px-6 pt-6 pb-5 text-left dark:border-white/10">
            <DialogTitle className="text-xl font-semibold text-ink">
              Setup creator profile
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-black/60 dark:text-white/65">
              Save your name and handle so HelloBrand can prefill creator defaults in
              intake and partnership workspaces.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-5">
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Name
              <input
                className="rounded-2xl border border-black/10 bg-sand/40 px-4 py-3 text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/20 dark:border-white/12 dark:bg-white/[0.04]"
                name="creatorLegalName"
                defaultValue={initialName}
                placeholder="Sarah Roberts"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Handle
              <input
                className="rounded-2xl border border-black/10 bg-sand/40 px-4 py-3 text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/20 dark:border-white/12 dark:bg-white/[0.04]"
                name="businessName"
                defaultValue={initialHandle}
                placeholder="@therobertscasa"
              />
              <span className="text-xs font-normal text-black/50 dark:text-white/50">
                We&apos;ll use your handle as the business fallback for intake and deal
                defaults.
              </span>
            </label>

            <div className="rounded-2xl bg-sand/45 px-4 py-3 dark:bg-white/[0.04]">
              <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                Email
              </div>
              <div className="mt-2 text-sm font-semibold text-ink">{email}</div>
              <input type="hidden" name="contactEmail" value={email} />
            </div>
          </div>

          <DialogFooter className="border-t border-black/8 px-6 py-4 dark:border-white/10">
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                buttonVariants({
                  className: "w-full bg-ocean text-white hover:bg-ocean/90"
                }),
                isPending ? "cursor-not-allowed opacity-60" : ""
              )}
            >
              {isPending ? "Saving profile..." : "Save creator profile"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
