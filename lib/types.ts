/**
 * Compatibility barrel for shared app record and domain types.
 * Prefer adding new definitions to focused files under lib/types/ and keep this file as a stable import surface.
 */

export type * from "./types/common";
export type * from "./types/billing";
export type * from "./types/deals";
export type * from "./types/documents";
export type * from "./types/email";
export type * from "./types/assistant";
export type * from "./types/intake";
export type * from "./types/profile";
export type * from "./types/public";
export type * from "./types/aggregates";
