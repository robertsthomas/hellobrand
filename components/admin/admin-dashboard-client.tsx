"use client";

/**
 * This file renders the admin dashboard client UI.
 * It handles local admin interactions here and relies on the admin domain modules for the actual admin operations.
 */
import { startTransition, useDeferredValue, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";

import {
  AdminCacheCleanerDialog,
  type AdminCacheTargetKey,
} from "@/components/admin/admin-cache-cleaner-dialog";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import type {
  AdminDashboardSnapshot,
  AdminManagedUser,
  AdminUserDetail,
} from "@/lib/admin-dashboard";
import type { AppSettingsRecord } from "@/lib/admin-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type AdminDashboardClientProps = {
  snapshot: AdminDashboardSnapshot;
  adminUsername: string;
};

type UserEditorState = {
  displayName: string;
  creatorLegalName: string;
  businessName: string;
  contactEmail: string;
  conflictAlertsEnabled: boolean;
  paymentRemindersEnabled: boolean;
  emailNotificationsEnabled: boolean;
};

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number") return "Unavailable";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toEditorState(user: AdminManagedUser | null): UserEditorState {
  return {
    displayName: user?.profile?.displayName ?? user?.displayName ?? "",
    creatorLegalName: user?.profile?.creatorLegalName ?? "",
    businessName: user?.profile?.businessName ?? "",
    contactEmail: user?.profile?.contactEmail ?? user?.email ?? "",
    conflictAlertsEnabled: user?.profile?.conflictAlertsEnabled ?? true,
    paymentRemindersEnabled: user?.profile?.paymentRemindersEnabled ?? true,
    emailNotificationsEnabled: user?.profile?.emailNotificationsEnabled ?? true,
  };
}

function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border border-border px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Detail Modal
// ---------------------------------------------------------------------------

// fallow-ignore-next-line complexity
function UserDetailModal({
  user,
  onClose,
  onUserUpdated,
}: {
  user: AdminManagedUser;
  onClose: () => void;
  onUserUpdated: (user: AdminManagedUser) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<UserEditorState>(toEditorState(user));
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ tier: "free", status: "active" });
  const [trialForm, setTrialForm] = useState({ tier: "basic", days: "14" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDealDialogOpen, setDeleteDealDialogOpen] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_detail" }),
      });
      const data = await res.json();
      if (data.detail) setDetail(data.detail);
    } catch {
      toast.error("Could not load user details.");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function saveUser() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editor),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save.");
        return;
      }
      toast.success("User saved.");
      if (data.user) onUserUpdated(data.user);
      router.refresh();
    } catch {
      toast.error("Could not save user.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(body: Record<string, unknown>, successMsg?: string) {
    const key = String(body.action);
    setActionLoading(key);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Action failed.");
        return;
      }
      toast.success(data.message ?? successMsg ?? "Done.");
      void loadDetail();
      router.refresh();
    } catch {
      toast.error("Action failed.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[5vh]">
      <div className="relative w-full max-w-3xl border border-border bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 text-muted-foreground hover:text-muted-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{user.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {user.email} · Joined {formatDate(user.createdAt)}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
            {/* Profile editor */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Profile</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Display name</Label>
                  <Input
                    value={editor.displayName}
                    onChange={(e) => setEditor((s) => ({ ...s, displayName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Legal name</Label>
                  <Input
                    value={editor.creatorLegalName}
                    onChange={(e) => setEditor((s) => ({ ...s, creatorLegalName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Business name</Label>
                  <Input
                    value={editor.businessName}
                    onChange={(e) => setEditor((s) => ({ ...s, businessName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Contact email</Label>
                  <Input
                    value={editor.contactEmail}
                    onChange={(e) => setEditor((s) => ({ ...s, contactEmail: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <SettingRow
                  label="Conflict alerts"
                  description="Enable conflict/risk alerting."
                  checked={editor.conflictAlertsEnabled}
                  onCheckedChange={(c) => setEditor((s) => ({ ...s, conflictAlertsEnabled: c }))}
                />
                <SettingRow
                  label="Payment reminders"
                  description="Payment reminder nudges."
                  checked={editor.paymentRemindersEnabled}
                  onCheckedChange={(c) => setEditor((s) => ({ ...s, paymentRemindersEnabled: c }))}
                />
                <SettingRow
                  label="Email notifications"
                  description="User email notifications."
                  checked={editor.emailNotificationsEnabled}
                  onCheckedChange={(c) =>
                    setEditor((s) => ({ ...s, emailNotificationsEnabled: c }))
                  }
                />
              </div>
              <div className="mt-3">
                <Button disabled={saving} onClick={() => void saveUser()}>
                  {saving ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </div>

            {/* Plan and billing */}
            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">Plan and billing</h3>
              {detail?.billing ? (
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <div className="border border-border px-3 py-2 text-sm">
                    <div className="text-muted-foreground">Plan</div>
                    <div className="mt-1 font-semibold capitalize">
                      {detail.billing.currentPlanTier ?? "None"}
                    </div>
                  </div>
                  <div className="border border-border px-3 py-2 text-sm">
                    <div className="text-muted-foreground">Status</div>
                    <div className="mt-1 font-semibold capitalize">
                      {detail.billing.currentSubscriptionStatus ?? "None"}
                    </div>
                  </div>
                  <div className="border border-border px-3 py-2 text-sm">
                    <div className="text-muted-foreground">Trial ends</div>
                    <div className="mt-1 font-semibold">
                      {detail.billing.currentTrialEndsAt
                        ? formatDate(detail.billing.currentTrialEndsAt)
                        : "N/A"}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No billing account.</p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="border border-border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Set plan</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      className="border border-border px-2 py-1.5 text-sm"
                      value={planForm.tier}
                      onChange={(e) => setPlanForm((s) => ({ ...s, tier: e.target.value }))}
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                    <select
                      className="border border-border px-2 py-1.5 text-sm"
                      value={planForm.status}
                      onChange={(e) => setPlanForm((s) => ({ ...s, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="trialing">Trialing</option>
                      <option value="canceled">Canceled</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={actionLoading === "update_plan"}
                    onClick={() =>
                      void runAction({
                        action: "update_plan",
                        planTier: planForm.tier,
                        subscriptionStatus: planForm.status,
                      })
                    }
                  >
                    {actionLoading === "update_plan" ? "Saving..." : "Apply plan"}
                  </Button>
                </div>

                <div className="border border-border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Grant trial</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      className="border border-border px-2 py-1.5 text-sm"
                      value={trialForm.tier}
                      onChange={(e) => setTrialForm((s) => ({ ...s, tier: e.target.value }))}
                    >
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                    <Input
                      type="number"
                      className="h-auto px-2 py-1.5 text-sm"
                      value={trialForm.days}
                      onChange={(e) => setTrialForm((s) => ({ ...s, days: e.target.value }))}
                      placeholder="Days"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={actionLoading === "grant_trial"}
                    onClick={() =>
                      void runAction({
                        action: "grant_trial",
                        planTier: trialForm.tier,
                        durationDays: Number(trialForm.days) || 14,
                      })
                    }
                  >
                    {actionLoading === "grant_trial"
                      ? "Granting..."
                      : `Grant ${trialForm.days}-day trial`}
                  </Button>
                </div>
              </div>
            </div>

            {/* Workspaces */}
            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">
                Workspaces ({detail?.deals.length ?? 0})
              </h3>
              {detail?.deals && detail.deals.length > 0 ? (
                <div className="mt-3 divide-y divide-border border border-border">
                  {detail.deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {deal.campaignName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {deal.brandName} · {deal.status} · {deal.paymentStatus}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={actionLoading === `delete_deal_${deal.id}`}
                        onClick={() => setDeleteDealDialogOpen(deal.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No workspaces.</p>
              )}
            </div>

            {/* Onboarding */}
            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">Onboarding</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="border border-border px-3 py-2 text-sm">
                  <div className="text-muted-foreground">Profile onboarding</div>
                  <div className="mt-1 font-semibold">
                    {detail?.onboarding?.profileOnboardingCompletedAt ? "Completed" : "Incomplete"}
                  </div>
                </div>
                <div className="border border-border px-3 py-2 text-sm">
                  <div className="text-muted-foreground">Guide version</div>
                  <div className="mt-1 font-semibold">
                    {detail?.onboarding?.productGuideVersion ?? 0}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-1"
                disabled={actionLoading === "reset_onboarding"}
                onClick={() => void runAction({ action: "reset_onboarding" })}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {actionLoading === "reset_onboarding"
                  ? "Resetting..."
                  : "Reset onboarding and tooltips"}
              </Button>
            </div>

            {/* Danger zone */}
            <div className="border-t border-clay/30 bg-clay/[0.03] px-5 py-4 -mx-5 mt-5">
              <h3 className="text-sm font-semibold text-clay">Danger zone</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Pause, resume, or permanently delete this user and all their data.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(detail?.billing?.currentSubscriptionStatus === "active" ||
                  detail?.billing?.currentSubscriptionStatus === "trialing") &&
                  !detail?.billing?.currentSubscriptionStatus?.includes("cancel") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                      disabled={actionLoading === "pause_user"}
                      onClick={() =>
                        void runAction({ action: "pause_user" }, "Subscription set to cancel at period end.")
                      }
                    >
                      <Pause className="h-3.5 w-3.5" />
                      {actionLoading === "pause_user" ? "Pausing..." : "Pause subscription"}
                    </Button>
                  )}
                {(detail?.billing?.currentSubscriptionStatus === "active" ||
                  detail?.billing?.currentSubscriptionStatus === "trialing") &&
                  (detail?.billing as { cancelAtPeriodEnd?: boolean } | null)?.cancelAtPeriodEnd && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-ocean/40 text-ocean hover:bg-ocean/5"
                      disabled={actionLoading === "resume_user"}
                      onClick={() =>
                        void runAction({ action: "resume_user" }, "Subscription resumed.")
                      }
                    >
                      <Play className="h-3.5 w-3.5" />
                      {actionLoading === "resume_user" ? "Resuming..." : "Resume subscription"}
                    </Button>
                  )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-clay/40 text-clay hover:bg-clay/10"
                  disabled={actionLoading === "delete_user"}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {actionLoading === "delete_user" ? "Deleting..." : "Delete user and all data"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDestructiveDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={`Delete ${user.displayName}?`}
          description={
            <>
              <p>
                Permanently delete <strong>{user.displayName}</strong> ({user.email}) and ALL their
                data, including workspaces, documents, stored files, Stripe subscriptions, and the
                Clerk account.
              </p>
              <p>This cannot be undone.</p>
            </>
          }
          confirmLabel="Delete permanently"
          onConfirm={() => {
            void runAction({ action: "delete_user" }).then(() => {
              setDeleteDialogOpen(false);
              onClose();
            });
          }}
          confirmLoading={actionLoading === "delete_user"}
          alternative={{
            label: "Pause subscription instead",
            onClick: () =>
              void runAction({ action: "pause_user" }, "Subscription set to cancel at period end."),
          }}
        />

        <ConfirmDestructiveDialog
          open={deleteDealDialogOpen !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteDealDialogOpen(null);
          }}
          title={`Delete "${detail?.deals.find((d) => d.id === deleteDealDialogOpen)?.campaignName ?? "workspace"}"?`}
          description={
            <p>
              This workspace and all its data will be permanently deleted. This cannot be undone.
            </p>
          }
          confirmLabel="Delete workspace"
          onConfirm={() => {
            if (deleteDealDialogOpen) {
              void runAction({ action: "delete_deal", dealId: deleteDealDialogOpen });
              setDeleteDealDialogOpen(null);
            }
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Dashboard
// ---------------------------------------------------------------------------

export function AdminDashboardClient({ snapshot, adminUsername }: AdminDashboardClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(snapshot.users);
  const [appSettings, setAppSettings] = useState(snapshot.appSettings);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [clearingInboxCaches, setClearingInboxCaches] = useState(false);
  const [cacheDialogOpen, setCacheDialogOpen] = useState(false);
  const [selectedCacheTargets, setSelectedCacheTargets] = useState<AdminCacheTargetKey[]>([
    "inbox",
  ]);
  const deferredQuery = useDeferredValue(query);

  const filteredUsers = users.filter((user) => {
    if (!deferredQuery.trim()) return true;
    const q = deferredQuery.trim().toLowerCase();
    return (
      user.displayName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.profile?.businessName ?? "").toLowerCase().includes(q)
    );
  });

  const modalUser = users.find((u) => u.id === modalUserId) ?? null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appSettings),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        settings?: AppSettingsRecord;
      };
      if (!res.ok || !data.settings) {
        toast.error(data.error ?? "Could not save.");
        return;
      }
      setAppSettings(data.settings);
      toast.success(data.message ?? "Saved.");
      router.refresh();
    } catch {
      toast.error("Could not save.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function savePassword() {
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      setPasswordForm({ password: "", confirmPassword: "" });
      toast.success(data.message ?? "Password updated.");
    } catch {
      toast.error("Failed.");
    } finally {
      setSavingPassword(false);
    }
  }

  function clearLocalStorageItems() {
    const keys = Object.keys(window.localStorage).filter(
      (key) => key.startsWith("hellobrand:") || key.startsWith("hb-") || key.startsWith("hb_")
    );
    keys.forEach((key) => window.localStorage.removeItem(key));
    toast.success(`Cleared ${keys.length} localStorage item${keys.length === 1 ? "" : "s"}.`);
  }

  function toggleCacheTarget(target: AdminCacheTargetKey) {
    setSelectedCacheTargets((current) =>
      current.includes(target) ? current.filter((value) => value !== target) : [...current, target]
    );
  }

  async function clearSelectedCaches() {
    if (selectedCacheTargets.length === 0) {
      toast.error("Select at least one cache target.");
      return;
    }

    setClearingInboxCaches(true);
    try {
      const res = await fetch("/api/admin/inbox-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: selectedCacheTargets }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        targets?: AdminCacheTargetKey[];
        cleared?: {
          threadSummaries?: number;
          previewStates?: number;
          aiCacheEntries?: number;
        };
      };

      if (!res.ok) {
        toast.error(data.error ?? "Could not clear caches.");
        return;
      }

      if (selectedCacheTargets.includes("inbox")) {
        window.localStorage.removeItem("hellobrand:inbox:draft-prompt-suggestions");
        window.localStorage.removeItem("hellobrand:inbox:signature-banner:dismissed");
      }

      const responseTargets = data.targets ?? selectedCacheTargets;
      const targetSummary = responseTargets.join(", ");

      if (responseTargets.includes("inbox")) {
        const clearedSummary = [
          `${data.cleared?.threadSummaries ?? 0} summaries`,
          `${data.cleared?.previewStates ?? 0} preview states`,
          `${data.cleared?.aiCacheEntries ?? 0} AI cache rows`,
        ].join(", ");
        toast.success(
          `${data.message ?? "Selected caches cleared."} ${targetSummary}. Inbox cleanup: ${clearedSummary}.`
        );
      } else {
        toast.success(`${data.message ?? "Selected caches cleared."} ${targetSummary}.`);
      }

      setCacheDialogOpen(false);
    } catch {
      toast.error("Could not clear caches.");
    } finally {
      setClearingInboxCaches(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted px-4 py-4 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        {/* Header */}
        <section className="border border-border bg-white px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Admin</h1>
              <div className="mt-1 text-sm text-muted-foreground">
                {snapshot.environment} · {snapshot.host ?? "unknown host"} · signed in as{" "}
                {adminUsername}
              </div>
            </div>
            <Button variant="outline" disabled={signingOut} onClick={() => void handleSignOut()}>
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </section>

        {/* Overview */}
        <AdminSection title="Overview">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: "Users", value: snapshot.stats?.users },
              { label: "Profiles", value: snapshot.stats?.profiles },
              { label: "Deals", value: snapshot.stats?.deals },
              { label: "Intake sessions", value: snapshot.stats?.intakeSessions },
              { label: "Email accounts", value: snapshot.stats?.emailAccounts },
              { label: "Notifications", value: snapshot.stats?.notifications },
            ].map((stat) => (
              <div key={stat.label} className="border border-border px-3 py-3 text-sm">
                <div className="text-muted-foreground">{stat.label}</div>
                <div className="mt-1 text-xl font-semibold text-foreground">
                  {formatCount(stat.value)}
                </div>
              </div>
            ))}
          </div>
        </AdminSection>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Users table */}
          <AdminSection title="Users" description="Click a user to open their management panel.">
            <div className="mb-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search name, email, or business"
              />
            </div>

            <div className="overflow-x-auto border border-border">
              <div className="grid min-w-[720px] grid-cols-[minmax(0,1.5fr)_110px_110px_130px] border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <div>User</div>
                <div>Deals</div>
                <div>Email</div>
                <div>Joined</div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground">No users matched.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="grid min-w-[720px] w-full grid-cols-[minmax(0,1.5fr)_110px_110px_130px] gap-3 px-3 py-3 text-left text-sm bg-white hover:bg-muted/50"
                      onClick={() => startTransition(() => setModalUserId(user.id))}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {user.displayName}
                        </div>
                        <div className="truncate text-muted-foreground">{user.email}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {user.profile?.businessName ?? "No business name"} ·{" "}
                          {user.profile?.emailNotificationsEnabled === false
                            ? "Email off"
                            : "Email on"}
                        </div>
                      </div>
                      <div>{user.dealCount}</div>
                      <div>{user.emailAccountCount}</div>
                      <div>{formatDate(user.createdAt)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </AdminSection>

          <div className="flex flex-col gap-4">
            {/* Runtime controls */}
            <AdminSection title="Runtime controls">
              <div className="grid gap-2">
                <SettingRow
                  label="App access"
                  description="Disable the creator app without touching auth."
                  checked={appSettings.appAccessEnabled}
                  onCheckedChange={(c) => setAppSettings((s) => ({ ...s, appAccessEnabled: c }))}
                />
                <SettingRow
                  label="Public site"
                  description="Disable landing, upload, sample, and pricing pages."
                  checked={appSettings.publicSiteEnabled}
                  onCheckedChange={(c) => setAppSettings((s) => ({ ...s, publicSiteEnabled: c }))}
                />
                <SettingRow
                  label="New sign-ups"
                  description="Hide sign-up while keeping sign-in available."
                  checked={appSettings.signUpsEnabled}
                  onCheckedChange={(c) => setAppSettings((s) => ({ ...s, signUpsEnabled: c }))}
                />
                <SettingRow
                  label="Notification email delivery"
                  description="Stop outbound notification emails globally."
                  checked={appSettings.emailDeliveryEnabled}
                  onCheckedChange={(c) =>
                    setAppSettings((s) => ({ ...s, emailDeliveryEnabled: c }))
                  }
                />
              </div>
              <div className="mt-4">
                <Button disabled={savingSettings} onClick={() => void saveSettings()}>
                  {savingSettings ? "Saving..." : "Save runtime controls"}
                </Button>
              </div>
            </AdminSection>

            {/* AI Models */}
            <AdminSection title="AI Models" description="Currently configured models per task.">
              <div className="space-y-2">
                {snapshot.aiModelConfig.models.map((model) => (
                  <div key={model.task} className="border border-border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{model.task}</span>
                      {model.envVar && (
                        <span className="text-xs text-muted-foreground">{model.envVar}</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium text-muted-foreground">Primary: </span>
                      <span
                        className={
                          model.primary.includes("anthropic/")
                            ? "text-purple-600"
                            : model.primary.includes("openai/")
                              ? "text-green-600"
                              : model.primary.includes("google/")
                                ? "text-blue-600"
                                : "text-foreground"
                        }
                      >
                        {model.primary}
                      </span>
                    </div>
                    {model.fallbacks.length > 0 && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Fallbacks: {model.fallbacks.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2">
                  <div className="text-xs text-muted-foreground">
                    Approved for production:{" "}
                    {snapshot.aiModelConfig.approvedProductionModels.join(", ")}
                  </div>
                </div>
              </div>
            </AdminSection>

            {/* Dev tools */}
            <AdminSection title="Dev tools" description="Local development utilities.">
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3 border border-border px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Clear HelloBrand localStorage
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Remove all hellobrand:* and hb-* keys from this browser.
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearLocalStorageItems}>
                    Clear
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 border border-border px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Clear dismissed banner
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Re-show the profile onboarding banner.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.localStorage.removeItem(
                        "hellobrand:profile-onboarding-banner:dismissed"
                      );
                      toast.success("Banner dismiss cleared.");
                    }}
                  >
                    Reset
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 border border-border px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Clear selected app caches
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Pick which app pages and caches to clear without reloading admin.
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCacheDialogOpen(true)}>
                    Choose caches
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        Hard refresh all caches
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Force revalidate and reload the page.
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.refresh();
                      window.location.reload();
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </AdminSection>

            {/* Admin password */}
            <AdminSection title="Admin password" description="Update the admin board password.">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="admin-pw">New password</Label>
                  <Input
                    id="admin-pw"
                    type="password"
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm((s) => ({ ...s, password: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-pw-confirm">Confirm password</Label>
                  <Input
                    id="admin-pw-confirm"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((s) => ({ ...s, confirmPassword: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Button
                    disabled={savingPassword}
                    variant="outline"
                    onClick={() => void savePassword()}
                  >
                    {savingPassword ? "Updating..." : "Update admin password"}
                  </Button>
                </div>
              </div>
            </AdminSection>
          </div>
        </div>
      </div>

      {/* User modal */}
      {modalUser ? (
        <UserDetailModal
          user={modalUser}
          onClose={() => setModalUserId(null)}
          onUserUpdated={(updated) => {
            setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
          }}
        />
      ) : null}

      <AdminCacheCleanerDialog
        open={cacheDialogOpen}
        onOpenChange={setCacheDialogOpen}
        selectedTargets={selectedCacheTargets}
        onToggleTarget={toggleCacheTarget}
        onSubmit={() => void clearSelectedCaches()}
        clearing={clearingInboxCaches}
      />
    </div>
  );
}
