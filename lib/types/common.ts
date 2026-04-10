/**
 * Shared cross-domain primitive record types.
 * Keep feature-specific records in their own domain type modules.
 */

export type EmailProvider = "gmail" | "outlook" | "yahoo";

export interface Viewer {
  id: string;
  email: string;
  displayName: string;
  mode: "demo" | "supabase" | "clerk";
}
