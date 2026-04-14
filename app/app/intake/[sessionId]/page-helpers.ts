/**
 * Helpers for the intake session routes.
 * This file centralizes route data loading and review-page derived state so the page files can stay focused on redirects and rendering.
 */
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { cleanDisplayText } from "@/lib/display-text";
import { getIntakeSessionForViewer } from "@/lib/intake";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import type {
  DealAggregate,
  IntakeSessionRecord,
  Viewer
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export type IntakeRouteSessionData = Awaited<
  ReturnType<typeof getIntakeSessionForViewer>
>;

function presentText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveHandleFromEmail(email: string | null | undefined) {
  const normalized = presentText(email);
  if (!normalized || !normalized.includes("@")) {
    return null;
  }

  return normalized.split("@")[0] ?? null;
}

function intakeConflictMessagesByField(conflicts: Array<{ type: string; title: string }>) {
  const messages: Record<string, string[]> = {};

  function push(field: string, message: string) {
    messages[field] = [...(messages[field] ?? []), message];
  }

  for (const conflict of conflicts) {
    if (conflict.type === "category_conflict") {
      push("brandCategory", conflict.title);
      push("competitorCategories", conflict.title);
      continue;
    }

    if (conflict.type === "competitor_restriction") {
      push("restrictedCategories", conflict.title);
      push("competitorCategories", conflict.title);
      push("brandCategory", conflict.title);
      continue;
    }

    if (conflict.type === "exclusivity_overlap") {
      push("restrictedCategories", conflict.title);
      push("brandCategory", conflict.title);
      push("campaignDateWindow", conflict.title);
      continue;
    }

    if (conflict.type === "schedule_collision") {
      push("campaignDateWindow", conflict.title);
      push("timelineItems", conflict.title);
      push("deliverables", conflict.title);
    }
  }

  return messages;
}

function dedupeAttentionIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export async function loadIntakeSessionRouteData(
  viewer: Viewer,
  sessionId: string
): Promise<IntakeRouteSessionData | null> {
  try {
    return await getIntakeSessionForViewer(viewer, sessionId);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Intake session not found."
    ) {
      return null;
    }

    throw error;
  }
}

export function buildIntakeReviewPageViewModel(input: {
  aggregate: DealAggregate | null;
  profileDefaults: IntakeRouteSessionData["profileDefaults"];
  viewer: Viewer;
}) {
  const { aggregate, profileDefaults, viewer } = input;
  const derivedHandle = deriveHandleFromEmail(profileDefaults?.contactEmail ?? viewer.email);
  const creatorDefault =
    presentText(profileDefaults?.creatorLegalName) ??
    presentText(profileDefaults?.displayName) ??
    presentText(viewer.displayName) ??
    derivedHandle ??
    "Creator";
  const businessDefault =
    presentText(profileDefaults?.businessName) ??
    presentText(profileDefaults?.creatorLegalName) ??
    presentText(profileDefaults?.displayName) ??
    presentText(viewer.displayName) ??
    derivedHandle ??
    "Creator";
  const contactDefault = presentText(profileDefaults?.contactEmail) ?? viewer.email;
  const profileConfigured = Boolean(
    presentText(profileDefaults?.creatorLegalName) ||
      presentText(profileDefaults?.businessName)
  );
  const normalized = buildNormalizedIntakeRecord(aggregate, {
    excludedPrimaryContactEmails: [viewer.email, profileDefaults?.contactEmail],
    excludedPrimaryContactNames: profileConfigured
      ? [
          profileDefaults?.creatorLegalName,
          profileDefaults?.displayName,
          profileDefaults?.businessName,
          viewer.displayName
        ]
      : []
  });
  const deliverables = normalized?.deliverables ?? [];
  const timelineItems = normalized?.timelineItems ?? [];
  const evidenceGroups = normalized?.evidenceGroups ?? [];
  const analyticsHighlights = normalized?.analytics?.highlights ?? [];
  const conflictResults = aggregate?.conflictResults ?? [];
  const conflictMessagesByField = intakeConflictMessagesByField(conflictResults);
  const riskFlags = aggregate?.riskFlags ?? [];
  const initialProfileName =
    presentText(profileDefaults?.creatorLegalName) ??
    presentText(profileDefaults?.displayName) ??
    presentText(viewer.displayName) ??
    "";
  const initialProfileHandle =
    presentText(profileDefaults?.businessName) ?? derivedHandle ?? "";
  const contactType =
    normalized?.primaryContact?.organizationType ??
    (normalized?.agencyName ? "agency" : "brand");
  const displayLabels = getDisplayDealLabels({
    brandName: normalized?.brandName,
    campaignName: normalized?.contractTitle
  });
  const summaryCards = [
    {
      label: "Brand",
      value: displayLabels.brandName ?? "",
      loading: false
    },
    {
      label: "Primary contact",
      value:
        cleanDisplayText(normalized?.primaryContact?.name) ??
        cleanDisplayText(normalized?.primaryContact?.email) ??
        "",
      loading: false
    },
    {
      label: "Payment",
      value:
        typeof normalized?.paymentAmount === "number"
          ? formatCurrency(normalized.paymentAmount, normalized.currency ?? "USD")
          : "",
      loading: false
    },
    {
      label: "Deliverables",
      value: String(normalized?.deliverableCount ?? 0),
      loading: !normalized?.deliverableCount
    }
  ];

  const attentionItems = dedupeAttentionIds([
    ...conflictResults.map((conflict) => ({
      id: `conflict-${conflict.type}-${conflict.title}`
    })),
    ...riskFlags.slice(0, 4).map((flag) => ({
      id: `${flag.title.trim().toLowerCase()}::${(flag.detail ?? "").trim().toLowerCase()}`
    }))
  ].map((item) => item.id));

  return {
    analyticsHighlights,
    attentionItems,
    businessDefault,
    conflictMessagesByField,
    conflictResults,
    contactDefault,
    contactType,
    creatorDefault,
    deliverables,
    displayLabels,
    evidenceGroups,
    initialProfileHandle,
    initialProfileName,
    normalized,
    profileConfigured,
    riskFlags,
    summaryCards,
    timelineItems
  };
}

export function shouldRedirectToDeal(
  session: IntakeSessionRecord,
  aggregate: DealAggregate | null
) {
  return session.status === "completed" && aggregate ? `/app/p/${aggregate.deal.id}` : null;
}
