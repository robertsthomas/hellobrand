import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

export const yahooProviderEnabled = flag({
  key: "yahoo-provider-enabled",
  adapter: vercelAdapter(),
  description:
    "Yahoo is the newest/most experimental provider. Toggle independently of env vars. Currently gated only by hasProviderConfig() checking env vars -- a flag gives you per-user rollout and instant kill switch.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const yahooOAuthEnabled = flag({
  key: "yahoo-oauth-enabled",
  adapter: vercelAdapter(),
  description:
    "Enable or disable the Yahoo OAuth flow specifically. When off, users can only connect via app password.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const yahooAppPasswordEnabled = flag({
  key: "yahoo-app-password-enabled",
  adapter: vercelAdapter(),
  description:
    "Enable or disable Yahoo app password authentication. When off, users must use OAuth.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const gmailProviderEnabled = flag({
  key: "gmail-provider-enabled",
  adapter: vercelAdapter(),
  description: "Operational kill switch for Gmail provider. Disable if Google API has outages.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const outlookProviderEnabled = flag({
  key: "outlook-provider-enabled",
  adapter: vercelAdapter(),
  description:
    "Operational kill switch for Outlook/Microsoft provider. Disable if Microsoft Graph API has outages.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const emailProviderFlags = [
  yahooProviderEnabled,
  yahooOAuthEnabled,
  yahooAppPasswordEnabled,
  gmailProviderEnabled,
  outlookProviderEnabled,
] as const;

export const invoiceEditorEnabled = flag({
  key: "invoice-editor-enabled",
  adapter: vercelAdapter(),
  description: "Toggle the full invoice editor feature.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const aiAssistantEnabled = flag({
  key: "ai-assistant-enabled",
  adapter: vercelAdapter(),
  description: "Toggle the AI assistant chat panel.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const aiRiskAnalysisEnabled = flag({
  key: "ai-risk-analysis-enabled",
  adapter: vercelAdapter(),
  description: "Toggle AI-powered risk flag analysis on contracts.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const aiConflictIntelligence = flag({
  key: "ai-conflict-intelligence",
  adapter: vercelAdapter(),
  description: "Toggle conflict intelligence across deals.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const batchIntakeEnabled = flag({
  key: "batch-intake-enabled",
  adapter: vercelAdapter(),
  description: "Toggle batch contract intake for uploading multiple documents.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const intakeClusteringEnabled = flag({
  key: "intake-clustering-enabled",
  adapter: vercelAdapter(),
  description: "Toggle AI-powered document clustering during intake.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const smartInboxEnabled = flag({
  key: "smart-inbox-enabled",
  adapter: vercelAdapter(),
  description: "Toggle smart inbox features like promise discrepancy detection and email scoring.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const invoiceRemindersEnabled = flag({
  key: "invoice-reminders-enabled",
  adapter: vercelAdapter(),
  description: "Toggle the invoice reminder and touchpoint notification system.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const sidebarMilestonesEnabled = flag({
  key: "sidebar-milestones-enabled",
  adapter: vercelAdapter(),
  description: "Toggle the sidebar milestones card. Useful for A/B testing engagement.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const onboardingGuideEnabled = flag({
  key: "onboarding-guide-enabled",
  adapter: vercelAdapter(),
  description: "Toggle the onboarding guide component.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const feedbackWidgetEnabled = flag({
  key: "feedback-widget-enabled",
  adapter: vercelAdapter(),
  description: "Toggle the feedback widget visibility.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const blogSummarizeEnabled = flag({
  key: "blog-summarize-enabled",
  adapter: vercelAdapter(),
  description: "Enable AI-powered blog post summarization.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const documentScanShowcase = flag({
  key: "document-scan-showcase",
  adapter: vercelAdapter(),
  description: "Toggle the document scan showcase demo feature.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const maintenanceMode = flag({
  key: "maintenance-mode",
  adapter: vercelAdapter(),
  description: "Enable maintenance mode. Replaces MAINTENANCE_MODE env var for instant toggling.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const signupsEnabled = flag({
  key: "signups-enabled",
  adapter: vercelAdapter(),
  description: "Control new user signups. Replaces signUpsEnabled admin setting.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const emailDeliveryEnabled = flag({
  key: "email-delivery-enabled",
  adapter: vercelAdapter(),
  description: "Control outgoing email delivery. Replaces emailDeliveryEnabled admin setting.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});

export const publicSiteEnabled = flag({
  key: "public-site-enabled",
  adapter: vercelAdapter(),
  description: "Show or hide the public marketing site. Replaces publicSiteEnabled admin setting.",
  defaultValue: true,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
});
