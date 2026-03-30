"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AdminDashboardSnapshot, AdminManagedUser } from "@/lib/admin-dashboard";
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
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
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
    emailNotificationsEnabled: user?.profile?.emailNotificationsEnabled ?? true
  };
}

function AdminSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-neutral-600">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onCheckedChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border border-neutral-200 px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        <div className="mt-1 text-sm text-neutral-600">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function AdminDashboardClient({
  snapshot,
  adminUsername
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(snapshot.users);
  const [appSettings, setAppSettings] = useState(snapshot.appSettings);
  const [selectedUserId, setSelectedUserId] = useState(snapshot.users[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [userEditor, setUserEditor] = useState<UserEditorState>(
    toEditorState(snapshot.users[0] ?? null)
  );
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: ""
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const filteredUsers = users.filter((user) => {
    if (!deferredQuery.trim()) {
      return true;
    }

    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return (
      user.displayName.toLowerCase().includes(normalizedQuery) ||
      user.email.toLowerCase().includes(normalizedQuery) ||
      (user.profile?.businessName ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  useEffect(() => {
    setUserEditor(toEditorState(selectedUser));
  }, [selectedUserId, selectedUser]);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      await fetch("/api/admin/session", {
        method: "DELETE"
      });

      router.replace("/admin/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(appSettings)
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        settings?: AppSettingsRecord;
      };

      if (!response.ok || !payload.settings) {
        toast.error(payload.error ?? "Could not save app settings.");
        return;
      }

      setAppSettings(payload.settings);
      toast.success(payload.message ?? "App settings saved.");
      router.refresh();
    } catch {
      toast.error("Could not save app settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveSelectedUser() {
    if (!selectedUser) {
      return;
    }

    setSavingUser(true);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(userEditor)
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        user?: AdminManagedUser;
      };

      if (!response.ok || !payload.user) {
        toast.error(payload.error ?? "Could not save user changes.");
        return;
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === payload.user?.id ? payload.user : user))
      );
      toast.success(payload.message ?? "User saved.");
      router.refresh();
    } catch {
      toast.error("Could not save user changes.");
    } finally {
      setSavingUser(false);
    }
  }

  async function savePassword() {
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const response = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(passwordForm)
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update admin password.");
        return;
      }

      setPasswordForm({
        password: "",
        confirmPassword: ""
      });
      toast.success(payload.message ?? "Admin password updated.");
    } catch {
      toast.error("Could not update admin password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-4 text-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="border border-neutral-200 bg-white px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Admin</h1>
              <div className="mt-1 text-sm text-neutral-600">
                {snapshot.environment} · {snapshot.host ?? "unknown host"} · signed in as {adminUsername}
              </div>
            </div>
            <Button variant="outline" disabled={signingOut} onClick={() => void handleSignOut()}>
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </section>

        <AdminSection title="Overview">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            <div className="border border-neutral-200 px-3 py-3 text-sm">
              <div className="text-neutral-500">Users</div>
              <div className="mt-1 text-xl font-semibold">{formatCount(snapshot.stats?.users)}</div>
            </div>
            <div className="border border-neutral-200 px-3 py-3 text-sm">
              <div className="text-neutral-500">Profiles</div>
              <div className="mt-1 text-xl font-semibold">{formatCount(snapshot.stats?.profiles)}</div>
            </div>
            <div className="border border-neutral-200 px-3 py-3 text-sm">
              <div className="text-neutral-500">Deals</div>
              <div className="mt-1 text-xl font-semibold">{formatCount(snapshot.stats?.deals)}</div>
            </div>
            <div className="border border-neutral-200 px-3 py-3 text-sm">
              <div className="text-neutral-500">Intake sessions</div>
              <div className="mt-1 text-xl font-semibold">{formatCount(snapshot.stats?.intakeSessions)}</div>
            </div>
            <div className="border border-neutral-200 px-3 py-3 text-sm">
              <div className="text-neutral-500">Email accounts</div>
              <div className="mt-1 text-xl font-semibold">{formatCount(snapshot.stats?.emailAccounts)}</div>
            </div>
            <div className="border border-neutral-200 px-3 py-3 text-sm">
              <div className="text-neutral-500">Notifications</div>
              <div className="mt-1 text-xl font-semibold">{formatCount(snapshot.stats?.notifications)}</div>
            </div>
          </div>
        </AdminSection>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminSection
            title="Users"
            description="Select a user to edit profile and notification settings."
          >
            <div className="mb-4">
              <Input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search name, email, or business"
              />
            </div>

            <div className="overflow-x-auto border border-neutral-200">
              <div className="grid min-w-[720px] grid-cols-[minmax(0,1.5fr)_110px_110px_130px] border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <div>User</div>
                <div>Deals</div>
                <div>Email</div>
                <div>Joined</div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="px-3 py-6 text-sm text-neutral-600">No users matched this search.</div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {filteredUsers.map((user) => {
                    const isSelected = user.id === selectedUserId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={`grid min-w-[720px] w-full grid-cols-[minmax(0,1.5fr)_110px_110px_130px] gap-3 px-3 py-3 text-left text-sm ${
                          isSelected ? "bg-neutral-100" : "bg-white hover:bg-neutral-50"
                        }`}
                        onClick={() =>
                          startTransition(() => {
                            setSelectedUserId(user.id);
                          })
                        }
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-neutral-900">{user.displayName}</div>
                          <div className="truncate text-neutral-600">{user.email}</div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {user.profile?.businessName ?? "No business name"} ·{" "}
                            {user.profile?.emailNotificationsEnabled === false ? "Email alerts off" : "Email alerts on"}
                          </div>
                        </div>
                        <div>{user.dealCount}</div>
                        <div>{user.emailAccountCount}</div>
                        <div>{formatDate(user.createdAt)}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </AdminSection>

          <div className="flex flex-col gap-4">
            <AdminSection title="Runtime controls">
              <div className="grid gap-2">
                <SettingRow
                  label="App access"
                  description="Disable the creator app without touching auth."
                  checked={appSettings.appAccessEnabled}
                  onCheckedChange={(checked) =>
                    setAppSettings((current) => ({ ...current, appAccessEnabled: checked }))
                  }
                />
                <SettingRow
                  label="Public site"
                  description="Disable landing, upload, sample, and pricing pages."
                  checked={appSettings.publicSiteEnabled}
                  onCheckedChange={(checked) =>
                    setAppSettings((current) => ({ ...current, publicSiteEnabled: checked }))
                  }
                />
                <SettingRow
                  label="New sign-ups"
                  description="Hide sign-up while keeping sign-in available."
                  checked={appSettings.signUpsEnabled}
                  onCheckedChange={(checked) =>
                    setAppSettings((current) => ({ ...current, signUpsEnabled: checked }))
                  }
                />
                <SettingRow
                  label="Notification email delivery"
                  description="Stop outbound notification emails globally."
                  checked={appSettings.emailDeliveryEnabled}
                  onCheckedChange={(checked) =>
                    setAppSettings((current) => ({ ...current, emailDeliveryEnabled: checked }))
                  }
                />
              </div>
              <div className="mt-4">
                <Button disabled={savingSettings} onClick={() => void saveSettings()}>
                  {savingSettings ? "Saving..." : "Save runtime controls"}
                </Button>
              </div>
            </AdminSection>

            <AdminSection
              title="Selected user"
              description={
                selectedUser
                  ? `Editing ${selectedUser.displayName}`
                  : "Select a user from the list."
              }
            >
              {selectedUser ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="admin-user-display-name">Display name</Label>
                      <Input
                        id="admin-user-display-name"
                        value={userEditor.displayName}
                        onChange={(event) =>
                          setUserEditor((current) => ({
                            ...current,
                            displayName: event.currentTarget.value
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin-user-legal-name">Legal name</Label>
                      <Input
                        id="admin-user-legal-name"
                        value={userEditor.creatorLegalName}
                        onChange={(event) =>
                          setUserEditor((current) => ({
                            ...current,
                            creatorLegalName: event.currentTarget.value
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin-user-business-name">Business name</Label>
                      <Input
                        id="admin-user-business-name"
                        value={userEditor.businessName}
                        onChange={(event) =>
                          setUserEditor((current) => ({
                            ...current,
                            businessName: event.currentTarget.value
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="admin-user-contact-email">Contact email</Label>
                      <Input
                        id="admin-user-contact-email"
                        value={userEditor.contactEmail}
                        onChange={(event) =>
                          setUserEditor((current) => ({
                            ...current,
                            contactEmail: event.currentTarget.value
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <SettingRow
                      label="Contract conflict alerts"
                      description="Enable or disable conflict/risk alerting."
                      checked={userEditor.conflictAlertsEnabled}
                      onCheckedChange={(checked) =>
                        setUserEditor((current) => ({
                          ...current,
                          conflictAlertsEnabled: checked
                        }))
                      }
                    />
                    <SettingRow
                      label="Payment reminders"
                      description="Enable or disable payment reminder nudges."
                      checked={userEditor.paymentRemindersEnabled}
                      onCheckedChange={(checked) =>
                        setUserEditor((current) => ({
                          ...current,
                          paymentRemindersEnabled: checked
                        }))
                      }
                    />
                    <SettingRow
                      label="Email notifications"
                      description="User-level email notification preference."
                      checked={userEditor.emailNotificationsEnabled}
                      onCheckedChange={(checked) =>
                        setUserEditor((current) => ({
                          ...current,
                          emailNotificationsEnabled: checked
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Button disabled={savingUser} onClick={() => void saveSelectedUser()}>
                      {savingUser ? "Saving..." : "Save user"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-neutral-600">Pick a user from the left-hand list.</div>
              )}
            </AdminSection>

            <AdminSection
              title="Admin password"
              description="Update the password used for this admin board."
            >
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="admin-password-next">New password</Label>
                  <Input
                    id="admin-password-next"
                    type="password"
                    value={passwordForm.password}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        password: event.currentTarget.value
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-password-confirm-next">Confirm password</Label>
                  <Input
                    id="admin-password-confirm-next"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.currentTarget.value
                      }))
                    }
                  />
                </div>
                <div>
                  <Button disabled={savingPassword} variant="outline" onClick={() => void savePassword()}>
                    {savingPassword ? "Updating..." : "Update admin password"}
                  </Button>
                </div>
              </div>
            </AdminSection>
          </div>
        </div>
      </div>
    </div>
  );
}
