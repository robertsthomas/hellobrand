import { createFlagsDiscoveryEndpoint } from "flags/next";
import { getProviderData } from "@flags-sdk/vercel";
import {
  yahooProviderEnabled,
  yahooOAuthEnabled,
  yahooAppPasswordEnabled,
  gmailProviderEnabled,
  outlookProviderEnabled,
  invoiceEditorEnabled,
  aiRiskAnalysisEnabled,
  aiConflictIntelligence,
  batchIntakeEnabled,
  intakeClusteringEnabled,
  smartInboxEnabled,
  invoiceRemindersEnabled,
  sidebarMilestonesEnabled,
  blogSummarizeEnabled,
  maintenanceMode,
} from "@/flags";

const flags = {
  yahooProviderEnabled,
  yahooOAuthEnabled,
  yahooAppPasswordEnabled,
  gmailProviderEnabled,
  outlookProviderEnabled,
  invoiceEditorEnabled,
  aiRiskAnalysisEnabled,
  aiConflictIntelligence,
  batchIntakeEnabled,
  intakeClusteringEnabled,
  smartInboxEnabled,
  invoiceRemindersEnabled,
  sidebarMilestonesEnabled,
  blogSummarizeEnabled,
  maintenanceMode,
};

export const GET = createFlagsDiscoveryEndpoint(async () => {
  return getProviderData(flags);
});
