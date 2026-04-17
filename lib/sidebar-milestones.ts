import type { ViewerEntitlements } from "@/lib/billing/entitlements";
import type { ConnectedEmailAccountRecord, ProfileRecord } from "@/lib/types";

type SidebarMilestoneItem = {
  id: "create_workspace" | "setup_creator_profile" | "connect_email";
  label: string;
  href: string;
  complete: boolean;
};

export type SidebarMilestones = {
  visible: boolean;
  completedCount: number;
  totalCount: number;
  items: SidebarMilestoneItem[];
};

type BuildSidebarMilestonesInput = {
  hasActiveWorkspace: boolean;
  hasEverCreatedWorkspace: boolean;
  profile: Pick<ProfileRecord, "creatorLegalName" | "businessName">;
  entitlements: Pick<ViewerEntitlements, "features">;
  emailAccounts?: Array<
    Pick<ConnectedEmailAccountRecord, "provider" | "status" | "mailAuthConfigured">
  >;
};

function isUsableMilestoneEmailAccount(
  account: Pick<ConnectedEmailAccountRecord, "provider" | "status" | "mailAuthConfigured">
) {
  const hasActiveStatus = account.status === "connected" || account.status === "syncing";

  if (!hasActiveStatus) {
    return false;
  }

  if (account.provider === "yahoo") {
    return account.mailAuthConfigured;
  }

  return true;
}

export function buildSidebarMilestones(
  input: BuildSidebarMilestonesInput
): SidebarMilestones {
  const items: SidebarMilestoneItem[] = [
    {
      id: "create_workspace",
      label: "Create workspace",
      href: "/app/intake/new",
      complete: input.hasActiveWorkspace || input.hasEverCreatedWorkspace
    },
    {
      id: "setup_creator_profile",
      label: "Set up creator profile",
      href: "/app/settings/profile",
      complete: Boolean(
        input.profile.creatorLegalName?.trim() && input.profile.businessName?.trim()
      )
    }
  ];

  if (input.entitlements.features.email_connections) {
    items.push({
      id: "connect_email",
      label: "Connect email",
      href: "/app/settings",
      complete: (input.emailAccounts ?? []).some(isUsableMilestoneEmailAccount)
    });
  }

  const completedCount = items.filter((item) => item.complete).length;

  return {
    visible: items.length > 0 && completedCount < items.length,
    completedCount,
    totalCount: items.length,
    items
  };
}
