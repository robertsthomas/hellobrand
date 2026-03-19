import { Suspense } from "react";

import { EmailConnectionsPanel } from "@/components/email-connections-panel";
import { SettingsEditor } from "@/components/settings-editor";
import { requireViewer } from "@/lib/auth";
import { getCachedProfile } from "@/lib/cached-data";
import { listEmailAccountsForViewer } from "@/lib/email/service";


export default function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ email_status?: string; email_error?: string; email_provider?: string }>;
}) {
  return (
    <Suspense fallback={<div className="px-8 py-10"><div className="mx-auto max-w-5xl animate-pulse space-y-4"><div className="h-10 w-48 rounded bg-black/[0.06]" /><div className="h-96 w-full rounded bg-black/[0.06]" /></div></div>}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsContent({
  searchParams
}: {
  searchParams?: Promise<{ email_status?: string; email_error?: string; email_provider?: string }>;
}) {
  const viewer = await requireViewer();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [profile, emailAccounts] = await Promise.all([
    getCachedProfile(viewer),
    listEmailAccountsForViewer(viewer)
  ]);

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <SettingsEditor initialProfile={profile} initialEmail={viewer.email} />
        <EmailConnectionsPanel
          accounts={emailAccounts.map((account) => ({
            id: account.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            emailAddress: account.emailAddress,
            displayName: account.displayName,
            status: account.status,
            scopes: account.scopes,
            tokenExpiresAt: account.tokenExpiresAt,
            lastSyncAt: account.lastSyncAt,
            lastErrorCode: account.lastErrorCode,
            lastErrorMessage: account.lastErrorMessage,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
          }))}
          statusMessage={
            resolvedSearchParams?.email_status === "connected"
              ? `${resolvedSearchParams.email_provider === "outlook" ? "Outlook" : "Gmail"} connected. Initial sync started.`
              : null
          }
          errorMessage={resolvedSearchParams?.email_error ?? null}
        />
      </div>
    </div>
  );
}
