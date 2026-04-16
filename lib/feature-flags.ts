import {
  aiAssistantEnabled,
  aiConflictIntelligence,
  aiRiskAnalysisEnabled,
  batchIntakeEnabled,
  blogSummarizeEnabled,
  documentScanShowcase,
  feedbackWidgetEnabled,
  intakeClusteringEnabled,
  invoiceEditorEnabled,
  invoiceRemindersEnabled,
  maintenanceMode,
  onboardingGuideEnabled,
  sidebarMilestonesEnabled,
  smartInboxEnabled,
} from "@/flags";

export type AppFeatureFlags = {
  aiAssistant: boolean;
  aiRiskAnalysis: boolean;
  aiConflictIntelligence: boolean;
  batchIntake: boolean;
  intakeClustering: boolean;
  smartInbox: boolean;
  invoiceEditor: boolean;
  invoiceReminders: boolean;
  sidebarMilestones: boolean;
  onboardingGuide: boolean;
  feedbackWidget: boolean;
  blogSummarize: boolean;
  documentScanShowcase: boolean;
  maintenanceMode: boolean;
};

export async function getAppFeatureFlags(): Promise<AppFeatureFlags> {
  const [
    aiAssistant,
    aiRiskAnalysis,
    aiConflictIntel,
    batchIntake,
    intakeClustering,
    smartInbox,
    invoiceEditor,
    invoiceReminders,
    sidebarMilestones,
    onboardingGuide,
    feedbackWidget,
    blogSummarize,
    docScanShowcase,
    maintenance,
  ] = await Promise.all([
    aiAssistantEnabled(),
    aiRiskAnalysisEnabled(),
    aiConflictIntelligence(),
    batchIntakeEnabled(),
    intakeClusteringEnabled(),
    smartInboxEnabled(),
    invoiceEditorEnabled(),
    invoiceRemindersEnabled(),
    sidebarMilestonesEnabled(),
    onboardingGuideEnabled(),
    feedbackWidgetEnabled(),
    blogSummarizeEnabled(),
    documentScanShowcase(),
    maintenanceMode(),
  ]);

  return {
    aiAssistant: aiAssistant === true,
    aiRiskAnalysis: aiRiskAnalysis === true,
    aiConflictIntelligence: aiConflictIntel === true,
    batchIntake: batchIntake === true,
    intakeClustering: intakeClustering === true,
    smartInbox: smartInbox === true,
    invoiceEditor: invoiceEditor === true,
    invoiceReminders: invoiceReminders === true,
    sidebarMilestones: sidebarMilestones === true,
    onboardingGuide: onboardingGuide === true,
    feedbackWidget: feedbackWidget === true,
    blogSummarize: blogSummarize === true,
    documentScanShowcase: docScanShowcase === true,
    maintenanceMode: maintenance === true,
  };
}
