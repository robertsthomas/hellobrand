import { Suspense } from "react";

import { PlanTier } from "@prisma/client";

import {
  EmailConnectionsPanel,
  FeatureUpgradeCard,
  SettingsEditor,
} from "@/components/settings";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getCachedProfile } from "@/lib/cached-data";
import { resolveEmailSubscriptionEnabled } from "@/lib/email-subscriptions";
import { listEmailAccountsForViewer } from "@/lib/email/service";

function emailProviderLabel(provider: string | undefined) {
  switch (provider) {
    case "outlook":
      return "Outlook";
    case "yahoo":
      return "Yahoo";
    case "gmail":
    default:
      return "Gmail";
  }
}

export default function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ email_status?: string; email_error?: string; email_provider?: string }>;
}) {
  return (
    <Suspense fallback={<div className="animate-pulse space-y-4"><div className="h-10 w-48 rounded bg-black/[0.06]" /><div className="h-96 w-full rounded bg-black/[0.06]" /></div>}>
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
  const entitlements = await getViewerEntitlements(viewer);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [profile, emailAccounts] = await Promise.all([
    getCachedProfile(viewer),
    entitlements.features.email_connections ? listEmailAccountsForViewer(viewer) : Promise.resolve([])
  ]);
  const productUpdatesEnabled = await resolveEmailSubscriptionEnabled(
    profile.contactEmail ?? viewer.email,
    "product_updates"
  );

  return (
    <div className="space-y-8">
      <SettingsEditor
        initialProfile={profile}
        initialEmail={viewer.email}
        initialProductUpdatesEnabled={productUpdatesEnabled}
      />
      {entitlements.features.email_connections ? (
        <EmailConnectionsPanel
          accounts={emailAccounts.map((account) => ({
            id: account.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            emailAddress: account.emailAddress,
            displayName: account.displayName,
            status: account.status,
            scopes: account.scopes,
            mailAuthConfigured: account.mailAuthConfigured,
            tokenExpiresAt: account.tokenExpiresAt,
            lastSyncAt: account.lastSyncAt,
            lastErrorCode: account.lastErrorCode,
            lastErrorMessage: account.lastErrorMessage,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
          }))}
          statusMessage={
            resolvedSearchParams?.email_status === "connected"
              ? `${emailProviderLabel(resolvedSearchParams.email_provider)} connected. Initial sync started.`
              : null
          }
          errorMessage={resolvedSearchParams?.email_error ?? null}
        />
      ) : (
        <div className="mt-8">
          <FeatureUpgradeCard
            eyebrow="Premium connections"
            title="Email connections unlock on Premium"
            description="Connect Gmail, Outlook, or Yahoo to sync inbox threads, link communications to partnerships, and power HelloBrand's communication intelligence."
            requiredTier={PlanTier.premium}
            currentTier={entitlements.effectiveTier}
            hasActiveSubscription={entitlements.hasActiveSubscription}
            actionLabel="Upgrade for email sync"
          />
        </div>
      )}
    </div>
  );
}
