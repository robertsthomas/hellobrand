import { getLaunchDarklyClient, isLaunchDarklyConfigured } from "@/lib/launchdarkly";

async function ldFlag(key: string, defaultValue: boolean): Promise<boolean> {
  if (!isLaunchDarklyConfigured()) {
    return defaultValue;
  }

  const client = getLaunchDarklyClient();
  if (!client || !client.initialized()) {
    return defaultValue;
  }

  try {
    return await client.boolVariation(key, { kind: "user", key: "anonymous", anonymous: true }, defaultValue);
  } catch {
    return defaultValue;
  }
}

export const yahooProviderEnabled = () => ldFlag("yahoo-provider-enabled", false);
export const yahooOAuthEnabled = () => ldFlag("yahoo-oauth-enabled", true);
export const yahooAppPasswordEnabled = () => ldFlag("yahoo-app-password-enabled", true);
export const gmailProviderEnabled = () => ldFlag("gmail-provider-enabled", true);
export const outlookProviderEnabled = () => ldFlag("outlook-provider-enabled", true);
export const invoiceEditorEnabled = () => ldFlag("invoice-editor-enabled", true);
export const aiRiskAnalysisEnabled = () => ldFlag("ai-risk-analysis-enabled", true);
export const aiConflictIntelligence = () => ldFlag("ai-conflict-intelligence", false);
export const batchIntakeEnabled = () => ldFlag("batch-intake-enabled", false);
export const intakeClusteringEnabled = () => ldFlag("intake-clustering-enabled", false);
export const smartInboxEnabled = () => ldFlag("smart-inbox-enabled", false);
export const invoiceRemindersEnabled = () => ldFlag("invoice-reminders-enabled", false);
export const sidebarMilestonesEnabled = () => ldFlag("sidebar-milestones-enabled", true);
export const blogSummarizeEnabled = () => ldFlag("blog-summarize-enabled", false);
export const maintenanceMode = () => ldFlag("maintenance-mode", false);
