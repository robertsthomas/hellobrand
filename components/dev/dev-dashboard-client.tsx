"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, RotateCcw, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOTIFICATIONS_READ_STORAGE_KEY } from "@/lib/notifications";
import type { DevDashboardSnapshot, DevDashboardViewer } from "@/lib/dev-dashboard";
import {
  clearLocalWorkspaces,
  readLocalWorkspaceManifest
} from "@/lib/browser/local-workspace-queue";

type ResetAction =
  | "reset_onboarding"
  | "reset_guide"
  | "clear_database"
  | "clear_users"
  | "clear_both";

const ASSISTANT_TONE_STORAGE_KEY = "hb-assistant-tone";

function formatCount(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function SnapshotStat({
  label,
  value
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-foreground">
        {formatCount(value)}
      </div>
    </div>
  );
}

export function DevDashboardClient({
  viewer,
  snapshot
}: {
  viewer: DevDashboardViewer;
  snapshot: DevDashboardSnapshot;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ResetAction | "clear_browser" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");

  const destructiveActionsUnlocked = confirmed && confirmValue.trim() === "RESET";

  async function runServerAction(action: ResetAction) {
    setPendingAction(action);

    try {
      const response = await fetch("/api/dev/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        redirectToLogin?: boolean;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not complete the reset.");
        return;
      }

      toast.success(payload.message ?? "Reset complete.");

      if (payload.redirectToLogin) {
        window.location.href = "/login";
        return;
      }

      router.refresh();
    } catch {
      toast.error("Could not complete the reset.");
    } finally {
      setPendingAction(null);
    }
  }

  async function clearBrowserState() {
    setPendingAction("clear_browser");

    try {
      const localWorkspaceIds = readLocalWorkspaceManifest().map((item) => item.localId);

      if (localWorkspaceIds.length > 0) {
        await clearLocalWorkspaces(localWorkspaceIds);
      }

      window.localStorage.removeItem(NOTIFICATIONS_READ_STORAGE_KEY);
      window.localStorage.removeItem(ASSISTANT_TONE_STORAGE_KEY);

      if ("indexedDB" in window) {
        window.indexedDB.deleteDatabase("hellobrand-local-workspace-queue");
      }

      toast.success("Local browser test state cleared.");
    } catch {
      toast.error("Could not clear local browser test state.");
    } finally {
      setPendingAction(null);
    }
  }

  const database = snapshot.database;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Dev dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Local-only reset utilities for the database, Clerk users, onboarding, and guide state.
          </p>
          <div className="text-sm text-muted-foreground">
            Signed in as {viewer.displayName ?? viewer.email ?? viewer.id} on {snapshot.environment} / {snapshot.host ?? "unknown host"}
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Destructive actions</AlertTitle>
          <AlertDescription>
            Database wipes remove all app rows. Clerk wipes delete every user in the connected Clerk instance.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SnapshotStat label="DB users" value={database?.users ?? null} />
          <SnapshotStat label="Profiles" value={database?.profiles ?? null} />
          <SnapshotStat label="Onboarding states" value={database?.onboardingStates ?? null} />
          <SnapshotStat label="Deals" value={database?.deals ?? null} />
          <SnapshotStat label="Clerk users" value={snapshot.clerkUserCount} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RotateCcw className="h-5 w-5" />
                Current user resets
              </CardTitle>
              <CardDescription>
                Use these while iterating on onboarding and in-app guidance without wiping everyone else.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded border border-border p-4">
                <div className="text-sm font-medium">Reset onboarding flow</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deletes this user&apos;s onboarding row so the blocking onboarding modal appears again.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={pendingAction !== null || !snapshot.databaseConfigured}
                  onClick={() => void runServerAction("reset_onboarding")}
                >
                  Reset onboarding
                </Button>
              </div>

              <div className="rounded border border-border p-4">
                <div className="text-sm font-medium">Reset tooltip and guide flow</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clears dismissed and completed guide steps for the current signed-in user while keeping onboarding complete.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={pendingAction !== null || !snapshot.databaseConfigured}
                  onClick={() => void runServerAction("reset_guide")}
                >
                  Reset tooltips
                </Button>
              </div>

              <div className="rounded border border-border p-4">
                <div className="text-sm font-medium">Clear local browser test state</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Removes notification read state, assistant tone preference, and the local workspace queue stored in this browser.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={pendingAction !== null}
                  onClick={() => void clearBrowserState()}
                >
                  Clear browser state
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldAlert className="h-5 w-5" />
                Global destructive actions
              </CardTitle>
              <CardDescription>
                These actions affect the entire local environment. Type <span className="font-medium text-foreground">RESET</span> to unlock them.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-3 rounded border border-border p-4">
                <div className="grid gap-2">
                  <Label htmlFor="dev-reset-confirm">Confirmation phrase</Label>
                  <Input
                    id="dev-reset-confirm"
                    value={confirmValue}
                    onChange={(event) => setConfirmValue(event.target.value)}
                    placeholder="Type RESET"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Label htmlFor="dev-reset-checkbox" className="items-start gap-3 text-sm">
                  <Checkbox
                    id="dev-reset-checkbox"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-muted-foreground">
                    I understand these actions are destructive and intended only for local development.
                  </span>
                </Label>
              </div>

              <div className="grid gap-3">
                <Button
                  variant="destructive"
                  disabled={
                    pendingAction !== null ||
                    !destructiveActionsUnlocked ||
                    !snapshot.databaseConfigured
                  }
                  onClick={() => void runServerAction("clear_database")}
                >
                  <Database className="h-4 w-4" />
                  Clear database
                </Button>

                <Button
                  variant="destructive"
                  disabled={
                    pendingAction !== null ||
                    !destructiveActionsUnlocked ||
                    snapshot.clerkUserCount === null
                  }
                  onClick={() => void runServerAction("clear_users")}
                >
                  <UserRound className="h-4 w-4" />
                  Clear Clerk users
                </Button>

                <Button
                  variant="destructive"
                  disabled={
                    pendingAction !== null ||
                    !destructiveActionsUnlocked ||
                    !snapshot.databaseConfigured ||
                    snapshot.clerkUserCount === null
                  }
                  onClick={() => void runServerAction("clear_both")}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Clear database and Clerk users
                </Button>
              </div>

              <div className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">
                <div>Additional tracked rows</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span>Documents: {formatCount(database?.documents ?? null)}</span>
                  <span>Intake sessions: {formatCount(database?.intakeSessions ?? null)}</span>
                  <span>Email accounts: {formatCount(database?.emailAccounts ?? null)}</span>
                  <span>Assistant threads: {formatCount(database?.assistantThreads ?? null)}</span>
                  <span>Billing accounts: {formatCount(database?.billingAccounts ?? null)}</span>
                  <span>Webhook events: {formatCount(database?.billingWebhookEvents ?? null)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
