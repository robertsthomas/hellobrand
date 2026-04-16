import { createFlagsDiscoveryEndpoint } from "flags/next";
import { getProviderData } from "@flags-sdk/vercel";
import {
  yahooProviderEnabled,
  yahooOAuthEnabled,
  yahooAppPasswordEnabled,
  gmailProviderEnabled,
  outlookProviderEnabled,
  invoiceEditorEnabled,
  aiAssistantEnabled,
  aiRiskAnalysisEnabled,
  aiConflictIntelligence,
  batchIntakeEnabled,
  intakeClusteringEnabled,
  smartInboxEnabled,
  invoiceRemindersEnabled,
  sidebarMilestonesEnabled,
  onboardingGuideEnabled,
  feedbackWidgetEnabled,
  blogSummarizeEnabled,
  documentScanShowcase,
  maintenanceMode,
  signupsEnabled,
  emailDeliveryEnabled,
  publicSiteEnabled,
} from "@/flags";

const flags = {
  yahooProviderEnabled,
  yahooOAuthEnabled,
  yahooAppPasswordEnabled,
  gmailProviderEnabled,
  outlookProviderEnabled,
  invoiceEditorEnabled,
  aiAssistantEnabled,
  aiRiskAnalysisEnabled,
  aiConflictIntelligence,
  batchIntakeEnabled,
  intakeClusteringEnabled,
  smartInboxEnabled,
  invoiceRemindersEnabled,
  sidebarMilestonesEnabled,
  onboardingGuideEnabled,
  feedbackWidgetEnabled,
  blogSummarizeEnabled,
  documentScanShowcase,
  maintenanceMode,
  signupsEnabled,
  emailDeliveryEnabled,
  publicSiteEnabled,
};

export const GET = createFlagsDiscoveryEndpoint(async () => {
  return getProviderData(flags);
});
