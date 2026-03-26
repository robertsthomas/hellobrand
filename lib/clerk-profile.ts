import type { ProfileRecord } from "@/lib/types";

type ClerkClaims = Record<string, unknown> | null | undefined;

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function getClerkMetadataDisplayName(claims: ClerkClaims) {
  const publicMetadata = (claims?.publicMetadata ??
    claims?.public_metadata) as Record<string, unknown> | undefined;

  return firstString(publicMetadata?.displayName);
}

export function buildClerkProfileSyncPayload(profile: ProfileRecord) {
  const trimmedDisplayName = profile.displayName?.trim() ?? "";
  const [firstName = "", ...rest] = trimmedDisplayName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ").trim();

  return {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    publicMetadata: {
      displayName: profile.displayName ?? null
    }
  };
}
